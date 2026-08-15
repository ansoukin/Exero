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
//! - `theme`：主题配置（读写 / Acrylic 窗口效果应用）
//! - `system`：系统集成（退出 / 隐藏窗口）
//! - `onboarding`：课表初始化向导（状态/提交/演示/跳过/重置）
//! - `update`：更新检查 + 应用信息 + 更新历史（Phase 6b）
//! - `io`：导入导出 .exero（Phase 6b · SPEC 5.5）
//! - `url_alias`：URL 短域名别名管理（Phase 6b · SPEC 11.3）
//! - `extension_pack`：扩展包管理（Beta3 · 动作目录 / 已安装列表 / 详情 / 本地安装/卸载）
//! - `extension_pack_market`：扩展包在线市场（Beta3 · GitHub 拉取列表 / 在线安装）
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
pub mod theme;
pub mod system;
pub mod onboarding;
pub mod update;
pub mod io;
pub mod url_alias;
pub mod extension_pack;
pub mod extension_pack_market;
pub mod plugin_storage;
pub mod test;
