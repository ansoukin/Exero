//! 扩展包加载器（Beta3 · 扩展包架构）
//!
//! 扫描扩展包目录，解析每个扩展包的 manifest.json，返回已加载的扩展包列表。
//!
//! 三目录扫描策略（阶段 b）：
//! 1. 只读目录（base-pack）：`<exe_dir>/data/action-packs/`，开发期回退到 `CARGO_MANIFEST_DIR/data/action-packs/`
//! 2. 可写目录（用户扩展包）：`%APPDATA%/Exero/action-packs/`（dirs::data_dir）
//! 3. 用户自定义目录：从 settings 表 `extension_pack.user_dir` 读取（可选）
//!
//! 去重规则：先加载的优先（只读目录 > 可写目录 > 自定义目录），同名扩展包不重复加载。

use std::path::{Path, PathBuf};

use super::manifest::ExtensionPackManifest;
use crate::error::{AppError, Result};

/// 扩展包加载器
///
/// 支持扫描多个目录，按顺序加载并去重。
pub struct ExtensionPackLoader {
    /// 待扫描的目录列表（按优先级排序）
    dirs: Vec<PathBuf>,
}

/// 已加载的扩展包
#[derive(Debug, Clone)]
pub struct LoadedExtensionPack {
    /// 扩展包根目录路径
    pub pack_dir: PathBuf,
    /// 解析后的 manifest
    pub manifest: ExtensionPackManifest,
    /// 来源目录类型
    pub source: PackSource,
}

/// 扩展包来源目录类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackSource {
    /// 只读内置目录（base-pack 所在）
    Builtin,
    /// 用户可写目录（AppData）
    User,
    /// 用户自定义目录
    Custom,
}

impl ExtensionPackLoader {
    /// 创建加载器，扫描所有默认目录
    ///
    /// 顺序：只读目录 → 可写目录 → 用户自定义目录（如有）
    pub fn new_default() -> Result<Self> {
        let dirs = vec![
            Self::builtin_packs_dir()?,
            Self::user_packs_dir(),
        ];
        // 用户自定义目录由 Registry 从 settings 读取后注入
        Ok(Self { dirs })
    }

    /// 创建加载器，扫描所有默认目录 + 用户自定义目录
    pub fn new_with_custom(custom_dir: Option<PathBuf>) -> Result<Self> {
        let mut dirs = vec![
            Self::builtin_packs_dir()?,
            Self::user_packs_dir(),
        ];
        if let Some(custom) = custom_dir {
            dirs.push(custom);
        }
        Ok(Self { dirs })
    }

    /// 使用指定目录列表创建加载器（测试用）
    pub fn with_dirs(dirs: Vec<PathBuf>) -> Self {
        Self { dirs }
    }

    /// 获取只读扩展包目录路径（base-pack 所在）
    ///
    /// 生产环境：`<exe_dir>/data/action-packs/`
    /// 开发环境：exe_dir 下无 data 目录时回退到 `CARGO_MANIFEST_DIR/data/action-packs/`
    pub fn builtin_packs_dir() -> Result<PathBuf> {
        let exe_dir = std::env::current_exe()?
            .parent()
            .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
            .to_path_buf();
        let prod_dir = exe_dir.join("data").join("action-packs");
        if prod_dir.exists() {
            return Ok(prod_dir);
        }
        // 开发期回退：CARGO_MANIFEST_DIR 在编译时注入，指向 src-tauri 目录
        let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("data").join("action-packs");
        Ok(dev_dir)
    }

    /// 获取用户可写扩展包目录路径
    ///
    /// Windows: `%APPDATA%/Exero/action-packs/`
    /// 目录不存在时自动创建。
    pub fn user_packs_dir() -> PathBuf {
        let base = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Exero")
            .join("action-packs");
        if !base.exists() {
            if let Err(e) = std::fs::create_dir_all(&base) {
                tracing::warn!("创建用户扩展包目录失败: {} - {}", base.display(), e);
            }
        }
        base
    }

    /// 扫描并加载所有目录中的扩展包
    ///
    /// 按目录顺序扫描，同名扩展包先加载的优先（去重）。
    /// 解析失败的扩展包会被跳过并记录警告，不影响其他扩展包加载。
    pub fn load_all(&self) -> Result<Vec<LoadedExtensionPack>> {
        let mut packs = Vec::new();
        let mut loaded_ids = std::collections::HashSet::new();

        for (idx, dir) in self.dirs.iter().enumerate() {
            let source = match idx {
                0 => PackSource::Builtin,
                1 => PackSource::User,
                _ => PackSource::Custom,
            };

            if !dir.exists() {
                tracing::info!("扩展包目录不存在，跳过: {} ({:?})", dir.display(), source);
                continue;
            }

            let dir_packs = self.load_dir(dir, source)?;
            for pack in dir_packs {
                if loaded_ids.contains(&pack.manifest.id) {
                    tracing::warn!(
                        "扩展包 {} 在 {} 中重复，已跳过（先加载的优先）",
                        pack.manifest.id,
                        dir.display()
                    );
                    continue;
                }
                loaded_ids.insert(pack.manifest.id.clone());
                packs.push(pack);
            }
        }

        tracing::info!("共加载 {} 个扩展包", packs.len());
        Ok(packs)
    }

    /// 扫描单个目录，加载其中所有扩展包
    fn load_dir(&self, dir: &Path, source: PackSource) -> Result<Vec<LoadedExtensionPack>> {
        let mut packs = Vec::new();

        for entry in std::fs::read_dir(dir)? {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!("读取目录项失败，跳过: {}", e);
                    continue;
                }
            };
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                tracing::warn!("扩展包缺少 manifest.json，跳过: {}", path.display());
                continue;
            }

            match self.load_manifest(&manifest_path) {
                Ok(manifest) => {
                    tracing::info!(
                        "已加载扩展包: {} v{} ({} 个动作, {:?})",
                        manifest.id,
                        manifest.version,
                        manifest.actions.len(),
                        source
                    );
                    packs.push(LoadedExtensionPack {
                        pack_dir: path,
                        manifest,
                        source,
                    });
                }
                Err(e) => {
                    tracing::warn!(
                        "扩展包 manifest 解析失败，跳过: {} - {}",
                        path.display(),
                        e
                    );
                }
            }
        }

        Ok(packs)
    }

    /// 解析单个 manifest.json 文件
    fn load_manifest(&self, manifest_path: &Path) -> Result<ExtensionPackManifest> {
        let content = std::fs::read_to_string(manifest_path)?;
        let manifest: ExtensionPackManifest = serde_json::from_str(&content)
            .map_err(|e| AppError::Other(format!("manifest.json 解析失败: {}", e)))?;
        Ok(manifest)
    }
}
