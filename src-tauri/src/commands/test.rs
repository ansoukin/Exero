//! 端到端测试命令
//!
//! 用于 Phase 1 验证完整链路：创建 Flow → 添加动作 → 执行 → 查询日志。
//!
//! 调用方式：`invoke('e2e_test', {})`

use std::sync::Arc;

use serde_json::json;
use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::common::{ActionType, ExecutionStatus, FaultStrategy, TriggerType};
use crate::models::{
    Action, CreateFlowRequest, CronTriggerParams, ExecutionLog, LogFilter, Trigger,
};
use crate::state::AppState;

/// 端到端测试
///
/// 执行步骤：
/// 1. 创建一个临时 Flow（名为 "[E2E] 测试指令"）
/// 2. 添加一个 SetVariable 动作（设置测试变量）
/// 3. 添加一个 Cron 触发器（5 分钟后触发，验证表达式解析）
/// 4. 立即执行该 Flow
/// 5. 查询最近执行日志
/// 6. 返回测试结果摘要
#[tauri::command]
pub async fn e2e_test(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value> {
    tracing::info!("开始端到端测试");

    let repo = Repository::new(&state.db);

    // 1. 创建 Flow
    let flow = repo.create_flow(CreateFlowRequest {
        name: "[E2E] 测试指令".to_string(),
        description: Some("Phase 1 端到端测试，可安全删除".to_string()),
        icon: Some("FlaskConical".to_string()),
        color: Some("#FFA500".to_string()),
    })?;
    repo.enable_flow(&flow.id)?;
    tracing::info!("[E2E] 创建 Flow: id={}", flow.id);

    // 2. 添加 SetVariable 动作
    let action = Action {
        id: uuid::Uuid::new_v4().to_string(),
        flow_id: flow.id.clone(),
        action_type: ActionType::SetVariable,
        params: json!({
            "name": "e2e_test_var",
            "value": "hello_from_e2e",
            "global": false
        }),
        order: 0,
        parent_id: None,
        fault_strategy: Some(FaultStrategy::Stop),
        note: Some("E2E 测试动作".to_string()),
        position_x: 100.0,
        position_y: 100.0,
    };
    repo.set_actions(&flow.id, &[action])?;
    tracing::info!("[E2E] 添加 SetVariable 动作");

    // 3. 添加 Cron 触发器（仅用于验证表达式解析与调度器加载，不真正触发）
    let trigger = Trigger {
        id: uuid::Uuid::new_v4().to_string(),
        flow_id: flow.id.clone(),
        trigger_type: TriggerType::Cron,
        params: serde_json::to_value(CronTriggerParams {
            // 每分钟第 30 秒触发（仅测试解析，不实际等待）
            expression: "30 * * * *".to_string(),
            timezone: None,
        })?,
        enabled: true,
    };
    repo.set_triggers(&flow.id, &[trigger])?;
    tracing::info!("[E2E] 添加 Cron 触发器");

    // 4. 重新加载调度器（让 Cron 触发器被识别）
    state.reload_triggers()?;

    // 5. 立即执行 Flow
    let log = state.chain_engine.execute_flow(&flow.id)?;
    tracing::info!("[E2E] Flow 执行完成: status={:?}", log.status);

    // 6. 查询最近日志
    let logs = repo.list_logs(&LogFilter {
        flow_id: Some(flow.id.clone()),
        status: None,
        limit: Some(10),
        offset: None,
    })?;

    let success_count = logs
        .iter()
        .filter(|l| l.status == ExecutionStatus::Success)
        .count();
    let failed_count = logs
        .iter()
        .filter(|l| l.status == ExecutionStatus::Failed)
        .count();

    let result = json!({
        "flow": {
            "id": flow.id,
            "name": flow.name,
            "enabled": true,
        },
        "execution": {
            "log_id": log.id,
            "status": format!("{:?}", log.status),
            "duration_ms": log.duration_ms,
            "error": log.error,
        },
        "logs": {
            "total": logs.len(),
            "success": success_count,
            "failed": failed_count,
        },
        "passed": log.status == ExecutionStatus::Success,
    });

    tracing::info!("[E2E] 端到端测试结果: {}", result);
    Ok(result)
}

/// 验证 Flow 执行结果辅助函数
#[allow(dead_code)]
fn summarize_log(log: &ExecutionLog) -> serde_json::Value {
    json!({
        "id": log.id,
        "status": format!("{:?}", log.status),
        "started_at": log.started_at.to_rfc3339(),
        "duration_ms": log.duration_ms,
        "error": log.error,
    })
}
