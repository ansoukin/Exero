//! 性能优化领域模型（SPEC 3.6 页面 4）
//!
//! 定义硬件监控、进程列表、进程优先级、一键优化结果等数据结构。
//! 温度监控 Phase 4 占位（未来用 LibreHardwareMonitorLib 集成）。

use serde::{Deserialize, Serialize};

/// 硬件状态总览
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareStatus {
    /// CPU 状态
    pub cpu: CpuStatus,
    /// GPU 状态（Beta9 · 任务3 新增）
    pub gpu: GpuStatus,
    /// 内存状态
    pub memory: MemoryStatus,
    /// 存储状态（Beta9 · 任务3 新增）
    pub storage: StorageStatus,
    /// 温度读数列表（Phase 4 占位：返回空 note 标记"待 LHB 集成"）
    pub temperatures: Vec<TemperatureReading>,
}

/// GPU 状态（Beta9 · 任务3）
///
/// 数据源 LibreHardwareMonitorLib（通过 NexBoxMonitor.exe 子进程）。
/// 支持 NVIDIA/AMD/Intel 显卡的使用率、温度、显存。
/// LHM 不可用时字段为 None，前端显示"--"。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuStatus {
    /// GPU 型号名
    pub name: String,
    /// GPU 使用率（0-100），None 表示不支持
    pub usage: Option<f32>,
    /// GPU 温度（摄氏度），None 表示不支持
    pub temperature: Option<f32>,
    /// 显存总量（字节），None 表示不支持
    pub total_memory_bytes: Option<u64>,
    /// 已用显存（字节），None 表示不支持
    pub used_memory_bytes: Option<u64>,
}

/// 存储状态（Beta9 · 任务3）
///
/// 数据源 sysinfo Disks，汇总所有逻辑磁盘。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStatus {
    /// 总容量（字节，所有盘汇总）
    pub total_bytes: u64,
    /// 已用容量（字节）
    pub used_bytes: u64,
    /// 可用容量（字节）
    pub available_bytes: u64,
    /// 磁盘数量
    pub disk_count: usize,
}

/// CPU 使用率
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuStatus {
    /// CPU 型号名
    pub name: String,
    /// 总体使用率（0-100）
    pub overall_usage: f32,
    /// 各核心使用率（0-100）
    pub core_usages: Vec<f32>,
    /// 物理核心数
    pub core_count: usize,
}

/// 内存使用情况
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatus {
    /// 总内存（字节）
    pub total_bytes: u64,
    /// 已用内存（字节）
    pub used_bytes: u64,
    /// 可用内存（字节）
    pub available_bytes: u64,
}

/// 温度读数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureReading {
    /// 组件名：CPU / GPU / 主板 / 硬盘
    pub component: String,
    /// 温度（摄氏度），None 表示不支持
    pub temperature: Option<f32>,
    /// 说明（如"待 LHB 集成"）
    pub note: String,
}

/// 进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    /// 进程 PID
    pub pid: u32,
    /// 进程名（如 chrome.exe）
    pub name: String,
    /// CPU 使用率（0-100，单进程可能 >100 因多核）
    pub cpu_usage: f32,
    /// 内存使用（字节）
    pub memory_bytes: u64,
    /// 当前优先级
    pub priority: ProcessPriority,
    /// 命令行路径（可选，部分进程无法获取）
    pub command: Option<String>,
}

/// 进程优先级（5 档，对应 Windows SetPriorityClass）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProcessPriority {
    /// 高（HIGH_PRIORITY_CLASS）
    High,
    /// 高于正常（ABOVE_NORMAL_PRIORITY_CLASS）
    AboveNormal,
    /// 正常（NORMAL_PRIORITY_CLASS）
    Normal,
    /// 低于正常（BELOW_NORMAL_PRIORITY_CLASS）
    BelowNormal,
    /// 低（IDLE_PRIORITY_CLASS）
    Idle,
}

impl ProcessPriority {
    /// 中文显示名
    pub fn display_name(self) -> &'static str {
        match self {
            Self::High => "高",
            Self::AboveNormal => "高于正常",
            Self::Normal => "正常",
            Self::BelowNormal => "低于正常",
            Self::Idle => "低",
        }
    }

    /// 转为 Windows SetPriorityClass 的 DWORD 常量
    #[cfg(windows)]
    pub fn to_win32_class(self) -> u32 {
        // 常量值来自 windows-sys Win32::System::Threading
        match self {
            Self::High => 0x00000080,         // HIGH_PRIORITY_CLASS
            Self::AboveNormal => 0x00008000,  // ABOVE_NORMAL_PRIORITY_CLASS
            Self::Normal => 0x00000020,       // NORMAL_PRIORITY_CLASS
            Self::BelowNormal => 0x00004000,  // BELOW_NORMAL_PRIORITY_CLASS
            Self::Idle => 0x00000040,         // IDLE_PRIORITY_CLASS
        }
    }

    /// 从 Windows GetPriorityClass 的 DWORD 解析
    #[cfg(windows)]
    pub fn from_win32_class(class: u32) -> Self {
        match class {
            0x00000080 => Self::High,
            0x00008000 => Self::AboveNormal,
            0x00004000 => Self::BelowNormal,
            0x00000040 => Self::Idle,
            // 0x00000020 或其他默认为 Normal
            _ => Self::Normal,
        }
    }

    /// 全部档位（用于前端下拉选项展示）
    pub fn all() -> [Self; 5] {
        [
            Self::High,
            Self::AboveNormal,
            Self::Normal,
            Self::BelowNormal,
            Self::Idle,
        ]
    }
}

/// 一键优化结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizeResult {
    /// 已结束的进程名列表
    pub killed_processes: Vec<String>,
    /// 已降级优先级的进程名列表（高 CPU 降为低于正常）
    pub demoted_processes: Vec<String>,
    /// 释放的内存估算（字节，基于清理前后 available_memory 差值）
    pub memory_freed_bytes: u64,
    /// 执行中的错误信息
    pub errors: Vec<String>,
}

/// 排序维度（进程列表）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProcessSortBy {
    /// 按 CPU 使用率降序
    Cpu,
    /// 按内存使用降序
    Memory,
}

impl Default for ProcessSortBy {
    fn default() -> Self {
        Self::Cpu
    }
}
