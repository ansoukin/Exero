//! 性能优化命令（SPEC 3.6 页面 4）
//!
//! 提供 5 类 Tauri 命令：
//! - 硬件监控数据采集（CPU/内存，温度 Phase 4 占位待 LHB 集成）
//! - 进程列表查询（Top 20，按 CPU/内存排序）
//! - 进程优先级调整（5 档，对应 Windows SetPriorityClass）
//! - 结束进程（TerminateProcess）
//! - 一键优化（结束黑名单 + 降级高 CPU 进程 + EmptyWorkingSet 清理内存）
//!
//! 黑名单存储于 settings 表（key = "performance.blacklist"），
//! 预置硬编码默认黑名单（后台更新服务类），用户可在前端扩展。

use std::sync::Arc;

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use sysinfo::{Disks, System};
use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::performance::{
    CpuStatus, GpuStatus, HardwareStatus, MemoryStatus, OptimizeResult, ProcessInfo,
    ProcessPriority, ProcessSortBy, StorageStatus, TemperatureReading,
};
use crate::state::AppState;

/// 全局 sysinfo System 实例
///
/// 持久存活以保留 CPU 使用率历史（sysinfo 基于两次 refresh 间隔计算使用率，
/// 首次 refresh 后 cpu_usage 返回 0，第二次起才准确）。
/// 前端每 2 秒轮询一次，第二次起数据即有效。
static SYS: Lazy<Mutex<System>> = Lazy::new(|| Mutex::new(System::new_all()));

/// settings 表中黑名单的 key
const BLACKLIST_KEY: &str = "performance.blacklist";

/// 预置默认黑名单（后台更新服务类，安全结束，会自动重启）
///
/// 用户可在前端增删。仅结束用户态进程，不影响系统进程。
const DEFAULT_BLACKLIST: &[&str] = &[
    "GoogleUpdate.exe",
    "MicrosoftEdgeUpdate.exe",
    "gupdate.exe",
    "gupdatem.exe",
    "AdobeARM.exe",
    "AdobeGCClient.exe",
    "Update.exe",
];

/// 一键优化时降级的 CPU 使用率阈值（百分比）
const DEMOTE_CPU_THRESHOLD: f32 = 20.0;

/// 一键优化时保护的关键系统进程名（小写比较）
///
/// 这些进程即使 CPU 高也不会被降级或结束，避免系统崩溃。
const PROTECTED_PROCESSES: &[&str] = &[
    "system",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "dwm.exe",
    "explorer.exe",
    "taskhostw.exe",
    "sihost.exe",
    "ctfmon.exe",
    "conhost.exe",
    "exero.exe",
];

/// 刷新 sysinfo 并返回锁守卫
fn refresh_sys() -> parking_lot::MutexGuard<'static, System> {
    let mut sys = SYS.lock();
    // sysinfo 0.32：refresh_all 刷新 CPU/内存/进程全部
    // 首次调用后 CPU 使用率为 0，第二次起基于间隔计算才准确
    // 性能开销在 2 秒轮询场景可接受
    sys.refresh_all();
    sys
}

