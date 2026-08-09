//! 通用领域类型
//!
//! 定义动作类型枚举、触发器类型枚举、风险等级、状态等共用类型。

use serde::{Deserialize, Serialize};

/// 动作类型枚举
///
/// 对应 SPEC 中定义的 6 类共 20 种内置动作 + Lua 脚本 + 扩展包动作。
/// 新增动作类型时在此扩展，并在 actions 模块中实现执行器。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", content = "variant")]
pub enum ActionType {
    // 应用与文件类
    LaunchProgram,
    KillProcess,
    OpenUrl,
    OpenFile,

    // 媒体与输入类
    SetVolume,
    PlaySound,
    SimulateKey,

    // 系统与电源类
    Shutdown,
    Reboot,
    LockScreen,
    Hibernate,
    Logoff,
    CleanTempFiles,
    SwitchPowerPlan,

    // 通知类
    ShowToast,
    ShowInAppNotification,

    // 控制流类
    IfElse,
    Loop,
    SetVariable,

    // Lua 脚本类（用户内联脚本）
    LuaScript,

    // 扩展包动作（V0.4.0-Beta5 新增）
    // variant 格式："pack_id:action_id"（如 "my-pack:my_action"）
    // 同时支持 Lua 扩展动作和 Rust .dll 动作
    Extension(String),
}

impl ActionType {
    /// 获取动作类型的中文显示名
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::LaunchProgram => "启动程序",
            Self::KillProcess => "关闭进程",
            Self::OpenUrl => "打开网页",
            Self::OpenFile => "打开文件",
            Self::SetVolume => "调节音量",
            Self::PlaySound => "播放声音",
            Self::SimulateKey => "模拟按键",
            Self::Shutdown => "关机",
            Self::Reboot => "重启",
            Self::LockScreen => "锁屏",
            Self::Hibernate => "休眠",
            Self::Logoff => "注销",
            Self::CleanTempFiles => "清理临时文件",
            Self::SwitchPowerPlan => "切换电源计划",
            Self::ShowToast => "Toast 通知",
            Self::ShowInAppNotification => "应用内通知",
            Self::IfElse => "条件分支",
            Self::Loop => "循环",
            Self::SetVariable => "变量赋值",
            Self::LuaScript => "Lua 脚本",
            Self::Extension(_) => "扩展动作",
        }
    }

    /// 获取动作所属类别
    pub fn category(&self) -> ActionCategory {
        match self {
            Self::LaunchProgram | Self::KillProcess | Self::OpenUrl | Self::OpenFile => {
                ActionCategory::AppAndFile
            }
            Self::SetVolume | Self::PlaySound | Self::SimulateKey => ActionCategory::MediaAndInput,
            Self::Shutdown
            | Self::Reboot
            | Self::LockScreen
            | Self::Hibernate
            | Self::Logoff
            | Self::CleanTempFiles
            | Self::SwitchPowerPlan => ActionCategory::SystemAndPower,
            Self::ShowToast | Self::ShowInAppNotification => ActionCategory::Notification,
            Self::IfElse | Self::Loop | Self::SetVariable => ActionCategory::ControlFlow,
            Self::LuaScript | Self::Extension(_) => ActionCategory::LuaScript,
        }
    }
}

/// 动作类别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ActionCategory {
    AppAndFile,
    MediaAndInput,
    SystemAndPower,
    Notification,
    ControlFlow,
    LuaScript,
}

impl ActionCategory {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::AppAndFile => "应用与文件",
            Self::MediaAndInput => "媒体与输入",
            Self::SystemAndPower => "系统与电源",
            Self::Notification => "通知",
            Self::ControlFlow => "控制流",
            Self::LuaScript => "Lua 脚本",
        }
    }
}

/// 触发器类型枚举
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", content = "variant")]
pub enum TriggerType {
    // 时间类
    Cron,         // cron 表达式触发
    CourseStart,  // 课程开始（课前/课中/课后）

    // 系统事件类
    SystemBoot,      // 开机
    SystemShutdown,  // 关机
    UserLogin,       // 登录
    UserLockScreen,  // 锁屏
    UsbPlug,         // USB 插入
    UsbUnplug,       // USB 拔出
    NetworkChange,   // 网络变化
    ProcessStart,    // 进程启动
    ProcessStop,     // 进程停止

    // 手动类
    Manual,  // 手动触发（首页按钮/托盘菜单）
}

impl TriggerType {
    /// 获取触发器类型的中文显示名
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Cron => "定时触发",
            Self::CourseStart => "课表触发",
            Self::SystemBoot => "开机",
            Self::SystemShutdown => "关机",
            Self::UserLogin => "登录",
            Self::UserLockScreen => "锁屏",
            Self::UsbPlug => "USB 插入",
            Self::UsbUnplug => "USB 拔出",
            Self::NetworkChange => "网络变化",
            Self::ProcessStart => "进程启动",
            Self::ProcessStop => "进程停止",
            Self::Manual => "手动触发",
        }
    }

    /// 获取触发器所属类别
    pub fn category(&self) -> TriggerCategory {
        match self {
            Self::Cron | Self::CourseStart => TriggerCategory::Time,
            Self::SystemBoot
            | Self::SystemShutdown
            | Self::UserLogin
            | Self::UserLockScreen
            | Self::UsbPlug
            | Self::UsbUnplug
            | Self::NetworkChange
            | Self::ProcessStart
            | Self::ProcessStop => TriggerCategory::SystemEvent,
            Self::Manual => TriggerCategory::Manual,
        }
    }
}

/// 触发器类别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TriggerCategory {
    Time,
    SystemEvent,
    Manual,
}

impl TriggerCategory {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Time => "时间类",
            Self::SystemEvent => "系统事件",
            Self::Manual => "手动类",
        }
    }
}

/// 容错策略
///
/// 定义动作执行失败时的处理方式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum FaultStrategy {
    /// 继续：跳过失败动作，继续执行下一个
    #[default]
    Continue,
    /// 停止：停止整个动作链执行
    Stop,
    /// 回滚：执行回滚逻辑（如已启动的进程需关闭）
    Rollback,
    /// 通知：弹窗通知用户，等待用户决定
    Notify,
}

impl FaultStrategy {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Continue => "继续",
            Self::Stop => "停止",
            Self::Rollback => "回滚",
            Self::Notify => "通知",
        }
    }
}

/// 执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Success,
    Failed,
    Skipped,
}

impl ExecutionStatus {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Pending => "待执行",
            Self::Running => "执行中",
            Self::Success => "成功",
            Self::Failed => "失败",
            Self::Skipped => "跳过",
        }
    }
}
