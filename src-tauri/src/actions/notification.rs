//! 通知类动作执行器
//!
//! 包含：Toast 通知 / 应用内通知
//!
//! - Toast 通知：调用 `tauri-plugin-notification` 触发 Windows 原生 Toast
//! - 应用内通知：通过 Tauri 事件系统发送到前端通知中心

use serde_json::Value;
use tauri_plugin_notification::NotificationExt;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::Result;
use crate::models::action::{ShowInAppNotificationParams, ShowToastParams};
use crate::models::common::ActionType;

/// Toast 通知执行器
///
/// 使用 `tauri-plugin-notification` 触发 Windows 原生 Toast 通知。
/// 通知内容（标题/正文）支持变量插值。
pub struct ShowToastExecutor;

impl ActionExecutor for ShowToastExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::ShowToast
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: ShowToastParams = serde_json::from_value(params.clone())?;
        let title = ctx.interpolate(&p.title);
        let body = ctx.interpolate(&p.body);

        tracing::info!("发送 Toast 通知: {} - {}", title, body);

        // 调用 tauri-plugin-notification 发送原生 Windows Toast
        // 注意：dev 模式下 Windows 会以 PowerShell 名字/图标显示（Tauri v2 已知限制），
        // 安装后（NSIS 安装包）自动注册 AUMID，Toast 正常显示应用名/图标。
        let mut builder = ctx.app_handle.notification().builder().title(&title).body(&body);

        if let Some(icon_path) = &p.icon {
            let icon_path = ctx.interpolate(icon_path);
            if std::path::Path::new(&icon_path).exists() {
                builder = builder.icon(&icon_path);
            } else {
                tracing::warn!("Toast 图标路径不存在: {}", icon_path);
            }
        }

        builder
            .show()
            .map_err(|e| crate::error::AppError::ActionExecution(format!("发送 Toast 通知失败: {}", e)))?;

        Ok(ActionResult::success(format!("已发送 Toast 通知: {}", title)))
    }
}

/// 应用内通知执行器
///
/// 通过 Tauri 事件系统发送 `notification:in-app` 事件，
/// 前端监听该事件并在右下角通知中心展示动画。
pub struct ShowInAppNotificationExecutor;

impl ActionExecutor for ShowInAppNotificationExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::ShowInAppNotification
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: ShowInAppNotificationParams = serde_json::from_value(params.clone())?;
        let title = ctx.interpolate(&p.title);
        let body = ctx.interpolate(&p.body);

        // 校验级别（默认 info）
        let level = match p.level.as_str() {
            "info" | "warning" | "error" | "success" => p.level.clone(),
            other => {
                tracing::warn!("未知通知级别 {}，回退为 info", other);
                "info".to_string()
            }
        };

        tracing::info!("发送应用内通知: [{}] {} - {}", level, title, body);

        ctx.emit_in_app_notification(&level, &title, &body);

        Ok(ActionResult::success(format!(
            "已发送应用内通知: {}",
            title
        )))
    }
}
