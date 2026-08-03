//! Exero 应用库入口
//!
//! 提供 Tauri 应用启动、插件注册、命令暴露等核心功能。

// 模块声明
pub mod db;
pub mod models;
pub mod actions;
pub mod triggers;
pub mod executor;
pub mod error;
pub mod logging;
pub mod commands;
pub mod state;

use std::sync::Arc;

use tauri::Manager;

use crate::state::AppState;

/// 应用启动入口
pub fn run() {
    // 初始化日志系统
    if let Err(e) = logging::init() {
        eprintln!("日志系统初始化失败: {e}");
    }

    tracing::info!("Exero v{} 启动中", env!("CARGO_PKG_VERSION"));

    // 启动 Tauri 应用
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            tracing::info!("执行 setup 回调");
            // 初始化应用状态
            let state = AppState::new(app.handle())?;
            app.manage(Arc::new(state));
            tracing::info!("应用状态已初始化");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 数据库相关命令
            commands::db::ping,
            commands::db::get_db_info,
            commands::db::run_migrations,
            // 快捷指令相关命令
            commands::flows::list_flows,
            commands::flows::get_flow,
            commands::flows::create_flow,
            commands::flows::update_flow,
            commands::flows::delete_flow,
            commands::flows::enable_flow,
            commands::flows::disable_flow,
            // 动作相关命令
            commands::actions::list_actions,
            commands::actions::set_actions,
            // 触发器相关命令
            commands::triggers::list_triggers,
            commands::triggers::set_triggers,
            commands::triggers::enable_trigger,
            commands::triggers::disable_trigger,
            // 执行相关命令
            commands::execution::execute_flow,
            commands::execution::execute_action,
            commands::execution::list_logs,
            commands::execution::clear_logs,
            // 设置相关命令
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            // 学期相关命令
            commands::courses::list_semesters,
            commands::courses::get_semester,
            commands::courses::get_active_semester,
            commands::courses::create_semester,
            commands::courses::update_semester,
            commands::courses::delete_semester,
            // 节次定义命令
            commands::courses::list_class_periods,
            commands::courses::set_class_periods,
            // 周课表模板命令
            commands::courses::list_weekly_templates,
            commands::courses::create_weekly_template,
            commands::courses::update_weekly_template,
            commands::courses::delete_weekly_template,
            // 课程相关命令
            commands::courses::list_courses,
            commands::courses::get_course,
            commands::courses::create_course,
            commands::courses::update_course,
            commands::courses::delete_course,
            // 临时调课命令
            commands::courses::list_overrides,
            commands::courses::list_overrides_by_date,
            commands::courses::create_override,
            commands::courses::delete_override,
            commands::courses::delete_overrides_by_date,
            // 测试命令
            commands::test::e2e_test,
            // 性能优化命令
            commands::performance::get_hardware_status,
            commands::performance::list_processes,
            commands::performance::set_process_priority,
            commands::performance::kill_process,
            commands::performance::one_click_optimize,
            commands::performance::get_optimize_blacklist,
            commands::performance::set_optimize_blacklist,
            // Lua 脚本市场命令
            commands::lua::list_installed_scripts,
            commands::lua::get_script_detail,
            commands::lua::list_market_scripts,
            commands::lua::install_script,
            commands::lua::uninstall_script,
            commands::lua::update_script,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
