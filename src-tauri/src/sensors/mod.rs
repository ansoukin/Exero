//! 传感器模块（Beta9 · 任务3）
//!
//! 通过 ExeroMonitor.exe C# 子进程读取 LibreHardwareMonitorLib 传感器数据，
//! 覆盖 CPU/GPU/内存/主板的温度、使用率、时钟等。
//!
//! 子进程通过 stdin/stdout JSON 通信：
//! - 父进程写 `{"cmd":"read"}` → 子进程刷新传感器并返回 SensorsResponse
//! - 父进程写 `{"cmd":"exit"}` → 子进程退出
//!
//! 子进程路径：src-tauri/resources/monitor/ExeroMonitor.exe
//! 运行时通过 Tauri resource 协议解析到实际路径。

pub mod bridge;
pub mod reader;

pub use bridge::SensorBridge;
pub use reader::{read_sensors, start_sensor_process, stop_sensor_process};
