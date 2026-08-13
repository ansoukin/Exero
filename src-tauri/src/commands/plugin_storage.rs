//! 插件存储命令（Phase 3 补充）
//!
//! 供插件 iframe 桥接的 `window.exero.storage.*` 调用，由宿主后端代为持久化。
//! 数据按 pack_id 隔离，落盘到 `%APPDATA%/Exero/plugin-data/{pack_id}.json`。

use std::sync::Arc;

use serde_json::Value;
use tauri::State;

use crate::error::Result;
use crate::state::AppState;

/// 读取插件存储中的键值（不存在返回 null）
#[tauri::command]
pub async fn plugin_storage_get(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
    key: String,
) -> Result<Option<Value>> {
    Ok(state.plugin_storage.get(&pack_id, &key))
}

/// 写入插件存储中的键值（value 为任意 JSON）
#[tauri::command]
pub async fn plugin_storage_set(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
    key: String,
    value: Value,
) -> Result<()> {
    state.plugin_storage.set(&pack_id, &key, value)
}

/// 删除插件存储中的键（键不存在也返回成功）
#[tauri::command]
pub async fn plugin_storage_remove(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
    key: String,
) -> Result<()> {
    state.plugin_storage.remove(&pack_id, &key)
}

/// 清空该插件的全部存储数据
#[tauri::command]
pub async fn plugin_storage_clear(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
) -> Result<()> {
    state.plugin_storage.clear(&pack_id)
}

/// 列出该插件的全部存储键
#[tauri::command]
pub async fn plugin_storage_keys(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
) -> Result<Vec<String>> {
    Ok(state.plugin_storage.keys(&pack_id))
}
