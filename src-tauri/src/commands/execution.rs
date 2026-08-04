//! 执行与日志命令

use std::sync::Arc;

use chrono::{DateTime, Utc};
use tauri::State;

use crate::db::Repository;
use crate::error::{AppError, Result};
use crate::models::{ExecutionLog, LogFilter};
use crate::state::AppState;

/// 执行整条快捷指令
///
/// 由前端手动触发或调度器调用。
#[tauri::command]
pub async fn execute_flow(state: State<'_, Arc<AppState>>, flow_id: String) -> Result<ExecutionLog> {
    // 使用 spawn_blocking 让执行在独立线程上运行，避免阻塞 tokio runtime
    let engine = state.chain_engine.clone();
    tokio::task::spawn_blocking(move || engine.execute_flow(&flow_id))
        .await
        .map_err(|e| AppError::Other(format!("执行任务 panic: {}", e)))?
}

/// 执行单个动作（调试用）
///
/// 不需要完整的 Flow 上下文，使用临时 ExecutionContext。
#[tauri::command]
pub async fn execute_action(
    state: State<'_, Arc<AppState>>,
    action_type: crate::models::common::ActionType,
    params: serde_json::Value,
) -> Result<serde_json::Value> {
    use crate::actions::ExecutionContext;

    let app_handle = state.app_handle.clone();
    let global_variables = state.global_variables.clone();
    let registry = state.registry.clone();

    tokio::task::spawn_blocking(move || {
        let mut ctx = ExecutionContext::new("debug", app_handle, global_variables);
        let result = registry.execute(&action_type, &params, &mut ctx)?;
        Ok(serde_json::json!({
            "success": result.success,
            "message": result.message,
            "output": result.output,
        }))
    })
    .await
    .map_err(|e| AppError::Other(format!("执行任务 panic: {}", e)))?
}

/// 查询执行日志
#[tauri::command]
pub async fn list_logs(
    state: State<'_, Arc<AppState>>,
    filter: Option<LogFilter>,
) -> Result<Vec<ExecutionLog>> {
    let repo = Repository::new(&state.db);
    repo.list_logs(&filter.unwrap_or_default())
}

/// 清空执行日志
///
/// - `before`：可选 RFC3339 时间字符串，删除该时间点及之后的日志；`None` 清空全部。
/// - 返回被删除的记录数。
#[tauri::command]
pub async fn clear_logs(
    state: State<'_, Arc<AppState>>,
    before: Option<String>,
) -> Result<usize> {
    let before_dt = match before {
        Some(s) => Some(
            DateTime::parse_from_rfc3339(&s)
                .map_err(|e| AppError::Other(format!("无效的时间格式: {}", e)))?
                .with_timezone(&Utc),
        ),
        None => None,
    };
    let repo = Repository::new(&state.db);
    repo.clear_logs(before_dt)
}
