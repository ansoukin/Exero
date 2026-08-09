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
pub mod extension_pack;

use std::sync::Arc;

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
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        // 插件 iframe 自定义协议（Phase 3 · SPEC 6.5.3）
        // 注册 `plugin` URI scheme，服务插件安装目录下的前端文件。
        // iframe 通过 `http://plugin.localhost/{pack_id}/{file}` 加载（Windows）。
        .register_uri_scheme_protocol("plugin", |ctx, request| {
            // 路径格式：/{pack_id}/{file_path}
            let path = request.uri().path();
            let path = path.strip_prefix('/').unwrap_or(path);
            let (pack_id, file_path) = match path.split_once('/') {
                Some((id, rest)) => (id, rest),
                None => {
                    return plugin_protocol_response(
                        tauri::http::StatusCode::BAD_REQUEST,
                        "Invalid plugin path",
                    )
                }
            };

            // 通过 UriSchemeContext.app_handle() 获取 AppHandle，再取 AppState
            // （UriSchemeContext 本身不实现 Manager，需先转 AppHandle）
            let app_handle = ctx.app_handle();
            let state = app_handle.state::<Arc<AppState>>();
            let pack = state.extension_pack_registry.get_pack(pack_id);
            let pack = match pack {
                Some(p) => p,
                None => {
                    return plugin_protocol_response(
                        tauri::http::StatusCode::NOT_FOUND,
                        "Plugin not found",
                    )
                }
            };

            // 读取插件前端文件
            let file_path = pack.pack_dir.join(file_path);
            match std::fs::read(&file_path) {
                Ok(data) => {
                    let content_type = guess_content_type(&file_path);
                    // HTML 文件自动注入桥接脚本（提供 window.exero.invoke）
                    // 用 clone 避免 data 被消费后非 HTML 分支无法使用
                    if file_path.extension().and_then(|e| e.to_str()) == Some("html") {
                        if let Ok(html) = String::from_utf8(data.clone()) {
                            let injected = inject_bridge_script(&html);
                            return tauri::http::Response::builder()
                                .header(tauri::http::header::CONTENT_TYPE, content_type)
                                .body(injected.into_bytes())
                                .unwrap();
                        }
                    }
                    tauri::http::Response::builder()
                        .header(tauri::http::header::CONTENT_TYPE, content_type)
                        .body(data)
                        .unwrap()
                }
                Err(_) => plugin_protocol_response(
                    tauri::http::StatusCode::NOT_FOUND,
                    "File not found",
                ),
            }
        })
        .setup(|app| {
            tracing::info!("执行 setup 回调");
            // 初始化应用状态
            let state = AppState::new(app.handle())?;

            // 静默自启检测：以 --autostart 参数启动且 general.silent_autostart=true 时隐藏主窗口
            let is_autostart = std::env::args().any(|a| a == "--autostart");
            if is_autostart {
                let repo = Repository::new(&state.db);
                let silent = repo
                    .get_setting("general.silent_autostart")
                    .ok()
                    .flatten()
                    .map(|s| s.value == "true")
                    .unwrap_or(false);
                if silent {
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.hide();
                        tracing::info!("静默自启：主窗口已隐藏到托盘");
                    }
                }
            }

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

            // 单窗口 boot-splash 方案（Beta3 · SPEC 3.4 重做）
            // main 窗口 visible:true 直接显示，index.html 内置 boot-splash 占位 DOM
            // 前端 React 挂载 + 主题初始化 + onboarding 状态检测完成后隐藏 boot-splash
            // 后端无需管理窗口切换，仅初始化应用状态

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
            // Lua 脚本本地管理命令
            commands::lua::list_installed_scripts,
            commands::lua::get_script_detail,
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
            commands::update::download_and_install_update,
            commands::update::restore_check_frequency,
            commands::update::prepare_force_update,
            commands::update::cleanup_old_installers,
            // 导入导出命令（Phase 6b · SPEC 5.5）
            commands::io::export_data,
            commands::io::import_data,
            // URL 短域名别名命令（Phase 6b · SPEC 11.3）
            commands::url_alias::get_url_aliases,
            commands::url_alias::set_url_aliases,
            commands::url_alias::reset_url_aliases,
            // 扩展包命令（Beta3 · 扩展包架构）
            commands::extension_pack::list_action_catalog,
            commands::extension_pack::list_installed_packs,
            commands::extension_pack::get_pack_detail,
            commands::extension_pack::get_sidebar_entries,
            commands::extension_pack::reload_packs,
            commands::extension_pack::get_extension_pack_user_dir,
            commands::extension_pack::set_extension_pack_user_dir,
            commands::extension_pack::get_pack_dirs_info,
            // 扩展包安装/卸载/打开目录（阶段 c · 扩展市场 UI）
            commands::extension_pack::install_pack_from_file,
            commands::extension_pack::uninstall_pack,
            commands::extension_pack::open_packs_dir,
            // 扩展包在线市场（阶段 c · GitHub 在线安装）
            commands::extension_pack_market::list_market_packs,
            commands::extension_pack_market::install_pack_from_github,
            // 插件动作执行（Phase 3 · 供 iframe 桥接 API 调用）
            commands::extension_pack::execute_plugin_action,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}

// ============================================================
// 插件自定义协议辅助函数（Phase 3）
// ============================================================

/// 构造插件协议错误响应
fn plugin_protocol_response(
    status: tauri::http::StatusCode,
    message: &str,
) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header(tauri::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(message.as_bytes().to_vec())
        .unwrap()
}

/// 根据文件扩展名猜测 Content-Type
fn guess_content_type(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

/// 插件桥接脚本（注入到插件 HTML 的 `<head>` 中）
///
/// 提供 `window.exero.invoke(actionId, params)` 接口：
/// - iframe 内调用 -> 通过 postMessage 向主窗口发送请求
/// - 主窗口接收后调用 Tauri 命令 execute_plugin_action
/// - 结果通过 postMessage 返回 iframe
const PLUGIN_BRIDGE_SCRIPT: &str = r#"<script>
window.exero={invoke:function(a,p){return new Promise(function(r,j){var i=Math.random().toString(36).slice(2);var h=function(e){if(e.data&&e.data.type==='exero-result'&&e.data.id===i){window.removeEventListener('message',h);if(e.data.error)j(new Error(e.data.error));else r(e.data.result);}};window.addEventListener('message',h);window.parent.postMessage({type:'exero-invoke',id:i,actionId:a,params:p||{}},'*');});}};
</script>"#;

/// 向插件 HTML 注入桥接脚本
///
/// 在 `</head>` 前插入，若无 `</head>` 则在文件开头插入。
fn inject_bridge_script(html: &str) -> String {
    if html.contains("</head>") {
        html.replacen("</head>", &format!("{PLUGIN_BRIDGE_SCRIPT}</head>"), 1)
    } else {
        format!("{PLUGIN_BRIDGE_SCRIPT}\n{html}")
    }
}
