//! 监测器子进程桥接（Beta9 · 任务3）
//!
//! 管理 ExeroMonitor.exe 子进程的 stdin/stdout 管道通信。

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// LHML 传感器单条数据（与 C# SensorReading 对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub hardware: String,
    #[serde(rename = "hardwareType")]
    pub hardware_type: String,
    #[serde(rename = "subHardware")]
    pub sub_hardware: Option<String>,
    pub name: String,
    #[serde(rename = "sensorType")]
    pub sensor_type: String,
    pub value: f64,
    pub unit: Option<String>,
}

/// LHML 传感器响应（与 C# SensorsResponse 对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorsResponse {
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub sensors: Vec<SensorReading>,
}

/// 管道桥接：管理监测器子进程的 stdin/stdout
pub struct SensorBridge {
    pub child: Child,
    reader: BufReader<std::process::ChildStdout>,
    writer: std::process::ChildStdin,
}

impl SensorBridge {
    /// 发送读取命令，返回传感器数据
    pub fn read_sensors(&mut self) -> Result<SensorsResponse, String> {
        // 发送命令
        writeln!(self.writer, r#"{{"cmd":"read"}}"#)
            .map_err(|e| format!("写入管道失败: {}", e))?;
        self.writer
            .flush()
            .map_err(|e| format!("刷新管道失败: {}", e))?;

        // 读取响应
        let mut line = String::new();
        self.reader
            .read_line(&mut line)
            .map_err(|e| format!("读取管道失败: {}", e))?;

        if line.trim().is_empty() {
            return Err("子进程返回空响应".to_string());
        }

        serde_json::from_str::<SensorsResponse>(&line)
            .map_err(|e| format!("解析传感器JSON失败: {}", e))
    }

    /// 检查子进程是否仍然存活
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(None) => true,
            _ => false,
        }
    }

    /// 优雅关闭子进程
    pub fn shutdown(&mut self) {
        let _ = writeln!(self.writer, r#"{{"cmd":"exit"}}"#);
        let _ = self.writer.flush();
        let _ = self.child.wait();
    }
}

/// 全局传感器桥接
static SENSOR_BRIDGE: Mutex<Option<SensorBridge>> = Mutex::new(None);

/// 查找监测器 exe 路径（B9 第三阶段任务4：ExeroMonitor 自有子项目）
///
/// Exero 作为 Tauri 应用，运行时 exe 位于：
/// - 开发：src-tauri/target/{debug,release}/exero.exe，资源在 src-tauri/resources/
/// - 生产：安装目录/exero.exe，资源在 安装目录/resources/
///
/// 探测顺序：编译期源码路径（dev 直达）→ exe 旁路径（生产）
pub fn find_monitor_exe() -> Option<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()
        .ok()?
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or(std::path::PathBuf::from("."));

    let exe_name = "ExeroMonitor.exe";

    // 候选路径
    let candidates: Vec<std::path::PathBuf> = {
        let mut list = Vec::new();
        // 编译期源码路径（B9 三阶段 BUG 修复：CARGO_TARGET_DIR 外置到 C 盘时，
        // 从 exe 目录向上回溯永远跨不到源码盘符，dev 模式 LHM 从未启动过的根因）
        list.push(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("monitor")
                .join(exe_name),
        );
        // 生产安装：resources/monitor/{name}
        list.push(exe_dir.join("resources").join("monitor").join(exe_name));
        // 开发：src-tauri/resources/monitor/{name}（exe 在 target/debug 下）
        // 向上回溯最多 5 级查找 src-tauri
        let mut probe = exe_dir.clone();
        for _ in 0..6 {
            list.push(
                probe
                    .join("src-tauri")
                    .join("resources")
                    .join("monitor")
                    .join(exe_name),
            );
            list.push(probe.join("resources").join("monitor").join(exe_name));
            if !probe.pop() {
                break;
            }
        }
        list
    };

    for path in &candidates {
        if path.exists() {
            tracing::info!("找到监测器: {}", path.display());
            return Some(path.clone());
        }
    }

    tracing::warn!(
        "未找到 ExeroMonitor.exe (exe_dir: {}), 已尝试路径: {:?}",
        exe_dir.display(),
        candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>()
    );
    None
}

/// 启动传感器子进程
pub fn spawn_sensor() -> std::io::Result<Option<SensorBridge>> {
    let exe_path = match find_monitor_exe() {
        Some(p) => p,
        None => return Ok(None),
    };

    let mut cmd = Command::new(&exe_path);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    // Windows 下隐藏控制台窗口
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()?;

    let stdin = child.stdin.take().expect("无法获取子进程 stdin");
    let stdout = child.stdout.take().expect("无法获取子进程 stdout");

    let bridge = SensorBridge {
        child,
        reader: BufReader::new(stdout),
        writer: stdin,
    };

    Ok(Some(bridge))
}

/// 获取全局桥接的锁（供 reader 模块使用）
pub fn with_bridge_mut<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut Option<SensorBridge>) -> R,
{
    let mut guard = SENSOR_BRIDGE
        .lock()
        .map_err(|e| format!("锁获取失败: {}", e))?;
    Ok(f(&mut guard))
}

/// 重置桥接（启动失败或子进程死亡后重建用）
pub fn set_bridge(bridge: Option<SensorBridge>) {
    if let Ok(mut guard) = SENSOR_BRIDGE.lock() {
        *guard = bridge;
    }
}

/// 关闭并清理桥接
pub fn take_bridge() -> Option<SensorBridge> {
    SENSOR_BRIDGE.lock().ok().and_then(|mut g| g.take())
}
