//! 触发器模型

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::common::TriggerType;

/// 触发器（Trigger）
///
/// 1 条快捷指令可绑定多个触发器，任一触发即执行动作链。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trigger {
    /// 唯一标识
    pub id: String,
    /// 所属快捷指令 ID
    pub flow_id: String,
    /// 触发器类型
    pub trigger_type: TriggerType,
    /// 参数（JSON 对象，结构由 trigger_type 决定）
    pub params: Value,
    /// 是否启用
    pub enabled: bool,
}

impl Trigger {
    pub fn new(flow_id: impl Into<String>, trigger_type: TriggerType, params: Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            flow_id: flow_id.into(),
            trigger_type,
            params,
            enabled: true,
        }
    }
}

/// Cron 触发器参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronTriggerParams {
    /// Cron 表达式（5 字段：分 时 日 月 周）
    pub expression: String,
    /// 时区（IANA 标识，None 用系统时区）
    pub timezone: Option<String>,
}

/// 课表触发器参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseTriggerParams {
    /// 关联课程块 ID
    pub course_id: String,
    /// 触发时机
    pub timing: CourseTiming,
    /// Before 时的提前分钟数（None 视为 0，即课程开始即触发）
    #[serde(default)]
    pub minutes: Option<i32>,
}

/// 课表触发时机
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CourseTiming {
    /// 课前 N 分钟
    Before,
    /// 课中（开始时）
    During,
    /// 课后（结束时）
    After,
}

/// USB 触发器参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbTriggerParams {
    /// 设备名（可选，None 匹配任意设备）
    pub device_name: Option<String>,
    /// 设备 ID（可选）
    pub device_id: Option<String>,
}

/// 进程触发器参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTriggerParams {
    /// 进程名（如 notepad.exe）
    pub process_name: String,
}

/// 手动触发器参数（无参数，仅占位）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManualTriggerParams;
