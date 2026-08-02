//! 动作模型

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::common::{ActionType, FaultStrategy};

/// 动作块（Action）
///
/// 动作链中的单个节点，可以是具体动作或控制流节点。
/// 通过 parent_id 与 order 字段表达层级与顺序。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// 唯一标识
    pub id: String,
    /// 所属快捷指令 ID
    pub flow_id: String,
    /// 动作类型
    pub action_type: ActionType,
    /// 参数（JSON 对象，结构由 action_type 决定）
    pub params: Value,
    /// 执行顺序（同一层级内从 0 递增）
    pub order: i32,
    /// 父节点 ID（控制流嵌套时使用，顶层动作为 None）
    pub parent_id: Option<String>,
    /// 容错策略（None 时使用 Flow 的默认策略）
    pub fault_strategy: Option<FaultStrategy>,
    /// 备注
    pub note: Option<String>,
    /// 画布横坐标（Phase 4 可视化编辑器，React Flow 节点位置）
    #[serde(default)]
    pub position_x: f64,
    /// 画布纵坐标（Phase 4 可视化编辑器，React Flow 节点位置）
    #[serde(default)]
    pub position_y: f64,
}

impl Action {
    pub fn new(flow_id: impl Into<String>, action_type: ActionType, params: Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            flow_id: flow_id.into(),
            action_type,
            params,
            order: 0,
            parent_id: None,
            fault_strategy: None,
            note: None,
            position_x: 0.0,
            position_y: 0.0,
        }
    }
}

/// 启动程序动作参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchProgramParams {
    /// 可执行文件路径
    pub path: String,
    /// 命令行参数（可选）
    pub args: Option<String>,
    /// 工作目录（可选）
    pub working_dir: Option<String>,
    /// 是否以管理员权限运行
    #[serde(default)]
    pub run_as_admin: bool,
}

/// 关闭进程动作参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillProcessParams {
    /// 进程名（如 notepad.exe）或 PID
    pub target: String,
    /// 是否强制结束
    #[serde(default = "default_true")]
    pub force: bool,
    /// 等待超时（毫秒），0 表示不等待
    #[serde(default)]
    pub timeout_ms: u32,
}

fn default_true() -> bool {
    true
}

/// 打开网页参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenUrlParams {
    pub url: String,
    /// 是否在新窗口打开
    #[serde(default)]
    pub new_window: bool,
}

/// 打开文件参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileParams {
    pub path: String,
    /// 打开方式（程序路径，可选，None 用默认程序）
    pub open_with: Option<String>,
}

/// 调节音量参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetVolumeParams {
    /// 目标音量（0-100），None 表示静音切换
    pub volume: Option<u32>,
    /// 是否静音（与 volume 二选一）
    #[serde(default)]
    pub mute: bool,
}

/// 播放声音参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaySoundParams {
    /// 声音文件路径或系统声音名
    pub source: String,
    /// 音量（0-100，可选）
    pub volume: Option<u32>,
    /// 是否循环
    #[serde(default)]
    pub r#loop: bool,
}

/// 模拟按键参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateKeyParams {
    /// 按键序列（如 "Ctrl+C"）
    pub keys: String,
    /// 重复次数
    #[serde(default = "default_one")]
    pub repeat: u32,
}

fn default_one() -> u32 {
    1
}

/// 关机参数（适用所有系统电源动作）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerActionParams {
    /// 延迟秒数（0 立即执行）
    #[serde(default)]
    pub delay_secs: u32,
    /// 是否强制（不等待程序响应）
    #[serde(default)]
    pub force: bool,
    /// 提示消息（可选）
    pub message: Option<String>,
}

/// 清理临时文件参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanTempFilesParams {
    /// 要清理的目录列表（None 用默认临时目录）
    pub dirs: Option<Vec<String>>,
    /// 文件通配符（默认 "*.*"）
    #[serde(default = "default_wildcard")]
    pub pattern: String,
    /// 是否递归子目录
    #[serde(default)]
    pub recursive: bool,
    /// 文件最小保留时间（分钟，0 表示不限制）
    #[serde(default)]
    pub min_age_minutes: u32,
}

fn default_wildcard() -> String {
    "*.*".to_string()
}

/// 切换电源计划参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchPowerPlanParams {
    /// 电源计划 GUID（如 "381b4222-f694-4f62-9c5f-c1f5c2a8b5c3"）
    pub plan_guid: String,
}

/// Toast 通知参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowToastParams {
    pub title: String,
    pub body: String,
    /// 图标路径（可选）
    pub icon: Option<String>,
}

/// 应用内通知参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowInAppNotificationParams {
    pub title: String,
    pub body: String,
    /// 通知级别（info/warning/error）
    #[serde(default = "default_info")]
    pub level: String,
}

fn default_info() -> String {
    "info".to_string()
}

/// 条件分支参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfElseParams {
    /// 条件表达式（变量与字面量的比较，如 "{volume} > 50"）
    pub condition: String,
}

/// 循环参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopParams {
    /// 循环次数（None 表示无限循环，需内部动作 break）
    pub count: Option<u32>,
    /// 循环变量名（可选）
    pub var_name: Option<String>,
}

/// 变量赋值参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetVariableParams {
    /// 变量名
    pub name: String,
    /// 值（字符串，支持模板插值如 "{other_var}"）
    pub value: String,
    /// 是否为全局变量（默认 false 局部）
    #[serde(default)]
    pub global: bool,
}

/// Lua 脚本参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LuaScriptParams {
    /// 脚本 ID（来自市场）
    pub script_id: String,
    /// 脚本参数（JSON 对象）
    #[serde(default)]
    pub args: Value,
    /// 超时（秒，None 用默认 10 秒）
    pub timeout_secs: Option<u32>,
}