/// 获取硬件监控状态
#[tauri::command]
pub async fn get_hardware_status() -> Result<HardwareStatus> {
    let sys = refresh_sys();

    // CPU
    let cpus = sys.cpus();
    // 注意：sysinfo 0.32 的 name() 返回逻辑名（如 "cpu0"），brand() 才是品牌名
    let cpu_name = cpus.first().map(|c| c.brand().to_string()).unwrap_or_default();
    let overall_usage = sys.global_cpu_usage();
    let core_usages: Vec<f32> = cpus.iter().map(|c| c.cpu_usage()).collect();
    let core_count = cpus.len();

    let cpu = CpuStatus {
        name: cpu_name,
        overall_usage,
        core_usages,
        core_count,
    };

    // 内存
    let memory = MemoryStatus {
        total_bytes: sys.total_memory(),
        used_bytes: sys.used_memory(),
        available_bytes: sys.available_memory(),
    };

    // GPU（Beta9 · 任务3：从 LHM 传感器读取，支持 NVIDIA/AMD/Intel）
    // LHM 不可用时字段为 None，前端显示"--"
    let gpu = read_gpu_from_lhm();

    // 存储（Beta9 · 任务3：sysinfo Disks 汇总所有逻辑磁盘）
    let storage = {
        let disks = Disks::new_with_refreshed_list();
        let total: u64 = disks.list().iter().map(|d| d.total_space()).sum();
        let available: u64 = disks.list().iter().map(|d| d.available_space()).sum();
        StorageStatus {
            total_bytes: total,
            used_bytes: total.saturating_sub(available),
            available_bytes: available,
            disk_count: disks.list().len(),
        }
    };

    // 温度（Phase 4 占位：返回 4 个组件的 None 读数，待 LHB 集成）
    let temperatures = vec![
        TemperatureReading {
            component: "CPU".into(),
            temperature: None,
            note: "待 LibreHardwareMonitorLib 集成".into(),
        },
        TemperatureReading {
            component: "GPU".into(),
            temperature: None,
            note: "待 LibreHardwareMonitorLib 集成".into(),
        },
        TemperatureReading {
            component: "主板".into(),
            temperature: None,
            note: "待 LibreHardwareMonitorLib 集成".into(),
        },
        TemperatureReading {
            component: "硬盘".into(),
            temperature: None,
            note: "待 LibreHardwareMonitorLib 集成".into(),
        },
    ];

    Ok(HardwareStatus {
        cpu,
        gpu,
        memory,
        storage,
        temperatures,
    })
}

/// 获取进程列表（Top 20，按指定维度排序）
#[tauri::command]
pub async fn list_processes(
    sort_by: Option<ProcessSortBy>,
    limit: Option<usize>,
) -> Result<Vec<ProcessInfo>> {
    let sys = refresh_sys();
    let sort_by = sort_by.unwrap_or_default();
    let limit = limit.unwrap_or(20);

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, proc_)| ProcessInfo {
            pid: pid.as_u32(),
            name: proc_.name().to_string_lossy().into_owned(),
            cpu_usage: proc_.cpu_usage(),
            memory_bytes: proc_.memory(),
            priority: get_process_priority(pid.as_u32()),
            command: proc_.exe().map(|p| p.display().to_string()),
        })
        .collect();

    // 排序
    match sort_by {
        ProcessSortBy::Cpu => processes.sort_by(|a, b| {
            b.cpu_usage
                .partial_cmp(&a.cpu_usage)
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        ProcessSortBy::Memory => processes.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes)),
    }

    // 取 Top N
    processes.truncate(limit);

    Ok(processes)
}

/// 调整进程优先级
#[tauri::command]
pub async fn set_process_priority(pid: u32, priority: ProcessPriority) -> Result<()> {
    set_process_priority_win32(pid, priority)
}

/// 结束进程
#[tauri::command]
pub async fn kill_process(pid: u32) -> Result<()> {
    kill_process_win32(pid)
}

