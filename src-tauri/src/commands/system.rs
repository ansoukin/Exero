//! 系统集成命令（Phase 6a · SPEC 4.1）
//!
//! 提供应用退出、窗口隐藏等系统集成相关命令，
//! 供前端关闭行为弹窗与托盘交互调用。

use tauri::{Emitter, Manager};

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

/// 平台信息（B9 第三阶段 · 任务2）
///
/// 暴露 Windows 版本判断给前端：
/// - Win11：窗口圆角恒开（DWM 物理圆角，Windows 特性），亚克力可选
/// - Win10：圆角/亚克力互斥（外观设置两个开关拨一个自动关另一个）
#[derive(Debug, Clone, serde::Serialize)]
pub struct PlatformInfo {
    /// 是否 Windows 11（build >= 22000）
    pub is_windows_11: bool,
}

/// 获取平台信息（B9 第三阶段 · 任务2）
#[tauri::command]
pub async fn get_platform_info() -> Result<PlatformInfo> {
    #[cfg(windows)]
    let is_win11 = crate::is_windows_11();

    #[cfg(not(windows))]
    let is_win11 = false;

    Ok(PlatformInfo { is_windows_11: is_win11 })
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

/// 重启应用（Beta6 · OOBE 字体安装后重启）
///
/// Tauri v2 AppHandle::restart：退出当前进程并启动新实例。
#[tauri::command]
pub async fn restart_app(app_handle: tauri::AppHandle) -> Result<()> {
    tracing::info!("用户请求重启应用");
    app_handle.restart();
    // restart() 不会返回，但 Rust 类型系统要求返回 Result
    #[allow(unreachable_code)]
    Ok(())
}

/// 检查更新并显示主窗口（Beta9 · 任务4，托盘菜单"检查更新"项调用）
///
/// 显示主窗口并 emit "check-update" 事件，主窗口前端监听后触发更新检查。
#[tauri::command]
pub async fn check_update_and_show(app_handle: tauri::AppHandle) -> Result<()> {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    let _ = app_handle.emit("check-update", ());
    Ok(())
}
