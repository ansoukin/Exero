//! 动作链执行引擎
//!
//! 核心调度逻辑：
//! 1. 从数据库加载 Flow 的所有 actions
//! 2. 按 `parent_id` 构建树形结构，按 `order` 排序
//! 3. 递归执行根节点（parent_id = None）
//! 4. 处理控制流节点（IfElse / Loop / SetVariable）的子动作遍历
//! 5. 应用容错策略（Continue / Stop / Rollback / Notify）
//! 6. 写入执行日志到 execution_logs 表

use std::sync::Arc;

use serde_json::Value;
use tauri::AppHandle;

use crate::actions::{ActionExecutorRegistry, ExecutionContext, GlobalVariables};
use crate::db::{Database, Repository};
use crate::error::{AppError, Result};
use crate::models::common::{ActionType, FaultStrategy};
use crate::models::{Action, ExecutionLog};

/// 动作链执行引擎
pub struct ChainEngine {
    db: Arc<Database>,
    registry: Arc<ActionExecutorRegistry>,
    app_handle: AppHandle,
    global_variables: GlobalVariables,
}

impl ChainEngine {
    /// 创建执行引擎
    pub fn new(
        db: Arc<Database>,
        registry: Arc<ActionExecutorRegistry>,
        app_handle: AppHandle,
        global_variables: GlobalVariables,
    ) -> Self {
        Self {
            db,
            registry,
            app_handle,
            global_variables,
        }
    }

    /// 执行整条快捷指令
    ///
    /// 加载 flow 的所有 actions 并按顺序执行，记录执行日志。
    pub fn execute_flow(&self, flow_id: &str) -> Result<ExecutionLog> {
        let repo = Repository::new(&self.db);

        // 加载 Flow 元数据
        let flow = repo
            .get_flow(flow_id)?
            .ok_or_else(|| AppError::NotFound(format!("快捷指令 {} 不存在", flow_id)))?;

        if !flow.enabled {
            return Err(AppError::Trigger(format!(
                "快捷指令 {} 已禁用，无法执行",
                flow_id
            )));
        }

        // 加载所有 actions
        let actions = repo.list_actions(flow_id)?;
        tracing::info!(
            "开始执行快捷指令: id={} name={} actions={}",
            flow_id,
            flow.name,
            actions.len()
        );

        // 创建执行上下文
        let mut ctx = ExecutionContext::new(
            flow_id.to_string(),
            self.app_handle.clone(),
            self.global_variables.clone(),
        );

        // 从 settings 读取 Lua 沙箱模式注入上下文（默认严格）
        // settings 值为 "strict" / "relaxed"，缺失或异常时回退 strict
        let lua_sandbox_strict = repo
            .get_setting("lua.sandbox_mode")
            .ok()
            .flatten()
            .map(|s| s.value != "relaxed")
            .unwrap_or(true);
        ctx.lua_sandbox_strict = lua_sandbox_strict;

        // 创建 Flow 级别执行日志
        let mut flow_log = ExecutionLog::start(flow_id.to_string(), None);
        repo.insert_log(&flow_log)?;

        // 执行根节点（parent_id = None）
        let result = self.execute_children(&actions, None, &mut ctx, &repo, flow.default_fault_strategy);

        match &result {
            Ok(_) => {
                flow_log.succeed();
                tracing::info!("快捷指令执行成功: id={}", flow_id);
            }
            Err(e) => {
                flow_log.fail(e.to_string());
                tracing::error!("快捷指令执行失败: id={} err={}", flow_id, e);
            }
        }

        // 更新 Flow 级别日志（start 时已 insert，此处 update 最终状态）
        repo.update_log(&flow_log)?;

        Ok(flow_log)
    }

