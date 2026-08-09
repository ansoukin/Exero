//! Lua 脚本本地管理命令
//!
//! 提供已安装脚本的查询能力（list_installed_scripts / get_script_detail）。
//! 市场分发已迁移至扩展市场（commands/extension_pack_market.rs），
//! Lua 脚本通过 .exero-pack（pack_type=action, executor_type=Lua）分发，安装后注册到数据库。

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::InstalledScript;
use crate::state::AppState;

/// 列出所有已安装脚本
#[tauri::command]
pub async fn list_installed_scripts(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<InstalledScript>> {
    let repo = Repository::new(&state.db);
    repo.list_installed_scripts()
}

/// 获取单个已安装脚本详情
#[tauri::command]
pub async fn get_script_detail(
    state: State<'_, Arc<AppState>>,
    script_id: String,
) -> Result<Option<InstalledScript>> {
    let repo = Repository::new(&state.db);
    repo.get_installed_script(&script_id)
}
