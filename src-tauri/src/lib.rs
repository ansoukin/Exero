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
pub mod plugin_storage;
pub mod sensors;

use std::sync::Arc;

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};

use crate::db::Repository;
use crate::state::AppState;

// Windows DWM 物理窗口圆角（Win11+）
// DWMWA_WINDOW_CORNER_PREFERENCE = 33
// DWMWCP_ROUND = 2（系统标准圆角，约 8px）
#[cfg(windows)]
const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
#[cfg(windows)]
const DWMWCP_ROUND: i32 = 2;
/// DWM 边框颜色属性（Win11 22H2+）
#[cfg(windows)]
const DWMWA_BORDER_COLOR: u32 = 34;
/// 无边框颜色值（移除 Win11 原生边框）
#[cfg(windows)]
const DWMWA_COLOR_NONE: u32 = 0xFFFFFFFE;

/// 检测是否 Windows 11（build >= 22000）
/// Win11 才支持 DWM 物理窗口圆角，Win10 不支持
/// B9 第三阶段任务2：改 pub 供 commands/system.rs 的 get_platform_info 暴露给前端
#[cfg(windows)]
pub fn is_windows_11() -> bool {
    use windows_sys::Win32::System::SystemInformation::{
        GetVersionExW, OSVERSIONINFOEXW,
    };
    unsafe {
        let mut info: OSVERSIONINFOEXW = std::mem::zeroed();
        info.dwOSVersionInfoSize = std::mem::size_of::<OSVERSIONINFOEXW>() as u32;
        if GetVersionExW(&mut info as *mut _ as *mut _) != 0 {
            info.dwBuildNumber >= 22000
        } else {
            false
        }
    }
}

/// 应用 DWM 物理窗口圆角（Win11+）
/// 让亚克力在圆角窗口内渲染，避免 4 角三角形溢出
/// Win10 不调用此函数（保持原生矩形）
#[cfg(windows)]
fn apply_dwm_round_corner(hwnd: *mut std::ffi::c_void) {
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    let preference = DWMWCP_ROUND;
    let result = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        )
    };
    if result == 0 {
        tracing::info!("DWM 物理窗口圆角已启用（DWMWCP_ROUND）");
    } else {
        tracing::warn!("DWM 圆角设置失败 hr={}", result);
    }
}