    /// 执行单个动作
    ///
    /// 由 `execute_children` 调用，处理控制流分支与容错策略。
    pub(crate) fn execute_action(
        &self,
        action: &Action,
        all_actions: &[Action],
        ctx: &mut ExecutionContext,
        repo: &Repository<'_>,
        default_strategy: FaultStrategy,
    ) -> Result<()> {
        if ctx.stop_requested {
            return Ok(());
        }

        let mut log = ExecutionLog::start(action.flow_id.clone(), Some(action.id.clone()));
        repo.insert_log(&log)?;

        // 控制流节点：执行评估并递归处理子节点
        let result: Result<crate::actions::ActionResult> = match action.action_type {
            ActionType::IfElse => self
                .execute_if_else(action, all_actions, ctx, repo, default_strategy)
                .map(|_| crate::actions::ActionResult::success("条件分支执行完成")),
            ActionType::Loop => self
                .execute_loop(action, all_actions, ctx, repo, default_strategy)
                .map(|_| crate::actions::ActionResult::success("循环执行完成")),
            _ => self.registry.execute(&action.action_type, &action.params, ctx),
        };

        match result {
            Ok(action_result) => {
                log.succeed();
                repo.update_log(&log)?;
                tracing::debug!(
                    "动作执行成功: id={} type={:?} msg={}",
                    action.id,
                    action.action_type,
                    action_result.message
                );
                Ok(())
            }
            Err(e) => {
                let err_msg = e.to_string();
                log.fail(&err_msg);
                repo.update_log(&log)?;

                let strategy = action.fault_strategy.unwrap_or(default_strategy);
                self.handle_fault(&strategy, &err_msg, ctx)?;
                Ok(())
            }
        }
    }

    /// 递归执行指定 parent_id 下的所有子动作
    ///
    /// 按 `order` 升序排序后顺序执行。
    /// 遇到 stop / break / continue 信号时中断遍历（具体语义由调用者处理）。
    fn execute_children(
        &self,
        all_actions: &[Action],
        parent_id: Option<&str>,
        ctx: &mut ExecutionContext,
        repo: &Repository<'_>,
        default_strategy: FaultStrategy,
    ) -> Result<()> {
        let mut children: Vec<&Action> = all_actions
            .iter()
            .filter(|a| a.parent_id.as_deref() == parent_id)
            .collect();
        children.sort_by_key(|a| a.order);

        for action in children {
            // 检查控制信号
            if ctx.stop_requested {
                tracing::debug!("收到 stop 信号，终止动作链");
                return Ok(());
            }
            if ctx.break_requested {
                tracing::debug!("收到 break 信号，跳出当前遍历");
                return Ok(());
            }
            if ctx.continue_requested {
                tracing::debug!("收到 continue 信号，跳过本次循环剩余动作");
                return Ok(());
            }

            self.execute_action(action, all_actions, ctx, repo, default_strategy)?;
        }
        Ok(())
    }

