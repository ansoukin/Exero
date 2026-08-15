//! 触发器模块
//!
//! 提供 3 类触发器调度能力：
//! - **时间类**：Cron 定时触发（cron 表达式 + 课表触发）
//! - **系统事件类**：开机/关机/登录/锁屏/USB/网络/进程（部分 Phase 1 实现）
//! - **手动类**：首页按钮 / 托盘菜单调用
//!
//! 调度器由 `TriggerScheduler` 统一管理，从数据库加载启用的触发器，
//! 启动后台 tokio 任务执行调度。

pub mod scheduler;
pub mod cron;
pub mod course;
pub mod system_event;
pub mod manual;

pub use scheduler::TriggerScheduler;
pub use manual::ManualTriggerHandle;
