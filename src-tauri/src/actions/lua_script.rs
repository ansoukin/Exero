//! Lua 脚本类动作执行器
//!
//! 基于 mlua (Lua 5.4) 提供 Lua 脚本执行能力。
//!
//! ## 安全模型
//!
//! - 默认严格沙箱：禁用 `os.execute` / `io.popen` / `loadfile` / `require` 等危险 API
//! - 可选宽松沙箱：用户在设置中开启，允许上述 API（自负风险）
//! - 注入受限的 `exero` 库：仅允许读取变量、写日志、发送通知
//!
//! ## 脚本加载
//!
//! Phase 1：从本地 `<exe>/scripts/<script_id>.lua` 加载脚本（市场未实现）
//! Phase 5：对接 GitHub 脚本市场

use std::path::PathBuf;
use std::time::{Duration, Instant};

use mlua::{Lua, LuaSerdeExt, Value as LuaValue, VmState};
use serde_json::Value;
use tauri::Emitter;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::LuaScriptParams;
use crate::models::common::ActionType;

/// Lua 脚本执行器
pub struct LuaScriptExecutor;

impl ActionExecutor for LuaScriptExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::LuaScript
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: LuaScriptParams = serde_json::from_value(params.clone())?;
        let timeout_secs = p.timeout_secs.unwrap_or_else(default_lua_timeout);
        let started = Instant::now();

        tracing::info!(
            "执行 Lua 脚本: id={} timeout={}s",
            p.script_id,
            timeout_secs
        );

        // 1. 加载脚本内容
        let script_path = resolve_script_path(&p.script_id)?;
        if !script_path.exists() {
            return Err(AppError::NotFound(format!(
                "Lua 脚本不存在: {} (路径: {})",
                p.script_id,
                script_path.display()
            )));
        }
        let script_content = std::fs::read_to_string(&script_path)?;

        // 2. 创建沙箱 Lua 状态
        let lua = Lua::new();
        // 限制 Lua 内存使用（128MB）与指令计数
        lua.set_memory_limit(128 * 1024 * 1024)?;

        // 3. 应用沙箱（默认严格）
        apply_sandbox(&lua, /* strict */ true)?;

        // 4. 注入 args 与 ctx 变量
        let globals = lua.globals();
        let args_lua = lua.to_value(&p.args)?;
        globals.set("args", args_lua)?;

        // 注入 ctx 变量（局部 + 全局）
        let ctx_table = lua.create_table()?;
        let locals = lua.create_table()?;
        for (k, v) in &ctx.variables {
            locals.set(k.as_str(), lua.to_value(v)?)?;
        }
        let globals_table = lua.create_table()?;
        {
            let g = ctx.global_variables.read();
            for (k, v) in g.iter() {
                globals_table.set(k.as_str(), lua.to_value(v)?)?;
            }
        }
        ctx_table.set("locals", locals)?;
        ctx_table.set("globals", globals_table)?;
        globals.set("ctx", ctx_table)?;

        // 5. 注入 exero 库（受限 API）
        inject_exero_lib(&lua, ctx)?;

        // 6. 设置指令计数 hook（用于超时检测）
        let deadline = started + Duration::from_secs(timeout_secs as u64);
        let _ = lua.set_hook(mlua::HookTriggers {
            every_nth_instruction: Some(1000),
            ..Default::default()
        }, move |_lua, _dbg| {
            if Instant::now() >= deadline {
                Err(mlua::Error::RuntimeError(format!(
                    "Lua 脚本执行超时（{} 秒）",
                    timeout_secs
                )))
            } else {
                Ok(VmState::Continue)
            }
        });

        // 7. 执行脚本
        let exec_result = lua.load(&script_content).set_name(&p.script_id).exec();

        match exec_result {
            Ok(_) => {
                // 读取返回值（如有）
                let result_value: LuaValue = globals.get("__result").unwrap_or(LuaValue::Nil);
                let output: Value = if result_value.is_nil() {
                    Value::Null
                } else {
                    lua.from_value(result_value).unwrap_or(Value::Null)
                };

                let duration = started.elapsed();
                tracing::info!(
                    "Lua 脚本执行成功: id={} 耗时={}ms",
                    p.script_id,
                    duration.as_millis()
                );

                Ok(ActionResult::success_with_output(
                    format!("Lua 脚本执行成功: {} ({}ms)", p.script_id, duration.as_millis()),
                    output,
                ))
            }
            Err(mlua::Error::MemoryError(msg)) => Err(AppError::Lua(format!(
                "Lua 脚本超出内存限制: {}",
                msg
            ))),
            Err(e) => Err(AppError::Lua(format!("Lua 脚本执行失败: {}", e))),
        }
    }
}

