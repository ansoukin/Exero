//! Rust .dll 动作执行器（Beta5 · Phase 2）
//!
//! 实现 ActionExecutor trait，将 Rust .dll 动作接入动作执行器注册表。
//! 每个 NativeDllExecutor 实例对应一个 (pack_id, action_id) 组合，
//! 持有 RustLibraryRegistry 的共享引用，执行时通过 C ABI 调用 .dll。
//!
//! 数据流：
//! ```text
//! ChainEngine -> ActionExecutorRegistry::execute
//!   -> NativeDllExecutor::execute
//!     -> RustLibraryRegistry::execute (C ABI)
//!       -> .dll: exero_execute_action(action_id, params_json)
//!     <- JSON 结果字符串
//!   <- ActionResult
//! ```
//!
//! 返回值约定：
//! - .dll 返回非 NULL：成功，JSON 字符串作为 ActionResult.output
//! - .dll 返回 NULL：失败，通过 exero_last_error 获取错误信息（RustLibraryRegistry 已处理）

use std::sync::Arc;

use serde_json::Value;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::common::ActionType;

use super::rust_loader::RustLibraryRegistry;

/// Rust .dll 动作执行器
///
/// 包装 RustLibraryRegistry 的调用能力，实现 ActionExecutor trait。
/// 由 AppState 在加载扩展包时创建并注册到 ActionExecutorRegistry。
pub struct NativeDllExecutor {
    /// Rust 动态库注册表（共享引用）
    registry: Arc<RustLibraryRegistry>,
    /// 扩展包 id
    pack_id: String,
    /// 动作 id（对应 manifest actions[].id）
    action_id: String,
}

impl NativeDllExecutor {
    /// 创建执行器
    ///
    /// key 格式为 `pack_id:action_id`，注册到 ActionExecutorRegistry::extension_executors。
    pub fn new(registry: Arc<RustLibraryRegistry>, pack_id: String, action_id: String) -> Self {
        Self {
            registry,
            pack_id,
            action_id,
        }
    }

    /// 获取扩展动作的注册 key（"pack_id:action_id"）
    pub fn extension_key(&self) -> String {
        format!("{}:{}", self.pack_id, self.action_id)
    }
}

impl ActionExecutor for NativeDllExecutor {
    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        // 参数序列化为 JSON 字符串传给 .dll
        let params_json = serde_json::to_string(params)?;

        // 通过 C ABI 调用 .dll（NULL 返回值已在 RustLibraryRegistry 内转为错误）
        let result_json = self
            .registry
            .execute(&self.pack_id, &self.action_id, &params_json)?;

        // 解析 .dll 返回的 JSON 作为 output
        let output: Value = serde_json::from_str(&result_json).map_err(|e| {
            AppError::ActionExecution(format!(
                "Rust 动作返回值 JSON 解析失败 (pack_id={} action_id={}): {}",
                self.pack_id, self.action_id, e
            ))
        })?;

        Ok(ActionResult::success_with_output(
            format!("Rust 动作 {} 执行完成", self.action_id),
            output,
        ))
    }

    fn action_type(&self) -> ActionType {
        ActionType::Extension(self.extension_key())
    }
}
