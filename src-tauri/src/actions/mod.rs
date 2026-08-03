//! 动作执行器模块
//!
//! 为每种动作类型实现具体的执行逻辑。每个执行器接收参数与上下文，
//! 返回执行结果。所有执行器共享统一的签名与错误处理。

pub mod registry;
pub mod app_file;
pub mod media_input;
pub mod system_power;
pub mod notification;
pub mod control_flow;
pub mod lua_script;

pub use registry::ActionExecutorRegistry;

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::error::Result;
use crate::models::common::ActionType;

/// 全局变量池
///
/// 跨动作链共享的变量存储，使用 RwLock 保护并发访问。
/// 由 AppState 持有并在创建 ExecutionContext 时传入引用。
pub type GlobalVariables = Arc<RwLock<HashMap<String, Value>>>;

/// 执行上下文
///
/// 在动作链执行过程中传递的上下文，包含变量与状态。
pub struct ExecutionContext {
    /// 局部变量（仅在当前动作链内可见）
    pub variables: HashMap<String, Value>,
    /// 全局变量（跨动作链可见，存储在内存中）
    pub global_variables: GlobalVariables,
    /// 当前快捷指令 ID
    pub flow_id: String,
    /// Tauri 应用句柄（用于发送事件、调用插件等）
    pub app_handle: AppHandle,
    /// 当前循环层数（用于 break/continue 控制，由执行引擎维护）
    pub loop_depth: u32,
    /// 是否请求跳出当前循环
    pub break_requested: bool,
    /// 是否请求跳过本次循环剩余动作
    pub continue_requested: bool,
    /// 是否请求停止整个动作链
    pub stop_requested: bool,
    /// Lua 沙箱是否严格模式（true=严格禁用危险 API，false=宽松）
    /// 由 ChainEngine 在创建上下文时从 settings 读取注入
    pub lua_sandbox_strict: bool,
}

impl ExecutionContext {
    pub fn new(flow_id: impl Into<String>, app_handle: AppHandle, globals: GlobalVariables) -> Self {
        Self {
            variables: HashMap::new(),
            global_variables: globals,
            flow_id: flow_id.into(),
            app_handle,
            loop_depth: 0,
            break_requested: false,
            continue_requested: false,
            stop_requested: false,
            lua_sandbox_strict: true,
        }
    }

    /// 设置变量
    pub fn set_var(&mut self, name: &str, value: Value, global: bool) {
        if global {
            self.global_variables.write().insert(name.to_string(), value);
        } else {
            self.variables.insert(name.to_string(), value);
        }
    }

    /// 获取变量（先查局部再查全局）
    pub fn get_var(&self, name: &str) -> Option<Value> {
        if let Some(v) = self.variables.get(name) {
            return Some(v.clone());
        }
        self.global_variables.read().get(name).cloned()
    }

    /// 模板插值：将字符串中的 `{var_name}` 替换为变量值
    ///
    /// 支持简单占位符替换。复杂表达式（如 `{a} + {b}`）由 Lua 节点处理。
    pub fn interpolate(&self, template: &str) -> String {
        let mut result = template.to_string();
        // 先替换局部变量
        for (k, v) in self.variables.iter() {
            let placeholder = format!("{{{}}}", k);
            let replacement = match v {
                Value::String(s) => s.clone(),
                _ => v.to_string(),
            };
            result = result.replace(&placeholder, &replacement);
        }
        // 再替换全局变量（局部未命中的占位符）
        let globals = self.global_variables.read();
        for (k, v) in globals.iter() {
            let placeholder = format!("{{{}}}", k);
            let replacement = match v {
                Value::String(s) => s.clone(),
                _ => v.to_string(),
            };
            result = result.replace(&placeholder, &replacement);
        }
        result
    }

    /// 发送应用内通知事件到前端
    ///
    /// 前端监听 `notification:in-app` 事件并在通知中心显示。
    pub fn emit_in_app_notification(&self, level: &str, title: &str, body: &str) {
        let payload = serde_json::json!({
            "level": level,
            "title": title,
            "body": body,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "flow_id": self.flow_id,
        });
        if let Err(e) = self.app_handle.emit("notification:in-app", payload) {
            tracing::warn!("发送应用内通知事件失败: {}", e);
        }
    }

    /// 请求停止整个动作链
    pub fn request_stop(&mut self) {
        self.stop_requested = true;
    }

    /// 请求跳出当前循环
    pub fn request_break(&mut self) {
        self.break_requested = true;
    }

    /// 请求跳过本次循环剩余动作
    pub fn request_continue(&mut self) {
        self.continue_requested = true;
    }
}

/// 动作执行结果
#[derive(Debug, Clone)]
pub struct ActionResult {
    /// 是否成功
    pub success: bool,
    /// 输出值（可作为下游动作的输入）
    pub output: Option<Value>,
    /// 消息（用于日志）
    pub message: String,
}

impl ActionResult {
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            success: true,
            output: None,
            message: message.into(),
        }
    }

    pub fn success_with_output(message: impl Into<String>, output: Value) -> Self {
        Self {
            success: true,
            output: Some(output),
            message: message.into(),
        }
    }

    pub fn failure(message: impl Into<String>) -> Self {
        Self {
            success: false,
            output: None,
            message: message.into(),
        }
    }
}

/// 动作执行器 trait
///
/// 所有动作执行器实现此 trait，由注册表统一调度。
pub trait ActionExecutor: Send + Sync {
    /// 执行动作
    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult>;

    /// 该执行器处理的动作类型
    fn action_type(&self) -> ActionType;
}