    /// 执行 IfElse 节点
    ///
    /// 1. 调用 IfElseExecutor 评估条件
    /// 2. 根据 condition_met 选择 "then" 或 "else" 分支
    /// 3. 递归执行对应分支的子动作
    fn execute_if_else(
        &self,
        action: &Action,
        all_actions: &[Action],
        ctx: &mut ExecutionContext,
        repo: &Repository<'_>,
        default_strategy: FaultStrategy,
    ) -> Result<()> {
        let result = self.registry.execute(&action.action_type, &action.params, ctx)?;
        let condition_met = result
            .output
            .as_ref()
            .and_then(|v| v.get("condition_met"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let branch = if condition_met { "then" } else { "else" };
        tracing::debug!(
            "IfElse 节点 id={} condition={} -> {} 分支",
            action.id,
            condition_met,
            branch
        );

        // 选择对应分支的子动作
        let branch_children: Vec<&Action> = all_actions
            .iter()
            .filter(|a| a.parent_id.as_deref() == Some(&action.id))
            .filter(|a| {
                a.params
                    .get("branch")
                    .and_then(|v| v.as_str())
                    .unwrap_or("then")
                    == branch
            })
            .collect();

        if branch_children.is_empty() {
            tracing::debug!("IfElse 分支 {} 无子动作", branch);
            return Ok(());
        }

        // 递归执行分支内的动作（直接遍历，保留 order 排序）
        let mut sorted: Vec<&Action> = branch_children;
        sorted.sort_by_key(|a| a.order);
        for child in sorted {
            if ctx.stop_requested || ctx.break_requested || ctx.continue_requested {
                return Ok(());
            }
            self.execute_action(child, all_actions, ctx, repo, default_strategy)?;
        }
        Ok(())
    }

    /// 执行 Loop 节点
    ///
    /// 1. 调用 LoopExecutor 获取循环配置（count + var_name）
    /// 2. 循环执行子动作（parent_id = Loop.id）
    /// 3. 通过 ctx.break_requested / continue_requested 控制
    fn execute_loop(
        &self,
        action: &Action,
        all_actions: &[Action],
        ctx: &mut ExecutionContext,
        repo: &Repository<'_>,
        default_strategy: FaultStrategy,
    ) -> Result<()> {
        let result = self.registry.execute(&action.action_type, &action.params, ctx)?;
        let count = result
            .output
            .as_ref()
            .and_then(|v| v.get("loop_count"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let var_name = result
            .output
            .as_ref()
            .and_then(|v| v.get("loop_var"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        tracing::debug!(
            "Loop 节点 id={} count={:?} var={:?}",
            action.id,
            count,
            var_name
        );

        // 收集循环体动作
        let body_children: Vec<&Action> = all_actions
            .iter()
            .filter(|a| a.parent_id.as_deref() == Some(&action.id))
            .collect();

        if body_children.is_empty() {
            tracing::debug!("Loop 节点无循环体");
            return Ok(());
        }

        ctx.loop_depth += 1;
        let max_iter = if count == 0 {
            // 无限循环（最多 10000 次防止死循环卡死应用）
            10000
        } else {
            count
        };

        for i in 0..max_iter {
            // 重置控制信号（每次迭代开始时）
            ctx.continue_requested = false;

            // 检查 break（上一次循环中设置的 break）
            if ctx.break_requested {
                tracing::debug!("Loop {} 第 {} 次迭代检测到 break，退出", action.id, i);
                ctx.break_requested = false;
                break;
            }

            if ctx.stop_requested {
                tracing::debug!("Loop {} 收到 stop 信号，退出", action.id);
                break;
            }

            // 设置循环变量
            if let Some(name) = &var_name {
                ctx.set_var(name, Value::Number((i as i64).into()), false);
            }

            tracing::trace!("Loop {} 第 {} 次迭代开始", action.id, i);

            // 执行循环体
            self.execute_children(all_actions, Some(&action.id), ctx, repo, default_strategy)?;

            // 检查循环体设置的控制信号
            if ctx.stop_requested {
                break;
            }
        }

        ctx.loop_depth = ctx.loop_depth.saturating_sub(1);
        // 清空 break/continue 防止外溢
        ctx.break_requested = false;
        ctx.continue_requested = false;

        Ok(())
    }

    /// 处理容错策略
    fn handle_fault(
        &self,
        strategy: &FaultStrategy,
        error: &str,
        ctx: &mut ExecutionContext,
    ) -> Result<()> {
        match strategy {
            FaultStrategy::Continue => {
                tracing::warn!("动作失败按 Continue 策略跳过: {}", error);
                Ok(())
            }
            FaultStrategy::Stop => {
                tracing::error!("动作失败按 Stop 策略终止链: {}", error);
                ctx.request_stop();
                Ok(())
            }
            FaultStrategy::Rollback => {
                // Phase 4 实现回滚逻辑（如已启动进程需关闭）
                tracing::warn!(
                    "动作失败按 Rollback 策略（Phase 4 实现，暂按 Continue 处理）: {}",
                    error
                );
                Ok(())
            }
            FaultStrategy::Notify => {
                tracing::warn!("动作失败按 Notify 策略通知用户: {}", error);
                ctx.emit_in_app_notification("error", "动作执行失败", error);
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    // 注意：ChainEngine 完整测试需要 mock 数据库与 AppHandle，Phase 1 阶段依赖端到端测试覆盖
    // 见 commands::test::e2e_test
}
