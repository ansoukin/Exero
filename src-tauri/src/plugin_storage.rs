//! 插件存储（Phase 3 补充 · 插件宿主存储 API）
//!
//! 为插件提供宿主管控的键值对存储，按插件（pack_id）隔离。
//!
//! 背景：插件 iframe 的 sandbox 未开启 `allow-same-origin`，浏览器 localStorage /
//! Cookie / IndexedDB 一律不可用（opaque origin）。若放开该 flag 又会让插件
//! 具备访问宿主数据的潜力，违反"插件与主程序隔离"的安全边界。
//!
//! 因此提供由主程序后端代为持久化的存储 API：插件通过桥接
//! `window.exero.storage.*` 读写，数据落盘到宿主数据目录，与插件完全隔离。
//!
//! 数据模型：每个插件一个 JSON 文件，内容为 `{ "key": value, ... }` 的扁平对象。
//! - 存储路径：`%APPDATA%/Exero/plugin-data/{pack_id}.json`
//! - 内存中维护按 pack_id 分片的缓存，避免每次读取都做磁盘 IO。
//! - 用 `parking_lot::Mutex` 保证并发安全。

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use parking_lot::Mutex;
use serde_json::{Map, Value};

use crate::error::AppError;
use crate::error::Result;

/// 插件存储管理器
pub struct PluginStorage {
    /// 存储根目录（`%APPDATA%/Exero/plugin-data/`）
    base_dir: PathBuf,
    /// 内存缓存：pack_id -> 键值对象
    cache: Mutex<HashMap<String, Map<String, Value>>>,
}

impl PluginStorage {
    /// 创建存储管理器，自动创建存储目录
    pub fn new() -> Self {
        let base_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Exero")
            .join("plugin-data");
        if !base_dir.exists() {
            if let Err(e) = fs::create_dir_all(&base_dir) {
                tracing::warn!("创建插件存储目录失败: {} - {}", base_dir.display(), e);
            }
        }
        Self {
            base_dir,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// 生成存储文件路径，pack_id 中的非法文件名字符替换为下划线
    fn file_path(&self, pack_id: &str) -> PathBuf {
        let safe = pack_id
            .chars()
            .map(|c| match c {
                '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                _ => c,
            })
            .collect::<String>();
        self.base_dir.join(format!("{safe}.json"))
    }

    /// 从磁盘读取某个插件的全部数据
    fn read_from_disk(&self, pack_id: &str) -> Map<String, Value> {
        let path = self.file_path(pack_id);
        match fs::read_to_string(&path) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Map::new(),
        }
    }

    /// 将某个插件的数据写入磁盘
    fn persist(&self, pack_id: &str, map: &Map<String, Value>) -> Result<()> {
        let path = self.file_path(pack_id);
        let data = serde_json::to_string_pretty(map)
            .map_err(|e| AppError::Other(format!("序列化插件存储失败: {e}")))?;
        fs::write(&path, data)
            .map_err(|e| AppError::Other(format!("写入插件存储失败 ({}): {}", path.display(), e)))
    }

    /// 读取键值（不存在返回 None）
    pub fn get(&self, pack_id: &str, key: &str) -> Option<Value> {
        let mut cache = self.cache.lock();
        let map = cache
            .get(pack_id)
            .cloned()
            .unwrap_or_else(|| self.read_from_disk(pack_id));
        cache.insert(pack_id.to_string(), map.clone());
        map.get(key).cloned()
    }

    /// 写入键值（值为任意 JSON，null 视为删除该键）
    pub fn set(&self, pack_id: &str, key: &str, value: Value) -> Result<()> {
        let mut cache = self.cache.lock();
        let mut map = cache
            .get(pack_id)
            .cloned()
            .unwrap_or_else(|| self.read_from_disk(pack_id));
        map.insert(key.to_string(), value);
        self.persist(pack_id, &map)?;
        cache.insert(pack_id.to_string(), map);
        Ok(())
    }

    /// 删除键（键不存在也返回 Ok）
    pub fn remove(&self, pack_id: &str, key: &str) -> Result<()> {
        let mut cache = self.cache.lock();
        let mut map = cache
            .get(pack_id)
            .cloned()
            .unwrap_or_else(|| self.read_from_disk(pack_id));
        map.remove(key);
        self.persist(pack_id, &map)?;
        cache.insert(pack_id.to_string(), map);
        Ok(())
    }

    /// 清空该插件的全部数据
    pub fn clear(&self, pack_id: &str) -> Result<()> {
        let mut cache = self.cache.lock();
        self.persist(pack_id, &Map::new())?;
        cache.insert(pack_id.to_string(), Map::new());
        Ok(())
    }

    /// 列出该插件的所有键
    pub fn keys(&self, pack_id: &str) -> Vec<String> {
        let mut cache = self.cache.lock();
        let map = cache
            .get(pack_id)
            .cloned()
            .unwrap_or_else(|| self.read_from_disk(pack_id));
        cache.insert(pack_id.to_string(), map.clone());
        map.keys().cloned().collect()
    }
}

impl Default for PluginStorage {
    fn default() -> Self {
        Self::new()
    }
}
