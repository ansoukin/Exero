//! 系统集成命令（Phase 6a · SPEC 4.1）
//!
//! 提供应用退出、窗口隐藏等系统集成相关命令，
//! 供前端关闭行为弹窗与托盘交互调用。

use tauri::Manager;

use crate::error::Result;

/// 退出应用
///
/// 关闭行为弹窗"退出"按钮调用，或托盘"退出"菜单项调用。
#[tauri::command]
pub async fn exit_app(app_handle: tauri::AppHandle) -> Result<()> {
    tracing::info!("用户请求退出应用");
    app_handle.exit(0);
    Ok(())
}

/// 隐藏主窗口到托盘
///
/// 关闭行为弹窗"最小化到托盘"按钮调用。
#[tauri::command]
pub async fn hide_main_window(app_handle: tauri::AppHandle) -> Result<()> {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.hide();
        tracing::info!("主窗口已隐藏到托盘");
    } else {
        tracing::warn!("未找到 main 窗口，无法隐藏");
    }
    Ok(())
}