/// 移除 Win11 原生窗口边框颜色（DWMWA_BORDER_COLOR = COLOR_NONE）
/// 根治 transparent 窗口边缘的 1px 黑色直角边框
/// Win10 不支持此属性，静默跳过
#[cfg(windows)]
fn remove_dwm_border_color(hwnd: *mut std::ffi::c_void) {
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    let color = DWMWA_COLOR_NONE;
    let result = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &color as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        )
    };
    if result == 0 {
        tracing::info!("DWM 原生边框颜色已移除（COLOR_NONE）");
    } else {
        tracing::debug!("DWM 边框颜色设置失败 hr={}（Win10 不支持，正常）", result);
    }
}

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
        // 系统级 deep link（Beta8 新增）：注册 `exero://` 协议，
        // 浏览器/网页可唤起本机主程序。方案在 tauri.conf.json > plugins > deep-link 声明，
        // NSIS 安装器自动写入注册表。
        .plugin(tauri_plugin_deep_link::init())
        // 单实例（Beta8 新增）：确保应用只有一个实例，二次唤起时聚焦已有窗口。
        // 配合 deep-link：网页唤起 `exero://` 时，若已在运行则聚焦主窗口而非新开实例。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 已有实例被再次唤起时，聚焦主窗口
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
                tracing::info!("单实例唤起：聚焦主窗口");
            }
        }))
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
        // 插件本地文件协议（Phase 3 补充 · SPEC 6.5.4）
        // 注册 `local-file` URI scheme，让插件 iframe 能加载本地文件（如音频/图片）。
        // iframe sandbox 禁止 file:/// 访问，通过此协议中转读取本地文件。
        // 访问格式（Windows）：http://local-file.localhost/{url-encoded-path}
        .register_uri_scheme_protocol("local-file", |_ctx, request| {
            // 路径格式：/{url-encoded-file-path}
            let path = request.uri().path();
            let path = path.strip_prefix('/').unwrap_or(path);

            // URL 解码文件路径（手动解码 %XX 序列）
            let decoded = match url_decode(path) {
                Ok(s) => s,
                Err(msg) => {
                    return plugin_protocol_response(
                        tauri::http::StatusCode::BAD_REQUEST,
                        msg,
                    )
                }
            };

            // 获取文件元信息（大小用于 Content-Range 响应）
            let file_size = match std::fs::metadata(&decoded) {
                Ok(m) => m.len(),
                Err(_) => {
                    return plugin_protocol_response(
                        tauri::http::StatusCode::NOT_FOUND,
                        "Local file not found",
                    );
                }
            };

            let content_type = guess_content_type(std::path::Path::new(&decoded));

            // 解析 Range 请求头（格式：bytes=start-end）
            // 浏览器 seek 音频/视频时会发送 Range 请求
            let range_header = request
                .headers()
                .get(tauri::http::header::RANGE)
                .and_then(|v| v.to_str().ok());

            if let Some(range_str) = range_header {
                if let Some(range_part) = range_str.strip_prefix("bytes=") {
                    let parts: Vec<&str> = range_part.splitn(2, '-').collect();
                    if parts.len() == 2 {
                        let start: u64 = parts[0].parse().unwrap_or(0);
                        let end: u64 = if parts[1].is_empty() {
                            file_size - 1
                        } else {
                            parts[1].parse().unwrap_or(file_size - 1)
                        };

                        if start < file_size && start <= end {
                            let length = end - start + 1;
                            let mut file = match std::fs::File::open(&decoded) {
                                Ok(f) => f,
                                Err(_) => {
                                    return plugin_protocol_response(
                                        tauri::http::StatusCode::NOT_FOUND,
                                        "Local file not found",
                                    );
                                }
                            };
                            use std::io::{Read, Seek, SeekFrom};
                            let _ = file.seek(SeekFrom::Start(start));
                            let mut buffer = vec![0u8; length as usize];
                            let _ = file.read_exact(&mut buffer);

                            return tauri::http::Response::builder()
                                .status(206)
                                .header(tauri::http::header::CONTENT_TYPE, content_type)
                                .header(tauri::http::header::CONTENT_LENGTH, length)
                                .header(
                                    tauri::http::header::CONTENT_RANGE,
                                    format!("bytes {}-{}/{}", start, end, file_size),
                                )
                                .header(tauri::http::header::ACCEPT_RANGES, "bytes")
                                .header(tauri::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                                .header(tauri::http::header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
                                .header(tauri::http::header::ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Range, Content-Length")
                                .body(buffer)
                                .unwrap();
                        }
                    }
                }
            }

            // 无 Range 请求：返回整个文件
            match std::fs::read(&decoded) {
                Ok(data) => tauri::http::Response::builder()
                    .header(tauri::http::header::CONTENT_TYPE, content_type)
                    .header(tauri::http::header::ACCEPT_RANGES, "bytes")
                    .header(tauri::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .header(tauri::http::header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
                    .header(tauri::http::header::ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Range, Content-Length")
                    .body(data)
                    .unwrap(),
                Err(_) => plugin_protocol_response(
                    tauri::http::StatusCode::NOT_FOUND,
                    "Local file not found",
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

            // 启动时应用窗口效果（Beta9 · 任务17 · 最终修复 2026-08-15）
            // 产品策略（最终方案）：
            // - 使用 Tauri 原生 Effect::Acrylic 系统级 DWM 模糊（模糊的就是桌面壁纸本身）
            //   （CSS backdrop-filter 物理上无法模糊壁纸：Chromium backdrop 只含同渲染树内容，
            //    全透明窗口里 blur 模糊的是"空气"，已实测确认并废弃）
            // - Win11：DWMWCP_ROUND 物理圆角，DWM 沿窗口圆角自行裁剪亚克力（根治边缘溢出）
            // - Win10：亚克力降级为 ACCENT_ENABLE_ACRYLICBLURBEHIND（矩形，系统限制可接受）
            // - CSS 层保留半透明着色 + 噪点 + 光影，与系统模糊叠加成完整亚克力质感
            // - DB 的 acrylic_enabled 运行时切换走 set_theme_config → apply_acrylic
            {
                let state_ref = app.state::<Arc<AppState>>();
                let repo = Repository::new(&state_ref.db);
                let acrylic_enabled = repo
                    .get_setting(crate::models::theme::keys::ACRYLIC_ENABLED)
                    .ok()
                    .flatten()
                    .and_then(|s| s.as_bool())
                    .unwrap_or(true);

                if let Some(main) = app.get_webview_window("main") {
                    // 1. set_background_color: WebView2 背景透明（防白底，亚克力透出的前提）
                    // 2. shadow:false（tauri.conf.json）：禁用 DWM 阴影
                    // 3. DWMWA_BORDER_COLOR = COLOR_NONE：移除 Win11 原生边框颜色（根治 1px 黑边）
                    // 4. DWMWCP_ROUND：Win11 物理圆角（DWM 自行裁剪系统亚克力，无溢出）
                    // 5. Effect::Acrylic：系统级模糊桌面壁纸
                    // 6. CSS clip-path + 着色层 + 噪点 + 光影：内容圆角与质感（Layout.tsx / index.css）
                    use tauri::window::Color;
                    let _ = main.set_background_color(Some(Color(0, 0, 0, 0)));

                    #[cfg(windows)]
                    {
                        if let Ok(hwnd) = main.hwnd() {
                            if is_windows_11() {
                                apply_dwm_round_corner(hwnd.0);
                            }
                            remove_dwm_border_color(hwnd.0);
                        }
                    }

                    if let Err(e) =
                        crate::commands::theme::apply_acrylic(&main, acrylic_enabled)
                    {
                        tracing::warn!("启动应用亚克力失败: {e}");
                    }

                    tracing::info!(
                        "窗口效果初始化完成（系统 Acrylic + DWM 圆角，enabled={}）",
                        acrylic_enabled
                    );
                }

                // 托盘菜单窗口也应用 DWM 圆角（Win11）
                // 只需设置一次，后续 show/hide 不影响
                #[cfg(windows)]
                {
                    if let Some(menu_window) = app.get_webview_window("tray-menu") {
                        if let Ok(hwnd) = menu_window.hwnd() {
                            if is_windows_11() {
                                apply_dwm_round_corner(hwnd.0);
                            }
                        }
                    }
                }
            }

            // 系统托盘创建（Beta9 · 任务4：自绘透明窗口菜单，移除原生 Menu）
            // 左键单击显示主窗口，右键单击显示自绘 tray-menu 窗口
            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Exero")
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    match event {
                        // 左键单击：显示主窗口
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(main) = app.get_webview_window("main") {
                                let _ = main.show();
                                let _ = main.unminimize();
                                let _ = main.set_focus();
                            }
                        }
                        // 右键单击：显示自绘 tray-menu 窗口（位置对齐托盘图标顶部）
                        TrayIconEvent::Click {
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            rect,
                            ..
                        } => {
                            if let Some(menu_window) = app.get_webview_window("tray-menu") {
                                // 计算位置：菜单底部对齐托盘图标顶部，水平居中
                                // 菜单窗口 160x114，居中偏移 -80
                                let (px, py) = match rect.position {
                                    tauri::Position::Physical(p) => (p.x, p.y),
                                    tauri::Position::Logical(p) => (p.x as i32, p.y as i32),
                                };
                                let (sw, _sh) = match rect.size {
                                    tauri::Size::Physical(s) => (s.width as i32, s.height as i32),
                                    tauri::Size::Logical(s) => (s.width as i32, s.height as i32),
                                };
                                // x：托盘图标中心 - 菜单宽度一半（160/2=80）
                                let x = (px + sw / 2 - 80).max(0);
                                // y：托盘图标顶部 - 菜单高度（114），钳制到屏幕工作区
                                let y = (py - 114).max(0);
                                let _ = menu_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                    x,
                                    y,
                                }));
                                let _ = menu_window.set_always_on_top(true);
                                let _ = menu_window.show();
                                let _ = menu_window.set_focus();
                            }
                        }
                        _ => {}
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

            // 启动 LHM 传感器子进程（Beta9 · 任务3，GPU/CPU/温度数据源）
            // 找不到 NexBoxMonitor.exe 时静默跳过，性能页 GPU 卡片降级显示"--"
            sensors::start_sensor_process(app);

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
            commands::system::restart_app,
            // 平台信息（B9 第三阶段 · 任务2：Win10 圆角/亚克力互斥判断）
            commands::system::get_platform_info,
            // 托盘菜单"检查更新"命令（Beta9 任务4）
            commands::system::check_update_and_show,
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
            // 插件存储（Phase 3 补充 · 供 iframe 桥接 API 调用）
            commands::plugin_storage::plugin_storage_get,
            commands::plugin_storage::plugin_storage_set,
            commands::plugin_storage::plugin_storage_remove,
            commands::plugin_storage::plugin_storage_clear,
            commands::plugin_storage::plugin_storage_keys,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");

    // 应用退出清理（Beta9 · 任务3：停止 LHM 子进程）
    // run() 返回后执行
    if let Some(bridge) = sensors::bridge::take_bridge() {
        let mut bridge = bridge;
        bridge.shutdown();
        tracing::info!("NexBoxMonitor 子进程已关闭");
    }
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

/// URL 解码（手动解码 %XX 序列，避免引入额外 crate）
fn url_decode(s: &str) -> Result<String, &'static str> {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = &s[i + 1..i + 3];
            match u8::from_str_radix(hex, 16) {
                Ok(b) => {
                    result.push(b);
                    i += 3;
                }
                Err(_) => return Err("Invalid percent encoding"),
            }
        } else {
            result.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(result).map_err(|_| "Invalid UTF-8 in decoded path")
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
        // 音频格式（local-file 协议需要）
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        // 图片格式（封面等）
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

/// 插件桥接脚本（注入到插件 HTML 的 `<head>` 中）
///
/// 提供三套接口：
/// - `window.exero.invoke(actionId, params)`：调用插件 Rust .dll 动作
/// - `window.exero.storage.*`：读写宿主持久化存储（Phase 3 补充）
/// - `window.exero.getTheme()` / `onTheme(cb)`：明暗适配（B9 第三阶段任务6）
///   getTheme 主动查询当前生效主题（"light"/"dark"，已应用手动覆盖）；
///   onTheme 订阅主题变化（宿主在 iframe 加载完成、应用切换明暗、
///   设置页手动配置变化时推送 {type:"exero-theme"}，iframe 不重载）
///
/// 通信方式均为 postMessage，由主窗口（PluginHostLayer）转发到对应 Tauri 命令，
/// 结果再通过 postMessage 返回 iframe。
const PLUGIN_BRIDGE_SCRIPT: &str = r#"<script>
window.exero={_post:function(m){return new Promise(function(r,j){var i=Math.random().toString(36).slice(2);var h=function(e){if(e.data&&e.data.type==='exero-result'&&e.data.id===i){window.removeEventListener('message',h);if(e.data.error)j(new Error(e.data.error));else r(e.data.result);}};window.addEventListener('message',h);m.id=i;window.parent.postMessage(m,'*');});},invoke:function(a,p){return window.exero._post({type:'exero-invoke',actionId:a,params:p||{}});},getTheme:function(){return window.exero._post({type:'exero-get-theme'});},onTheme:function(cb){window.addEventListener('message',function(e){if(e.data&&e.data.type==='exero-theme'){cb(e.data.theme);}});},storage:{get:function(k){return window.exero._post({type:'exero-storage',op:'get',key:k});},set:function(k,v){return window.exero._post({type:'exero-storage',op:'set',key:k,value:v});},remove:function(k){return window.exero._post({type:'exero-storage',op:'remove',key:k});},clear:function(){return window.exero._post({type:'exero-storage',op:'clear'});},keys:function(){return window.exero._post({type:'exero-storage',op:'keys'});}}};
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