/// 一键优化
///
/// 执行步骤：
/// 1. 读取黑名单（用户配置 + 默认硬编码）
/// 2. 结束黑名单中的进程
/// 3. 把 CPU > 阈值且非系统保护的进程降级为 BelowNormal
/// 4. 对所有用户进程调用 EmptyWorkingSet 释放工作集内存
/// 5. 返回执行结果
#[tauri::command]
pub async fn one_click_optimize(
    state: State<'_, Arc<AppState>>,
) -> Result<OptimizeResult> {
    let mut killed = Vec::new();
    let mut demoted = Vec::new();
    let mut errors = Vec::new();

    // 1. 读取黑名单
    let blacklist = load_blacklist(&state)?;

    // 记录清理前可用内存
    let sys = refresh_sys();
    let mem_before = sys.available_memory();
    drop(sys);

    // 2. 结束黑名单进程
    {
        let sys = SYS.lock();
        for (pid, proc_) in sys.processes().iter() {
            let name = proc_.name().to_str().unwrap_or("");
            if blacklist.iter().any(|b| b.eq_ignore_ascii_case(name)) {
                let pid_u32 = pid.as_u32();
                match kill_process_win32(pid_u32) {
                    Ok(()) => {
                        killed.push(name.to_string());
                        tracing::info!("一键优化：已结束进程 {} (pid={})", name, pid_u32);
                    }
                    Err(e) => {
                        errors.push(format!("结束 {} 失败: {}", name, e));
                    }
                }
            }
        }
    }

    // 3. 降级高 CPU 非系统进程
    {
        let sys = refresh_sys();
        for (pid, proc_) in sys.processes().iter() {
            let name = proc_.name().to_str().unwrap_or("");
            // 跳过被保护进程
            if is_protected(name) {
                continue;
            }
            // 跳过刚被结束的黑名单进程
            if killed.iter().any(|k| k.eq_ignore_ascii_case(name)) {
                continue;
            }
            if proc_.cpu_usage() > DEMOTE_CPU_THRESHOLD {
                let pid_u32 = pid.as_u32();
                match set_process_priority_win32(pid_u32, ProcessPriority::BelowNormal) {
                    Ok(()) => {
                        demoted.push(format!("{} (pid={}, {:.0}%)", name, pid_u32, proc_.cpu_usage()));
                        tracing::info!(
                            "一键优化：已降级进程 {} (pid={}, cpu={:.1}%)",
                            name,
                            pid_u32,
                            proc_.cpu_usage()
                        );
                    }
                    Err(e) => {
                        errors.push(format!("降级 {} 失败: {}", name, e));
                    }
                }
            }
        }
    }

    // 4. 内存清理：对所有非系统进程调用 EmptyWorkingSet
    {
        let sys = SYS.lock();
        for (pid, proc_) in sys.processes().iter() {
            let name = proc_.name().to_str().unwrap_or("");
            if is_protected(name) {
                continue;
            }
            let pid_u32 = pid.as_u32();
            // EmptyWorkingSet 失败不影响整体，静默忽略
            let _ = empty_working_set_win32(pid_u32);
        }
    }

    // 5. 计算释放的内存（清理前后 available_memory 差值）
    let sys = refresh_sys();
    let mem_after = sys.available_memory();
    let memory_freed = mem_after.saturating_sub(mem_before);

    Ok(OptimizeResult {
        killed_processes: killed,
        demoted_processes: demoted,
        memory_freed_bytes: memory_freed,
        errors,
    })
}

/// 获取优化黑名单（用户配置 + 默认硬编码，去重）
#[tauri::command]
pub async fn get_optimize_blacklist(state: State<'_, Arc<AppState>>) -> Result<Vec<String>> {
    load_blacklist(&state)
}

/// 设置优化黑名单（完全覆盖用户配置部分）
#[tauri::command]
pub async fn set_optimize_blacklist(
    state: State<'_, Arc<AppState>>,
    blacklist: Vec<String>,
) -> Result<()> {
    let json = serde_json::to_string(&blacklist)?;
    let repo = Repository::new(&state.db);
    let setting = crate::models::Setting::new(BLACKLIST_KEY, json, "json");
    repo.set_setting(&setting)
}

/// 加载黑名单
///
/// 策略：用户在 settings 表配置过则用用户配置（完全覆盖默认），
/// 未配置则返回默认硬编码黑名单。这样用户编辑后保存的即为生效列表，
/// 清空则表示不使用黑名单。
fn load_blacklist(state: &Arc<AppState>) -> Result<Vec<String>> {
    let repo = Repository::new(&state.db);
    if let Some(setting) = repo.get_setting(BLACKLIST_KEY)? {
        if let Ok(user_list) = serde_json::from_str::<Vec<String>>(&setting.value) {
            return Ok(user_list);
        }
    }
    Ok(DEFAULT_BLACKLIST.iter().map(|s| s.to_string()).collect())
}

/// 判断进程是否受保护（不参与降级/结束/清理）
fn is_protected(name: &str) -> bool {
    let name_lower = name.to_ascii_lowercase();
    PROTECTED_PROCESSES
        .iter()
        .any(|p| p.eq_ignore_ascii_case(&name_lower))
}

// ============================================================
// Windows API 封装
// ============================================================

