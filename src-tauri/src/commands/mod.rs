//! Tauri 命令模块
//!
//! 暴露给前端的 invoke 命令实现。所有命令通过 `tauri::generate_handler!` 注册。
//!
//! 命令分组：
//! - `db`：数据库相关（ping / get_db_info / run_migrations）
//! - `flows`：快捷指令 CRUD
//! - `actions`：动作管理
//! - `triggers`：触发器管理
//! - `execution`：执行与日志
//! - `settings`：设置读写
//! - `courses`：学期 / 节次 / 课程 / 临时调课
//! - `performance`：性能优化（硬件监控 / 进程管理 / 一键优化）
//! - `lua`：Lua 脚本市场（浏览 / 安装 / 更新 / 卸载）
//! - `test`：端到端测试

pub mod db;
pub mod flows;
pub mod actions;
pub mod triggers;
pub mod execution;
pub mod settings;
pub mod courses;
pub mod performance;
pub mod lua;
pub mod test;
