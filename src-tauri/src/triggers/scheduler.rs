//! 触发器调度器
//!
//! 统一管理 3 类触发器：
//! - **时间类**：每个 Cron 触发器启动一个 tokio 任务，按 cron 表达式定时触发
//! - **系统事件类**：SystemEventMonitor 后台轮询进程列表（USB/网络等 Phase 1 暂不监听）
//! - **手动类**：通过 ManualTriggerHandle 主动触发
//!
//! 调度器由 AppState 持有，启动时加载所有启用的触发器并启动后台任务。

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use parking_lot::RwLock;
use tauri::AppHandle;
use tauri::async_runtime::{spawn, JoinHandle};

use crate::db::{Database, Repository};
use crate::error::{AppError, Result};
use crate::models::common::TriggerType;
use crate::models::trigger::{CourseTriggerParams, CronTriggerParams};

use super::course;
use super::cron::CronTrigger;
use super::manual::ManualTriggerHandle;
use super::system_event::{build_event_match, EventCallback, SystemEventMonitor};

/// 触发器执行的回调函数类型
///
/// 参数：flow_id（要执行的快捷指令 ID）
pub type ExecuteCallback = Arc<dyn Fn(String) -> Result<()> + Send + Sync>;

/// 触发器调度器
pub struct TriggerScheduler {
    db: Arc<Database>,
    app_handle: AppHandle,
    /// Cron 触发器任务列表
    cron_tasks: RwLock<Vec<JoinHandle<()>>>,
    /// 系统事件监控器
    system_monitor: Arc<SystemEventMonitor>,
    /// 手动触发句柄（提供给 Tauri 命令使用）
    manual_handle: Arc<ManualTriggerHandle>,
    /// 执行回调（由 AppState 注入，调用 ChainEngine）
    execute_callback: RwLock<Option<ExecuteCallback>>,
    /// 是否已启动
    started: RwLock<bool>,
}

impl TriggerScheduler {
    /// 创建调度器
    pub fn new(db: Arc<Database>, app_handle: AppHandle) -> Self {
        let manual_handle = Arc::new(ManualTriggerHandle::new());
        let system_monitor = Arc::new(SystemEventMonitor::new());

        Self {
            db,
            app_handle,
            cron_tasks: RwLock::new(Vec::new()),
            system_monitor,
            manual_handle,
            execute_callback: RwLock::new(None),
            started: RwLock::new(false),
        }
    }

    /// 获取手动触发句柄（供 Tauri 命令调用）
    pub fn manual_handle(&self) -> Arc<ManualTriggerHandle> {
        self.manual_handle.clone()
    }

    /// 注入执行回调
    ///
    /// 当触发器被触发时，调用此回调执行对应 Flow。
    /// 回调内部应调用 `ChainEngine::execute_flow(flow_id)`。
    pub fn set_execute_callback(&self, callback: ExecuteCallback) {
        let cb = callback.clone();
        *self.execute_callback.write() = Some(callback);

        // 同步注入到手动触发器
        let cb_for_manual = cb.clone();
        self.manual_handle.set_callback(Arc::new(move |flow_id| {
            cb_for_manual(flow_id.to_string())
        }));
    }