#[cfg(windows)]
mod win32 {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        GetPriorityClass, OpenProcess, SetPriorityClass, TerminateProcess,
        ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS,
        IDLE_PRIORITY_CLASS, PROCESS_QUERY_LIMITED_INFORMATION,
        PROCESS_SET_INFORMATION, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
    };

    use crate::error::{AppError, Result};
    use crate::models::performance::ProcessPriority;

    /// 权限：查询优先级
    const ACCESS_QUERY: u32 = PROCESS_QUERY_LIMITED_INFORMATION;
    /// 权限：设置优先级
    const ACCESS_SET_PRIORITY: u32 = PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION;
    /// 权限：结束进程
    const ACCESS_TERMINATE: u32 = PROCESS_TERMINATE;
    /// 权限：清理工作集
    const ACCESS_EMPTY_WS: u32 = PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION;

    /// 读取进程优先级
    pub fn get_priority(pid: u32) -> ProcessPriority {
        unsafe {
            let handle = OpenProcess(ACCESS_QUERY, 0, pid);
            if handle.is_null() {
                return ProcessPriority::Normal;
            }
            let class = GetPriorityClass(handle);
            CloseHandle(handle);
            match class {
                HIGH_PRIORITY_CLASS => ProcessPriority::High,
                ABOVE_NORMAL_PRIORITY_CLASS => ProcessPriority::AboveNormal,
                BELOW_NORMAL_PRIORITY_CLASS => ProcessPriority::BelowNormal,
                IDLE_PRIORITY_CLASS => ProcessPriority::Idle,
                _ => ProcessPriority::Normal,
            }
        }
    }

    /// 设置进程优先级
    pub fn set_priority(pid: u32, priority: ProcessPriority) -> Result<()> {
        unsafe {
            let handle = OpenProcess(ACCESS_SET_PRIORITY, 0, pid);
            if handle.is_null() {
                return Err(AppError::Windows(format!(
                    "OpenProcess 失败 (pid={}, 可能权限不足或进程已退出)",
                    pid
                )));
            }
            let class = priority.to_win32_class();
            let ok = SetPriorityClass(handle, class);
            CloseHandle(handle);
            if ok == 0 {
                return Err(AppError::Windows(format!(
                    "SetPriorityClass 失败 (pid={}, class={:#x})",
                    pid, class
                )));
            }
            Ok(())
        }
    }

    /// 结束进程（退出码 1）
    pub fn kill(pid: u32) -> Result<()> {
        unsafe {
            let handle = OpenProcess(ACCESS_TERMINATE, 0, pid);
            if handle.is_null() {
                return Err(AppError::Windows(format!(
                    "OpenProcess 失败 (pid={}, 可能权限不足或进程已退出)",
                    pid
                )));
            }
            let ok = TerminateProcess(handle, 1);
            CloseHandle(handle);
            if ok == 0 {
                return Err(AppError::Windows(format!(
                    "TerminateProcess 失败 (pid={})",
                    pid
                )));
            }
            Ok(())
        }
    }

    /// 清理进程工作集（释放物理内存）
    ///
    /// 失败静默返回，不影响一键优化整体流程。
    pub fn empty_working_set(pid: u32) -> bool {
        unsafe {
            let handle = OpenProcess(ACCESS_EMPTY_WS, 0, pid);
            if handle.is_null() {
                return false;
            }
            let ok = EmptyWorkingSet(handle);
            CloseHandle(handle);
            ok != 0
        }
    }
}

#[cfg(not(windows))]
mod win32 {
    use crate::error::{AppError, Result};
    use crate::models::performance::ProcessPriority;

    pub fn get_priority(_pid: u32) -> ProcessPriority {
        ProcessPriority::Normal
    }

    pub fn set_priority(_pid: u32, _priority: ProcessPriority) -> Result<()> {
        Err(AppError::Other("非 Windows 平台不支持进程优先级操作".into()))
    }

    pub fn kill(_pid: u32) -> Result<()> {
        Err(AppError::Other("非 Windows 平台不支持结束进程".into()))
    }

    pub fn empty_working_set(_pid: u32) -> bool {
        false
    }
}

use win32 as w;

/// 读取进程优先级（跨平台封装，非 Windows 返回 Normal）
fn get_process_priority(pid: u32) -> ProcessPriority {
    w::get_priority(pid)
}

/// 设置进程优先级（跨平台封装）
fn set_process_priority_win32(pid: u32, priority: ProcessPriority) -> Result<()> {
    w::set_priority(pid, priority)
}

/// 结束进程（跨平台封装）
fn kill_process_win32(pid: u32) -> Result<()> {
    w::kill(pid)
}

/// 清理进程工作集（跨平台封装）
fn empty_working_set_win32(pid: u32) -> bool {
    w::empty_working_set(pid)
}

// ============================================================
// LHM 传感器读取（Beta9 · 任务3，GPU/CPU 温度数据源）
// ============================================================

