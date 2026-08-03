//! 主题命令（SPEC 3.2 主题系统）
//!
//! 提供主题配置读写与 Mica 窗口效果应用。
//! 主题配置持久化到 settings 表（key 前缀 `theme.`）。

use std::sync::Arc;

use tauri::{Manager, State, WebviewWindow};
use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectState};

use crate::db::Repository;
use crate::error::{AppError, Result};
use crate::models::setting::Setting;
use crate::models::theme::{keys, ThemeColor, ThemeConfig, ThemeMode};
use crate::state::AppState;

/// 读取主题配置
///
/// 从 settings 表读取 theme.mode / theme.color / theme.mica_enabled，
/// 缺失项回退到默认值（system / blue / false）。
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

    let mica_enabled = repo
        .get_setting(keys::MICA_ENABLED)
        .ok()
        .flatten()
        .and_then(|s| s.as_bool())
        .unwrap_or(false);

    Ok(ThemeConfig {
        mode,
        color,
        mica_enabled,
    })
}

/// 保存主题配置并立即应用
///
/// 1. 写入 settings 表（3 个 key）
/// 2. 应用 Mica 窗口效果（若启用）
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
        keys::MICA_ENABLED,
        config.mica_enabled,
    ))?;

    // 应用 Mica 窗口效果
    if let Some(window) = app_handle.get_webview_window("main") {
        apply_mica(&window, config.mica_enabled)?;
    } else {
        tracing::warn!("未找到 main 窗口，跳过 Mica 应用");
    }

    tracing::info!(
        "主题配置已保存：mode={:?}, color={:?}, mica={}",
        config.mode,
        config.color,
        config.mica_enabled
    );

    Ok(config)
}

/// 应用 Mica 窗口效果（Windows 11 22000+）
///
/// 启用时设置 Mica 背景效果，禁用时清除效果恢复纯色背景。
/// 注意：Mica 需要 decorations:false + 自定义标题栏才能完整呈现。
fn apply_mica(window: &WebviewWindow, enabled: bool) -> Result<()> {
    let effects = if enabled {
        WindowEffectsConfig {
            effects: vec![Effect::Mica],
            state: Some(EffectState::Active),
            radius: None,
            color: None,
        }
    } else {
        WindowEffectsConfig {
            effects: vec![],
            state: None,
            radius: None,
            color: None,
        }
    };

    window
        .set_effects(effects)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}
