//! 动作执行器注册表
//!
//! 维护动作类型到执行器的映射，统一调度执行。
//! V0.4.0-Beta5 新增扩展动作执行器映射（ActionType::Extension）。

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde_json::Value;

use crate::error::{AppError, Result};
use crate::models::common::ActionType;

use super::{ActionExecutor, ActionResult, ExecutionContext};

/// 动作执行器注册表
pub struct ActionExecutorRegistry {
    /// 内置动作执行器映射（ActionType -> Executor）
    executors: RwLock<HashMap<ActionType, Arc<dyn ActionExecutor>>>,
    /// 扩展动作执行器映射（"pack_id:action_id" -> Executor）
    /// V0.4.0-Beta5 新增，支持扩展包提供的 Lua 和 Rust .dll 动作
    extension_executors: RwLock<HashMap<String, Arc<dyn ActionExecutor>>>,
}

impl ActionExecutorRegistry {
    /// 创建空注册表
    pub fn new() -> Self {
        Self {
            executors: RwLock::new(HashMap::new()),
            extension_executors: RwLock::new(HashMap::new()),
        }
    }

    /// 创建注册表并注册所有内置执行器
    pub fn with_builtin_executors() -> Self {
        let registry = Self::new();
        registry.register_builtins();
        registry
    }

    /// 注册单个内置执行器
    pub fn register(&self, executor: Arc<dyn ActionExecutor>) {
        let action_type = executor.action_type();
        tracing::debug!("注册动作执行器: {:?}", action_type);
        self.executors.write().insert(action_type, executor);
    }

    /// 注册扩展动作执行器
    ///
    /// key 格式："pack_id:action_id"
    pub fn register_extension(&self, key: String, executor: Arc<dyn ActionExecutor>) {
        tracing::debug!("注册扩展动作执行器: {}", key);
        self.extension_executors.write().insert(key, executor);
    }

    /// 注销指定扩展包的所有扩展动作执行器
    pub fn unregister_extension_pack(&self, pack_id: &str) {
        let mut executors = self.extension_executors.write();
        let prefix = format!("{}:", pack_id);
        executors.retain(|k, _| !k.starts_with(&prefix));
        tracing::debug!("已注销扩展包 {} 的所有动作执行器", pack_id);
    }

    /// 注册所有内置执行器
    fn register_builtins(&self) {
        use super::{
            app_file, control_flow, lua_script, media_input, notification, system_power,
        };

        self.register(Arc::new(app_file::LaunchProgramExecutor));
        self.register(Arc::new(app_file::KillProcessExecutor));
        self.register(Arc::new(app_file::OpenUrlExecutor));
        self.register(Arc::new(app_file::OpenFileExecutor));

        self.register(Arc::new(media_input::SetVolumeExecutor));
        self.register(Arc::new(media_input::PlaySoundExecutor));
        self.register(Arc::new(media_input::SimulateKeyExecutor));

        self.register(Arc::new(system_power::ShutdownExecutor));
        self.register(Arc::new(system_power::RebootExecutor));
        self.register(Arc::new(system_power::LockScreenExecutor));
        self.register(Arc::new(system_power::HibernateExecutor));
        self.register(Arc::new(system_power::LogoffExecutor));
        self.register(Arc::new(system_power::CleanTempFilesExecutor));
        self.register(Arc::new(system_power::SwitchPowerPlanExecutor));

        self.register(Arc::new(notification::ShowToastExecutor));
        self.register(Arc::new(notification::ShowInAppNotificationExecutor));

        self.register(Arc::new(control_flow::IfElseExecutor));
        self.register(Arc::new(control_flow::LoopExecutor));
        self.register(Arc::new(control_flow::SetVariableExecutor));

        self.register(Arc::new(lua_script::LuaScriptExecutor));

        tracing::info!("已注册 {} 个内置动作执行器", self.executors.read().len());
    }

    /// 执行动作
    pub fn execute(
        &self,
        action_type: &ActionType,
        params: &Value,
        ctx: &mut ExecutionContext,
    ) -> Result<ActionResult> {
        match action_type {
            ActionType::Extension(key) => {
                let executors = self.extension_executors.read();
                let executor = executors.get(key).ok_or_else(|| {
                    AppError::ActionExecution(format!("未注册的扩展动作: {}", key))
                })?;
                executor.execute(params, ctx)
            }
            _ => {
                let executors = self.executors.read();
                let executor = executors.get(action_type).ok_or_else(|| {
                    AppError::ActionExecution(format!("未注册的动作类型: {:?}", action_type))
                })?;
                executor.execute(params, ctx)
            }
        }
    }
}

impl Default for ActionExecutorRegistry {
    fn default() -> Self {
        Self::with_builtin_executors()
    }
}
