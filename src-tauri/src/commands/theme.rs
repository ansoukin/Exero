//! 主题命令（SPEC 3.2 主题系统）
//!
//! 提供主题配置读写（Acrylic 使用 Tauri 原生窗口效果，系统级 DWM 模糊）。
//! 主题配置持久化到 settings 表（key 前缀 `theme.`）。

use std::sync::Arc;

use tauri::{Manager, State, WebviewWindow};

use crate::db::Repository;
use crate::error::Result;
use crate::models::setting::Setting;
use crate::models::theme::{keys, ThemeColor, ThemeConfig, ThemeMode};
use crate::state::AppState;

/// 读取主题配置
///
/// 从 settings 表读取 theme.mode / theme.color / theme.acrylic_enabled，
/// 缺失项回退到默认值（system / blue / true）。
#[tauri::command]
pub async fn get_theme_config(state: State<'_, Arc<AppState>>) -> Result<ThemeConfig> {
    let repo = Repository::new(&state.db);

    let mode = repo
        .get_setting(keys::MODE)
        .ok()
        .flatten()
        .map(|s| ThemeMode::parse(&s.value))
        .unwrap_or_default();

    let color = repo
        .get_setting(keys::COLOR)
        .ok()
        .flatten()
        .map(|s| ThemeColor::parse(&s.value))
        .unwrap_or_default();

    let acrylic_enabled = repo
        .get_setting(keys::ACRYLIC_ENABLED)
        .ok()
        .flatten()
        .and_then(|s| s.as_bool())
        // 默认开启；低性能机器可在设置里关闭
        .unwrap_or(true);

    Ok(ThemeConfig {
        mode,
        color,
        acrylic_enabled,
    })
}

/// 保存主题配置并立即应用
///
/// 1. 写入 settings 表（3 个 key）
/// 2. 应用 Acrylic 窗口效果（按开关）
#[tauri::command]
pub async fn set_theme_config(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    config: ThemeConfig,
) -> Result<ThemeConfig> {
    let repo = Repository::new(&state.db);

    // 写入 settings 表
    repo.set_setting(&Setting::from_string(
        keys::MODE,
        config.mode.as_str(),
    ))?;
    repo.set_setting(&Setting::from_string(
        keys::COLOR,
        config.color.as_str(),
    ))?;
    repo.set_setting(&Setting::from_bool(
        keys::ACRYLIC_ENABLED,
        config.acrylic_enabled,
    ))?;

    // 应用 Acrylic 窗口效果
    if let Some(window) = app_handle.get_webview_window("main") {
        apply_acrylic(&window, config.acrylic_enabled)?;
    } else {
        tracing::warn!("未找到 main 窗口，跳过 Acrylic 应用");
    }

    tracing::info!(
        "主题配置已保存：mode={:?}, color={:?}, acrylic={}",
        config.mode,
        config.color,
        config.acrylic_enabled
    );

    Ok(config)
}

/// 应用 Acrylic 窗口效果（Tauri 原生系统级 DWM 模糊）
///
/// Beta9 最终修复（2026-08-15）：CSS backdrop-filter 物理上无法模糊桌面壁纸
/// （Chromium 的 backdrop 只包含同一 WebView 渲染树内元素背后的内容，
/// html/body/#root 全透明后 blur 模糊的是"空气"），切回 Tauri 原生效果：
/// - Win11 22H2+：DWMSB_TRANSIENTWINDOW 系统 backdrop（模糊桌面壁纸本身）
/// - Win10 / 旧 Win11：ACCENT_ENABLE_ACRYLICBLURBEHIND（window-vibrancy 自动降级）
/// - 边缘溢出问题由 DWMWCP_ROUND 物理圆角根治（DWM 沿窗口圆角自行裁剪亚克力）
/// - 前端 CSS 保留半透明着色 + 噪点 + 光影层，与系统模糊叠加成完整亚克力质感
pub fn apply_acrylic(window: &WebviewWindow, enabled: bool) -> Result<()> {
    use tauri::window::{Effect, EffectsBuilder};

    if enabled {
        window.set_effects(EffectsBuilder::new().effect(Effect::Acrylic).build())?;
    } else {
        // 传 None 清除全部窗口效果（window-vibrancy clear_acrylic），回退纯色背景
        window.set_effects(None::<tauri::utils::config::WindowEffectsConfig>)?;
    }
    Ok(())
}
