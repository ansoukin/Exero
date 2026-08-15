//! 传感器读取 API（Beta9 · 任务3）
//!
//! 对外暴露的简单 API：启动/停止/读取。
//! NexBoxMonitor.exe 必须在首次读取前启动（start_sensor_process）。

use tauri::{App, AppHandle};

use super::bridge::{find_monitor_exe, spawn_sensor, SensorsResponse};

/// 启动传感器子进程（应用启动时调用一次）
///
/// 若找不到 NexBoxMonitor.exe 则静默跳过（非 NVIDIA/未打包资源时不阻断应用）。
pub fn start_sensor_process(app: &App) {
    match spawn_sensor() {
        Ok(Some(bridge)) => {
            tracing::info!("已启动 NexBoxMonitor 子进程 (pid={})", bridge.child.id());
            super::bridge::set_bridge(Some(bridge));
        }
        Ok(None) => {
            // 未找到 exe，跳过
            tracing::info!("NexBoxMonitor 未找到，跳过启动（LHM 传感器不可用）");
        }
        Err(e) => {
            tracing::warn!("启动 NexBoxMonitor 失败: {e}");
        }
    }
    // 保持 app 引用避免警告（Exero 无需 manage SensorChild state）
    let _ = app;
}

/// 停止传感器子进程（应用退出时调用）
pub fn stop_sensor_process(_app: &AppHandle) {
    if let Some(mut bridge) = super::bridge::take_bridge() {
        tracing::info!("正在关闭 NexBoxMonitor 子进程 (pid={})", bridge.child.id());
        bridge.shutdown();
    }
}

/// 从 LHML 读取传感器数据
///
/// 首次调用时若桥接未启动则尝试延迟启动；子进程死亡则尝试重启。
/// 失败返回 Err，调用方可降级为 None。
pub fn read_sensors() -> Result<SensorsResponse, String> {
    let need_restart = {
        let guard = super::bridge::with_bridge_mut(|b| match b {
            Some(bridge) => !bridge.is_alive(),
            None => false,
        })?;
        // guard 为 true 表示子进程已死或不存在
        if !guard {
            // 子进程存活，直接读取
            return super::bridge::with_bridge_mut(|b| {
                let bridge = b.as_mut().ok_or("传感器桥接未启动")?;
                bridge.read_sensors()
            })?;
        }
        true
    };

    if need_restart {
        // 旧桥接已死，清理后重建
        super::bridge::set_bridge(None);
        match spawn_sensor() {
            Ok(Some(new_bridge)) => {
                tracing::info!("NexBoxMonitor 重启成功 (pid={})", new_bridge.child.id());
                super::bridge::set_bridge(Some(new_bridge));
                // 重启后立即读取可能数据不全，返回提示让调用方重试
                return Err("子进程已重启，请重试".to_string());
            }
            _ => return Err("NexBoxMonitor 不可用".to_string()),
        }
    }

    // 桥接不存在，尝试延迟启动
    match spawn_sensor() {
        Ok(Some(bridge)) => {
            tracing::info!("延迟启动 NexBoxMonitor (pid={})", bridge.child.id());
            super::bridge::set_bridge(Some(bridge));
            Err("子进程已启动，请重试".to_string())
        }
        _ => Err("NexBoxMonitor 不可用".to_string()),
    }
}

/// 检查 NexBoxMonitor.exe 是否存在（供前端诊断或降级判断）
pub fn is_sensor_available() -> bool {
    find_monitor_exe().is_some()
}
