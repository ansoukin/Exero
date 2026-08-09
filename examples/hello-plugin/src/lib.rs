//! Hello Plugin（Exero 官方示例插件 · Phase 3）
//!
//! 演示 Exero 插件系统完整链路：
//! - 侧边栏入口注册（manifest.json sidebar 声明）
//! - iframe UI 页面（index.html 调用 window.exero.invoke）
//! - Rust .dll 动作（say_hello 通过 C ABI 暴露给 Exero）
//!
//! 编译：`cargo build --release`（CARGO_TARGET_DIR 需设置为 C:\cargo-target-dominate）
//! 产物：hello_plugin.dll（Windows）

use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

/// say_hello 动作：返回固定问候语
///
/// 演示最简插件动作：无参数，返回 JSON `{ "message": "Hello from Rust!" }`。
/// 同时被 iframe UI（window.exero.invoke）和 Flow 积木（NativeDllExecutor）调用。
fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

// 声明动作注册表，自动生成 exero_pack_init / exero_pack_cleanup /
// exero_execute_action / exero_last_error 四个 C ABI 导出函数
declare_actions! {
    "say_hello" => say_hello,
}
