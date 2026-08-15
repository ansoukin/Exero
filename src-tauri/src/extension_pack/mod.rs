//! 扩展包模块（Beta5 · 扩展机制重设计）
//!
//! 类比 MC 模组加载器（Forge/Fabric），Exero 将自身定位为"可扩展平台"：
//! - Exero 应用 = 加载器（Rust 后端：执行引擎 + Lua 引擎 + Rust .dll 加载器）
//! - 动作包（pack_type=action）= 提供动作积木的扩展，支持 Rust(.dll) 和 Lua(.lua) 两种 executor
//! - 插件（pack_type=plugin）= 提供完整功能页面的扩展（Phase 3 新增，含 iframe UI + 侧边栏入口）
//! - LuaScript 动作 = 命令方块（动作链内联脚本节点，用户自写，不在市场分发）
//!
//! V0.4.0-Beta5 变更：
//! - 原 pack_type: action | lua_scripts 合并为统一 action
//! - Lua 脚本通过 actions[] + executor_type: "Lua" 声明
//! - 新增 Rust .dll 动态加载（Phase 2）：动作包可声明 rust_library 字段，通过 C ABI 调用
//! - 市场列表优化为 market-index.json 索引（1 次请求代替逐个下载 zip）
//!
//! 架构层次：
//! - manifest.rs：Manifest 数据结构（ExtensionPackManifest / ActionManifest / ExecutorType）
//! - loader.rs：三目录扫描加载器（builtin 只读 > user 可写 > custom 自定义，先加载优先）
//! - rust_loader.rs：Rust .dll 动态加载器（libloading + C ABI，Phase 2 新增）
//! - native_dll.rs：NativeDllExecutor，将 .dll 动作接入 ActionExecutor 注册表（Phase 2 新增）
//! - ExtensionPackRegistry：注册表中心，持有已加载包列表，提供动作目录与侧边栏入口查询

pub mod manifest;
pub mod loader;
pub mod rust_loader;
pub mod native_dll;

pub use loader::{ExtensionPackLoader, LoadedExtensionPack, PackSource};
pub use manifest::*;
pub use native_dll::NativeDllExecutor;
pub use rust_loader::RustLibraryRegistry;

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
    ///
    /// Beta9 任务15（三源图标）：icon 以 `img:` 开头的动作（自定义图片图标），
    /// 在此重写为完整 plugin.localhost URL（前端 <PackIcon> 直接按图片渲染）。
    /// 侧边栏入口图标由前端用 packId 构造 URL，无需后端处理。
    pub fn get_action_catalog(&self) -> Vec<ActionManifest> {
        let packs = self.packs.read();
        let mut catalog = Vec::new();
        for pack in packs.iter() {
            for mut action in pack.manifest.actions.clone() {
                if action.icon.starts_with("img:") {
                    let rel = action.icon["img:".len()..].trim_start_matches('/');
                    action.icon = format!("http://plugin.localhost/{}/{}", pack.manifest.id, rel);
                }
                catalog.push(action);
            }
        }
        catalog
    }

    /// 获取扩展包注册的侧边栏入口列表
    ///
    /// V0.4.0-Beta5 Phase 3：侧边栏入口为插件独占能力，仅返回 pack_type=Plugin 的入口。
    pub fn get_sidebar_entries(&self) -> Vec<(String, SidebarManifest)> {
        let packs = self.packs.read();
        let mut entries = Vec::new();
        for pack in packs.iter() {
            // 仅插件可注册侧边栏入口
            if pack.manifest.pack_type == PackType::Plugin {
                if let Some(sidebar) = &pack.manifest.sidebar {
                    entries.push((pack.manifest.id.clone(), sidebar.clone()));
                }
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
