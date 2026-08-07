//! 扩展包模块（Beta3 · 扩展包架构）
//!
//! 类比 MC 模组加载器（Forge/Fabric）：
//! - Exero 应用 = 加载器（Rust 后端：执行引擎 + Lua 引擎 + Rust API）
//! - 扩展包 = 模组（manifest.json 声明 + Lua/Rust 执行逻辑，注册新动作类型 + 侧边栏入口）
//! - LuaScript 动作 = 命令方块（动作链内联脚本节点，用户自写，不在市场分发）
//!
//! 阶段 a：架构层（manifest 解析 + 加载器 + 注册表 + list_action_catalog 命令）
//! 阶段 b：base-pack 外置 + 三目录扫描（只读/可写/自定义）+ 内置动作迁移
//! 阶段 c：扩展市场 UI + 侧边栏动态渲染 + 统一详情页 + 拖拽排序

pub mod manifest;
pub mod loader;

pub use loader::{ExtensionPackLoader, LoadedExtensionPack, PackSource};
pub use manifest::*;

use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;

use crate::error::Result;

/// 扩展包注册表
///
/// 持有已加载的扩展包列表，提供查询动作目录与侧边栏入口的方法。
/// 由 AppState 持有，在应用启动时加载。
pub struct ExtensionPackRegistry {
    /// 已加载的扩展包列表
    packs: RwLock<Vec<LoadedExtensionPack>>,
}

impl ExtensionPackRegistry {
    /// 创建空注册表
    pub fn new() -> Self {
        Self {
            packs: RwLock::new(Vec::new()),
        }
    }

    /// 从默认目录加载扩展包（不含用户自定义目录）
    ///
    /// 扫描只读目录（base-pack）+ 可写目录（AppData）。
    pub fn load_from_default_dir(&self) -> Result<usize> {
        let loader = ExtensionPackLoader::new_default()?;
        let packs = loader.load_all()?;
        let count = packs.len();
        *self.packs.write() = packs;
        tracing::info!("扩展包注册表已加载 {} 个扩展包", count);
        Ok(count)
    }

    /// 从默认目录 + 用户自定义目录加载扩展包
    ///
    /// 扫描只读目录 + 可写目录 + 用户自定义目录（如有）。
    /// 由 AppState 在启动时调用，传入从 settings 读取的自定义目录。
    pub fn load_with_custom_dir(&self, custom_dir: Option<PathBuf>) -> Result<usize> {
        let loader = ExtensionPackLoader::new_with_custom(custom_dir)?;
        let packs = loader.load_all()?;
        let count = packs.len();
        *self.packs.write() = packs;
        tracing::info!("扩展包注册表已加载 {} 个扩展包（含自定义目录）", count);
        Ok(count)
    }

    /// 获取已加载的扩展包列表（只读快照）
    pub fn list_packs(&self) -> Vec<LoadedExtensionPack> {
        self.packs.read().clone()
    }

    /// 获取完整动作目录（所有扩展包的动作合集）
    ///
    /// 返回所有可用动作的 manifest 元数据，供前端 NodePalette 渲染。
    /// base-pack 作为只读扩展包，其 20 种动作通过此方法暴露。
    pub fn get_action_catalog(&self) -> Vec<ActionManifest> {
        let packs = self.packs.read();
        let mut catalog = Vec::new();
        for pack in packs.iter() {
            catalog.extend(pack.manifest.actions.clone());
        }
        catalog
    }

    /// 获取扩展包注册的侧边栏入口列表
    ///
    /// 阶段 c 侧边栏动态渲染时使用。
    pub fn get_sidebar_entries(&self) -> Vec<(String, SidebarManifest)> {
        let packs = self.packs.read();
        let mut entries = Vec::new();
        for pack in packs.iter() {
            if let Some(sidebar) = &pack.manifest.sidebar {
                entries.push((pack.manifest.id.clone(), sidebar.clone()));
            }
        }
        entries
    }

    /// 按扩展包 id 查询
    pub fn get_pack(&self, pack_id: &str) -> Option<LoadedExtensionPack> {
        self.packs
            .read()
            .iter()
            .find(|p| p.manifest.id == pack_id)
            .cloned()
    }
}

impl Default for ExtensionPackRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// 共享的扩展包注册表类型（Arc 包装，供 AppState 持有）
pub type SharedExtensionPackRegistry = Arc<ExtensionPackRegistry>;