/// 从 LHM 传感器读取 GPU 状态
///
/// LHM 不可用或读取失败时返回全 None 的 GpuStatus（前端显示"--"）。
/// 支持多 GPU：取第一个非 Intel 核显的 GPU。
fn read_gpu_from_lhm() -> GpuStatus {
    use crate::sensors::read_sensors;
    use crate::sensors::bridge::SensorReading;

    let response = match read_sensors() {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!("LHM 传感器读取失败，GPU 降级为 None: {}", e);
            return empty_gpu();
        }
    };

    // 按 hardwareType 分组 GPU（LHM 用 GpuNvidia/GpuAmd/GpuIntel 区分）
    let gpu_types: Vec<&str> = {
        let mut types: Vec<&str> = response
            .sensors
            .iter()
            .filter(|s| {
                let t = s.hardware_type.to_lowercase();
                t.starts_with("gpu")
            })
            .map(|s| s.hardware_type.as_str())
            .collect();
        types.dedup();
        types
    };

    // 优先选 GpuAmd/GpuNvidia，跳过 GpuIntel 核显
    let target_type = gpu_types
        .iter()
        .find(|t| {
            let tl = t.to_lowercase();
            tl.contains("amd") || tl.contains("nvidia")
        })
        .or_else(|| gpu_types.first())
        .copied();

    let target_type = match target_type {
        Some(t) => t,
        None => return empty_gpu(),
    };

    // 收集目标 GPU 的传感器
    let gpu_sensors: Vec<&SensorReading> = response
        .sensors
        .iter()
        .filter(|s| s.hardware_type == target_type)
        .collect();

    let name = gpu_sensors
        .first()
        .map(|s| s.hardware.clone())
        .unwrap_or_default();

    // GPU 使用率：sensor_type="Load" 且 name 含 "GPU Core"
    let usage = gpu_sensors
        .iter()
        .filter(|s| s.sensor_type == "Load" && (s.name.contains("GPU Core") || s.name == "D3D 3D"))
        .map(|s| s.value as f32)
        .next();

    // GPU 温度：sensor_type="Temperature" 且 name 含 "GPU Core"
    let temperature = gpu_sensors
        .iter()
        .filter(|s| s.sensor_type == "Temperature" && s.name.contains("GPU Core"))
        .map(|s| s.value as f32)
        .next();

    // 显存：sensor_type="SmallData" name 含 "GPU Memory" / "GPU Memory Used" / "GPU Memory Total"
    let used_memory_bytes = gpu_sensors
        .iter()
        .filter(|s| s.sensor_type == "SmallData" && s.name.to_lowercase().contains("memory used"))
        .map(|s| (s.value * 1024.0 * 1024.0 * 1024.0) as u64)
        .next();
    let total_memory_bytes = gpu_sensors
        .iter()
        .filter(|s| s.sensor_type == "SmallData" && s.name.to_lowercase().contains("memory total"))
        .map(|s| (s.value * 1024.0 * 1024.0 * 1024.0) as u64)
        .next();

    GpuStatus {
        name,
        usage,
        temperature,
        total_memory_bytes,
        used_memory_bytes,
    }
}

/// 空 GPU 状态（LHM 不可用时的降级值）
fn empty_gpu() -> GpuStatus {
    GpuStatus {
        name: String::new(),
        usage: None,
        temperature: None,
        total_memory_bytes: None,
        used_memory_bytes: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_win32_roundtrip() {
        // 仅 Windows 下验证映射
        #[cfg(windows)]
        {
            for p in ProcessPriority::all() {
                let class = p.to_win32_class();
                let back = ProcessPriority::from_win32_class(class);
                assert_eq!(p, back, "优先级 {:?} 往返不一致", p);
            }
        }
    }

    #[test]
    fn test_is_protected() {
        assert!(is_protected("explorer.exe"));
        assert!(is_protected("EXPLORER.EXE"));
        assert!(is_protected("svchost.exe"));
        assert!(!is_protected("chrome.exe"));
        assert!(!is_protected("notepad.exe"));
    }

    #[test]
    fn test_default_blacklist_not_protected() {
        // 默认黑名单不应包含被保护进程
        for b in DEFAULT_BLACKLIST {
            assert!(!is_protected(b), "黑名单默认项 {} 不应是被保护进程", b);
        }
    }
}
