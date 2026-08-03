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
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};

use crate::db::Repository;
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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tracing::info!("执行 setup 回调");
            // 初始化应用状态
            let state = AppState::new(app.handle())?;
            app.manage(Arc::new(state));
            tracing::info!("应用状态已初始化");

            // 系统托盘创建（Phase 6a · SPEC 4.1）
            // 菜单：显示主窗口 / 退出
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Exero")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(main) = app.get_webview_window("main") {
                                let _ = main.show();
                                let _ = main.set_focus();
                                tracing::info!("托盘菜单：显示主窗口");
                            }
                        }
                        "quit" => {
                            tracing::info!("托盘菜单：退出应用");
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // 单击托盘图标显示主窗口
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(main) = app.get_webview_window("main") {
                            let _ = main.show();
                            let _ = main.set_focus();
                        }
                    }
                });

            // 设置托盘图标（复用窗口默认图标）
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;
            tracing::info!("系统托盘已创建");

            // Splash → main 窗口切换（Phase 6a · SPEC 3.4）
            // 有 splash 窗口时延迟 1.5 秒关闭 splash 显示 main（让用户看到进度条动画）
            // 无 splash 窗口时直接显示 main
            let main_window = app.get_webview_window("main");
            let splash_window = app.get_webview_window("splash");
            match (main_window, splash_window) {
                (Some(main), Some(splash)) => {
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(1500)).await;
                        let _ = splash.close();
                        let _ = main.show();
                        let _ = main.set_focus();
                        tracing::info!("Splash 关闭，主窗口已显示");
                    });
                }
                (Some(main), None) => {
                    let _ = main.show();
                    tracing::info!("无 splash 窗口，直接显示主窗口");
                }
                _ => {
                    tracing::warn!("未找到 main 窗口，无法显示");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭行为拦截（Phase 6a · SPEC 4.2）
            // 仅拦截 main 窗口的关闭事件
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<Arc<AppState>>();
                let repo = Repository::new(&state.db);

                // 读取关闭行为设置，默认 "ask"
                let behavior = repo
                    .get_setting("general.close_behavior")
                    .ok()
                    .flatten()
                    .map(|s| s.value)
                    .unwrap_or_else(|| "ask".to_string());

                match behavior.as_str() {
                    "minimize" => {
                        // 直接隐藏到托盘
                        let _ = window.hide();
                        api.prevent_close();
                        tracing::info!("主窗口已隐藏到托盘（close_behavior=minimize）");
                    }
                    "exit" => {
                        // 不拦截，正常关闭
                        tracing::info!("主窗口正常关闭（close_behavior=exit）");
                    }
                    _ => {
                        // ask 模式：emit 事件给前端显示弹窗
                        let _ = app.emit("window:close-requested", ());
                        api.prevent_close();
                        tracing::info!("已请求前端显示关闭行为弹窗（close_behavior=ask）");
                    }
                }
            }
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
            // 主题命令（Phase 6a）
            commands::theme::get_theme_config,
            commands::theme::set_theme_config,
            // 系统集成命令（Phase 6a）
            commands::system::exit_app,
            commands::system::hide_main_window,
            // 课表初始化向导命令（Phase 6a · SPEC 11.2）
            commands::onboarding::get_onboarding_status,
            commands::onboarding::complete_onboarding,
            commands::onboarding::load_demo_data,
            commands::onboarding::skip_onboarding,
            commands::onboarding::reset_schedule_data,
            // 更新检查与应用信息命令（Phase 6b · SPEC 3.5 分区 3 / 第七章）
            commands::update::get_app_info,
            commands::update::check_for_updates,
            commands::update::get_changelog,
            commands::update::get_changelog_path,
            // 导入导出命令（Phase 6b · SPEC 5.5）
            commands::io::export_data,
            commands::io::import_data,
            // URL 短域名别名命令（Phase 6b · SPEC 11.3）
            commands::url_alias::get_url_aliases,
            commands::url_alias::set_url_aliases,
            commands::url_alias::reset_url_aliases,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