    /// 启动调度器
    ///
    /// 1. 从数据库加载所有启用的触发器
    /// 2. 为每个 Cron 触发器启动后台任务
    /// 3. 启动系统事件监控器
    pub fn start(&self) -> Result<()> {
        let mut started = self.started.write();
        if *started {
            tracing::warn!("调度器已在运行");
            return Ok(());
        }

        tracing::info!("启动触发器调度器");

        // 加载所有启用的触发器
        let triggers = {
            let repo = crate::db::Repository::new(&self.db);
            repo.list_all_enabled_triggers()?
        };
        tracing::info!("加载 {} 个启用的触发器", triggers.len());

        let mut cron_count = 0;
        let mut course_count = 0;
        let mut event_count = 0;
        let mut other_count = 0;

        for trigger in triggers {
            match trigger.trigger_type {
                TriggerType::Cron => {
                    if let Err(e) = self.start_cron_trigger(&trigger) {
                        tracing::error!(
                            "启动 Cron 触发器失败 {} (flow={}): {}",
                            trigger.id, trigger.flow_id, e
                        );
                    } else {
                        cron_count += 1;
                    }
                }
                TriggerType::ProcessStart | TriggerType::ProcessStop => {
                    if let Some(m) = build_event_match(
                        trigger.id.clone(),
                        trigger.flow_id.clone(),
                        trigger.trigger_type,
                        &trigger.params,
                    ) {
                        self.system_monitor.add_match(m);
                        event_count += 1;
                    }
                }
                TriggerType::UsbPlug
                | TriggerType::UsbUnplug
                | TriggerType::SystemBoot
                | TriggerType::SystemShutdown
                | TriggerType::UserLogin
                | TriggerType::UserLockScreen
                | TriggerType::NetworkChange => {
                    tracing::debug!(
                        "系统事件 {:?} Phase 1 不主动监听 (trigger={})",
                        trigger.trigger_type,
                        trigger.id
                    );
                    other_count += 1;
                }
                TriggerType::CourseStart => {
                    if let Err(e) = self.start_course_trigger(&trigger) {
                        tracing::error!(
                            "启动课表触发器失败 {} (flow={}): {}",
                            trigger.id,
                            trigger.flow_id,
                            e
                        );
                    } else {
                        course_count += 1;
                    }
                }
                TriggerType::Manual => {
                    // 手动触发器无需后台任务
                }
            }
        }

        // 启动系统事件监控器
        let callback = self.execute_callback.read().clone();
        if let Some(cb) = callback {
            let event_cb: EventCallback = Arc::new(move |_trigger_id, flow_id| {
                let _ = cb(flow_id.to_string());
            });
            self.system_monitor.start(event_cb);
        } else {
            tracing::warn!("调度器启动时未注入执行回调，系统事件监控将不会触发执行");
        }

        *started = true;
        tracing::info!(
            "触发器调度器已启动：{} 个 Cron 任务，{} 个课表触发，{} 个系统事件规则，{} 个待实现事件",
            cron_count, course_count, event_count, other_count
        );
        Ok(())
    }

    /// 停止调度器
    pub fn stop(&self) {
        let mut started = self.started.write();
        if !*started {
            return;
        }
        *started = false;

        // 停止所有 Cron 任务
        let mut tasks = self.cron_tasks.write();
        for task in tasks.drain(..) {
            task.abort();
        }

        // 停止系统事件监控
        self.system_monitor.stop();

        tracing::info!("触发器调度器已停止");
    }

    /// 重新加载所有触发器
    ///
    /// 当触发器变更时调用：停止所有任务并重新加载。
    pub fn reload(&self) -> Result<()> {
        tracing::info!("重新加载触发器");
        // 停止现有任务
        {
            let mut tasks = self.cron_tasks.write();
            for task in tasks.drain(..) {
                task.abort();
            }
        }
        self.system_monitor.clear();

        // 重新启动
        let was_started = *self.started.read();
        if was_started {
            *self.started.write() = false;
            self.start()?;
        }
        Ok(())
    }