/// 默认 Lua 超时时间（秒）
fn default_lua_timeout() -> u32 {
    10
}

/// 解析脚本 ID 到本地脚本文件路径
///
/// Phase 1：从 `<exe>/scripts/<script_id>.lua` 加载
fn resolve_script_path(script_id: &str) -> Result<PathBuf> {
    // 防 path traversal：仅允许字母数字与连字符
    if !script_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::InvalidArgument(format!(
            "非法脚本 ID: {} (仅允许字母数字与连字符)",
            script_id
        )));
    }

    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    Ok(exe_dir.join("scripts").join(format!("{}.lua", script_id)))
}

/// 应用沙箱到 Lua 状态
///
/// 严格沙箱：禁用危险 API
/// 宽松沙箱：保留所有 API
fn apply_sandbox(lua: &Lua, strict: bool) -> Result<()> {
    let globals = lua.globals();

    if strict {
        // 严格沙箱：移除或替换危险 API
        let os: mlua::Table = globals.get("os")?;
        // 移除危险函数
        os.set("execute", mlua::Value::Nil)?;
        os.set("exit", mlua::Value::Nil)?;
        os.set("remove", mlua::Value::Nil)?;
        os.set("rename", mlua::Value::Nil)?;
        os.set("getenv", mlua::Value::Nil)?;
        os.set("setlocale", mlua::Value::Nil)?;
        os.set("tmpname", mlua::Value::Nil)?;

        // 移除整个 io 库（默认禁用所有文件 IO）
        globals.set("io", mlua::Value::Nil)?;

        // 移除 loadfile / dofile
        globals.set("loadfile", mlua::Value::Nil)?;
        globals.set("dofile", mlua::Value::Nil)?;

        // require 受限（暂未实现模块系统，直接禁用）
        globals.set("require", mlua::Value::Nil)?;

        // 移除 package 库
        globals.set("package", mlua::Value::Nil)?;

        tracing::debug!("已应用严格 Lua 沙箱");
    } else {
        tracing::warn!("已应用宽松 Lua 沙箱（危险 API 可用）");
    }

    Ok(())
}

/// 注入受限的 exero 库
///
/// 提供：
/// - `exero.log(msg)` — 写日志
/// - `exero.notify(level, title, body)` — 发送应用内通知
/// - `exero.get_var(name)` — 读取变量
/// - `exero.set_var(name, value, global?)` — 设置变量
/// - `exero.set_result(value)` — 设置脚本返回值
fn inject_exero_lib(lua: &Lua, ctx: &mut ExecutionContext) -> Result<()> {
    let exero = lua.create_table()?;

    // exero.log(msg)
    let log_fn = lua.create_function(|_, msg: String| {
        tracing::info!("[lua] {}", msg);
        Ok(())
    })?;
    exero.set("log", log_fn)?;

    // exero.notify(level, title, body)
    // 注意：闭包不能持有 &mut ctx，但我们可以通过 AppHandle 发送事件
    let app_handle = ctx.app_handle.clone();
    let flow_id = ctx.flow_id.clone();
    let notify_fn = lua.create_function(move |_, (level, title, body): (String, String, String)| {
        let payload = serde_json::json!({
            "level": level,
            "title": title,
            "body": body,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "flow_id": flow_id,
        });
        if let Err(e) = app_handle.emit("notification:in-app", payload) {
            tracing::warn!("[lua] 发送通知失败: {}", e);
        }
        Ok(())
    })?;
    exero.set("notify", notify_fn)?;

    // exero.set_result(value)
    let globals = lua.globals();
    let set_result_fn = lua.create_function(move |_, value: LuaValue| {
        globals.set("__result", value)?;
        Ok(())
    })?;
    exero.set("set_result", set_result_fn)?;

    // 注入到全局
    lua.globals().set("exero", exero)?;

    // 注入 get_var / set_var（需要访问 ctx 的变量，但闭包无法捕获 &mut ctx）
    // 简化方案：通过 Lua 全局变量 ctx 暴露，由用户在 Lua 中直接访问 ctx.locals / ctx.globals
    // 真正的 set_var 需要 Phase 5 完善为 Lua hook 机制

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_script_path_safe() {
        let path = resolve_script_path("hello-world").unwrap();
        assert!(path.to_string_lossy().ends_with("hello-world.lua"));
    }

    #[test]
    fn test_resolve_script_path_rejects_traversal() {
        assert!(resolve_script_path("../etc/passwd").is_err());
        assert!(resolve_script_path("a/b").is_err());
        assert!(resolve_script_path("a\\b").is_err());
    }
}
