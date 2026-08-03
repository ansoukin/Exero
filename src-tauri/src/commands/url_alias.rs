//! URL 短域名别名命令（Phase 6b · SPEC 11.3）
//!
//! 提供别名列表的读取、保存、重置命令。
//! 后端 OpenUrl 动作执行器自动从 settings 读取 `url.aliases` 并解析别名。
//!
//! 默认别名（SPEC 11.3）：baidu / google / github / bing
//! 用户可自由增删改，空别名或空目标自动忽略。

use std::sync::Arc;

use tauri::State;

use crate::error::Result;
use crate::models::UrlAlias;
use crate::state::AppState;

/// 获取 URL 别名列表
///
/// 键不存在或解析失败时返回空数组（向后兼容 Phase 5）。
#[tauri::command]
pub async fn get_url_aliases(state: State<'_, Arc<AppState>>) -> Result<Vec<UrlAlias>> {
    UrlAlias::load(&state.db)
}

/// 保存 URL 别名列表
///
/// 自动过滤空别名或空目标项。
#[tauri::command]
pub async fn set_url_aliases(
    state: State<'_, Arc<AppState>>,
    aliases: Vec<UrlAlias>,
) -> Result<()> {
    let filtered: Vec<UrlAlias> = aliases
        .into_iter()
        .filter(|a| !a.alias.trim().is_empty() && !a.target.trim().is_empty())
        .map(|mut a| {
            a.alias = a.alias.trim().to_string();
            a.target = a.target.trim().to_string();
            a
        })
        .collect();
    UrlAlias::save(&state.db, &filtered)
}

/// 重置 URL 别名为默认列表（SPEC 11.3）
#[tauri::command]
pub async fn reset_url_aliases(state: State<'_, Arc<AppState>>) -> Result<Vec<UrlAlias>> {
    let defaults = UrlAlias::defaults();
    UrlAlias::save(&state.db, &defaults)?;
    Ok(defaults)
}