    /// 启动单个 Cron 触发器
    fn start_cron_trigger(&self, trigger: &crate::models::Trigger) -> Result<()> {
        let params: CronTriggerParams = serde_json::from_value(trigger.params.clone())?;
        let cron = CronTrigger::from_params(&trigger.id, &trigger.flow_id, &params)?;

        let next = cron
            .next_fire_time()
            .ok_or_else(|| AppError::Trigger(format!("无法计算下一次触发时间: {}", params.expression)))?;

        let trigger_id = trigger.id.clone();
        let flow_id = trigger.flow_id.clone();
        let expr = params.expression.clone();
        let callback = self
            .execute_callback
            .read()
            .clone()
            .ok_or_else(|| AppError::Trigger("未注入执行回调".into()))?;
        let app_handle = self.app_handle.clone();

        let task = spawn(async move {
            tracing::info!(
                "Cron 触发器已启动: trigger={} flow={} expr={} next={}",
                trigger_id, flow_id, expr, next
            );

            // 重新解析（cron Schedule 不可跨 await）
            let params = CronTriggerParams {
                expression: expr.clone(),
                timezone: None,
            };
            let cron = match CronTrigger::from_params(&trigger_id, &flow_id, &params) {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("Cron 触发器 {} 解析失败: {}", trigger_id, e);
                    return;
                }
            };

            loop {
                let next = match cron.next_fire_time() {
                    Some(t) => t,
                    None => {
                        tracing::warn!("Cron 触发器 {} 无法计算下一次触发时间，退出", trigger_id);
                        return;
                    }
                };
                let now = chrono::Utc::now();
                let delay = if next > now {
                    next - now
                } else {
                    chrono::Duration::zero()
                };
                let delay_ms = delay.num_milliseconds().max(0) as u64;

                tracing::debug!(
                    "Cron 触发器 {} 下一次触发: {} ({}ms 后)",
                    trigger_id,
                    next,
                    delay_ms
                );

                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;

                tracing::info!("Cron 触发器 {} 触发执行 flow={}", trigger_id, flow_id);

                // 同步触发执行（在 Tauri 应用线程外，但通过 callback 调用）
                let flow_id_clone = flow_id.clone();
                let cb = callback.clone();
                let _app_handle = app_handle.clone();
                // 使用 spawn_blocking 避免阻塞 tokio runtime
                let result = tokio::task::spawn_blocking(move || cb(flow_id_clone))
                    .await
                    .map_err(|e| AppError::Other(format!("触发回调 panic: {}", e)));

                match result {
                    Ok(Ok(())) => {
                        tracing::debug!("Cron 触发器 {} 执行成功", trigger_id);
                    }
                    Ok(Err(e)) => {
                        tracing::error!("Cron 触发器 {} 执行失败: {}", trigger_id, e);
                    }
                    Err(e) => {
                        tracing::error!("Cron 触发器 {} 执行任务异常: {}", trigger_id, e);
                    }
                }

                // 短暂休眠避免在边界情况下重复触发
                tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            }
        });

        self.cron_tasks.write().push(task);
        Ok(())
    }

    /// 启动单个课表触发器（Beta9 · 任务1）
    ///
    /// 读取课程/节次/学期，按 timing 计算下一次触发时间，到点执行后重新计算。
    fn start_course_trigger(&self, trigger: &crate::models::Trigger) -> Result<()> {
        let params: CourseTriggerParams = serde_json::from_value(trigger.params.clone())?;
        let db = self.db.clone();
        let trigger_id = trigger.id.clone();
        let flow_id = trigger.flow_id.clone();
        let callback = self
            .execute_callback
            .read()
            .clone()
            .ok_or_else(|| AppError::Trigger("未注入执行回调".into()))?;

        let task = spawn(async move {
            tracing::info!("课表触发器已启动: trigger={} flow={}", trigger_id, flow_id);
            loop {
                let repo = Repository::new(&db);
                let next = match course::next_fire_time(&repo, &params) {
                    Ok(Some(t)) => t,
                    Ok(None) => {
                        tracing::warn!(
                            "课表触发器 {} 无法计算下一次触发时间，1 小时后重试",
                            trigger_id
                        );
                        tokio::time::sleep(Duration::from_secs(3600)).await;
                        continue;
                    }
                    Err(e) => {
                        tracing::error!("课表触发器 {} 计算失败: {}", trigger_id, e);
                        tokio::time::sleep(Duration::from_secs(3600)).await;
                        continue;
                    }
                };
                let now = Utc::now();
                let delay_ms = if next > now {
                    (next - now).num_milliseconds().max(0) as u64
                } else {
                    0
                };
                tracing::info!(
                    "课表触发器 {} 下一次触发: {} ({}ms 后)",
                    trigger_id,
                    next,
                    delay_ms
                );
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                tracing::info!("课表触发器 {} 触发执行 flow={}", trigger_id, flow_id);

                let fid = flow_id.clone();
                let cb = callback.clone();
                let _ = tokio::task::spawn_blocking(move || cb(fid)).await;
                // 短暂休眠避免边界重复触发
                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        });

        self.cron_tasks.write().push(task);
        Ok(())
    }
}

impl Drop for TriggerScheduler {
    fn drop(&mut self) {
        self.stop();
    }
}
