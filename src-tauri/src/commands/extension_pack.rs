//! 扩展包命令（Beta3 · 扩展包架构）
//!
//! 暴露扩展包管理与查询命令：
//! - `list_action_catalog`：返回完整动作目录（所有扩展包动作合集），供前端 NodePalette 渲染
//! - `list_installed_packs`：返回已安装扩展包列表
//! - `get_pack_detail`：返回指定扩展包详情
//! - `get_sidebar_entries`：返回扩展包注册的侧边栏入口（阶段 c 侧边栏动态渲染用）
//! - `reload_packs`：重新扫描扩展包目录（安装/卸载/改自定义目录后调用）
//! - `get_extension_pack_user_dir` / `set_extension_pack_user_dir`：用户自定义目录读写
//! - `install_pack_from_file`：从 .exero-pack（zip）文件安装扩展包到可写目录
//! - `uninstall_pack`：卸载扩展包（builtin 不可卸载）
//! - `open_packs_dir`：在文件管理器中打开扩展包目录

use std::io::Read;
use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::db::Repository;
use crate::error::{AppError, Result};
use crate::extension_pack::{
    ActionManifest, ExecutorType, ExtensionPackManifest, PackSource, PackType, SidebarManifest,
};
use crate::models::{ScriptManifest, Setting};
use crate::state::AppState;

/// 已安装扩展包摘要（列表项）
#[derive(Debug, Serialize)]
pub struct PackSummary {
    /// 扩展包 id
    pub id: String,
    /// 扩展包版本号
    pub version: String,
    /// 扩展包显示名
    pub name: String,
    /// 扩展包描述
    pub description: String,
    /// 作者
    pub author: String,
    /// 所需 Exero API 版本
    pub exero_api_version: String,
    /// 扩展包类型：action
    pub pack_type: String,
    /// 动作数量
    pub action_count: usize,
    /// 是否注册侧边栏入口
    pub has_sidebar: bool,
    /// 来源目录类型：builtin / user / custom
    pub source: String,
}

/// 扩展包详情（含完整 manifest）
#[derive(Debug, Serialize)]
pub struct PackDetail {
    /// 扩展包摘要
    pub summary: PackSummary,
    /// 完整 manifest
    pub manifest: ExtensionPackManifest,
    /// 扩展包根目录路径
    pub pack_dir: String,
}

/// 侧边栏入口（含所属扩展包 id）
#[derive(Debug, Serialize)]
pub struct SidebarEntry {
    /// 所属扩展包 id
    pub pack_id: String,
    /// 侧边栏 manifest
    pub sidebar: SidebarManifest,
}

/// 将 PackSource 转为字符串标识
fn source_str(source: PackSource) -> &'static str {
    match source {
        PackSource::Builtin => "builtin",
        PackSource::User => "user",
        PackSource::Custom => "custom",
    }
}

/// 将 PackType 转为字符串标识
fn pack_type_str(t: PackType) -> &'static str {
    match t {
        PackType::Action => "action",
        PackType::Plugin => "plugin",
    }
}

/// 从 LoadedExtensionPack 生成 PackSummary
fn pack_to_summary(pack: &crate::extension_pack::LoadedExtensionPack) -> PackSummary {
    PackSummary {
        id: pack.manifest.id.clone(),
        version: pack.manifest.version.clone(),
        name: pack.manifest.name.clone(),
        description: pack.manifest.description.clone(),
        author: pack.manifest.author.clone(),
        exero_api_version: pack.manifest.exero_api_version.clone(),
        pack_type: pack_type_str(pack.manifest.pack_type).to_string(),
        action_count: pack.manifest.actions.len(),
        has_sidebar: pack.manifest.sidebar.is_some(),
        source: source_str(pack.source).to_string(),
    }
}

/// 获取完整动作目录（所有扩展包动作合集）
///
/// 前端 NodePalette 从此命令拉取动作列表渲染。
/// 返回的每个 ActionManifest 包含 id/label/category/icon/default_params/ports 等元数据。
#[tauri::command]
pub async fn list_action_catalog(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<ActionManifest>> {
    Ok(state.extension_pack_registry.get_action_catalog())
}

/// 获取已安装扩展包列表
#[tauri::command]
pub async fn list_installed_packs(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PackSummary>> {
    let packs = state.extension_pack_registry.list_packs();
    Ok(packs.iter().map(pack_to_summary).collect())
}

/// 获取指定扩展包详情
#[tauri::command]
pub async fn get_pack_detail(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
) -> Result<Option<PackDetail>> {
    let pack = state.extension_pack_registry.get_pack(&pack_id);
    Ok(pack.map(|p| PackDetail {
        summary: pack_to_summary(&p),
        manifest: p.manifest,
        pack_dir: p.pack_dir.to_string_lossy().to_string(),
    }))
}

/// 获取扩展包注册的侧边栏入口列表
///
/// 阶段 c 侧边栏动态渲染时调用。
#[tauri::command]
pub async fn get_sidebar_entries(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SidebarEntry>> {
    let entries = state.extension_pack_registry.get_sidebar_entries();
    Ok(entries
        .into_iter()
        .map(|(pack_id, sidebar)| SidebarEntry { pack_id, sidebar })
        .collect())
}

/// 重新扫描扩展包目录（安装/卸载/改自定义目录后调用）
///
/// 从 settings 读取用户自定义目录，扫描只读 + 可写 + 自定义三个目录。
#[tauri::command]
pub async fn reload_packs(state: State<'_, Arc<AppState>>) -> Result<usize> {
    let custom_dir = {
        let repo = Repository::new(&state.db);
        repo.get_setting("extension_pack.user_dir")
            .ok()
            .flatten()
            .map(|s| s.value)
            .filter(|v| !v.trim().is_empty())
            .map(PathBuf::from)
    };
    let count = state
        .extension_pack_registry
        .load_with_custom_dir(custom_dir)?;

    // 重新加载 Rust .dll（Beta5 Phase 2）
    state.reload_rust_libraries();

    Ok(count)
}

/// 获取用户自定义扩展包目录
///
/// 返回 settings 中 `extension_pack.user_dir` 的值，未设置时返回空字符串。
#[tauri::command]
pub async fn get_extension_pack_user_dir(
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let repo = Repository::new(&state.db);
    Ok(repo
        .get_setting("extension_pack.user_dir")
        .ok()
        .flatten()
        .map(|s| s.value)
        .unwrap_or_default())
}

/// 设置用户自定义扩展包目录
///
/// 写入 settings 表 `extension_pack.user_dir` 键。
/// 传入空字符串表示清除自定义目录（仅使用默认两个目录）。
/// 设置后不会自动重新加载，需前端调用 `reload_packs`。
#[tauri::command]
pub async fn set_extension_pack_user_dir(
    state: State<'_, Arc<AppState>>,
    dir: String,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    let setting = Setting::new("extension_pack.user_dir", dir, "string");
    repo.set_setting(&setting)?;
    tracing::info!("用户自定义扩展包目录已更新: {}", setting.value);
    Ok(())
}

/// 获取默认扩展包目录信息（供前端展示）
///
/// 返回只读目录和可写目录的路径。
#[derive(Debug, Serialize, Default)]
pub struct PackDirsInfo {
    /// 只读目录（base-pack 所在）
    pub builtin_dir: String,
    /// 可写目录（用户扩展包）
    pub user_dir: String,
}

#[tauri::command]
pub async fn get_pack_dirs_info() -> Result<PackDirsInfo> {
    let builtin_dir = crate::extension_pack::ExtensionPackLoader::builtin_packs_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let user_dir = crate::extension_pack::ExtensionPackLoader::user_packs_dir()
        .to_string_lossy()
        .to_string();
    Ok(PackDirsInfo { builtin_dir, user_dir })
}

// ============================================================
// 安装 / 卸载 / 打开目录（阶段 c · 扩展市场 UI）
// ============================================================

/// 从 .exero-pack 文件安装扩展包
///
/// 文件格式：zip，内含 manifest.json + 资源文件（扁平结构，manifest.json 在根目录）。
///
/// 安装流程：
/// 1. 打开 zip 文件，读取 manifest.json 获取 pack_id
/// 2. 解压到 user_dir/{pack_id}/（覆盖已存在的同名扩展包）
/// 3. 重新加载扩展包注册表
/// 4. 返回安装后的 PackSummary
#[tauri::command]
pub async fn install_pack_from_file(
    state: State<'_, Arc<AppState>>,
    file_path: String,
) -> Result<PackSummary> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "扩展包文件不存在: {}",
            file_path
        )));
    }

    // 打开 zip
    let file = std::fs::File::open(&path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Other(format!("zip 文件打开失败: {}", e)))?;

    // 先读取 manifest.json 获取 pack_id
    let manifest_str = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|e| AppError::Other(format!("zip 内未找到 manifest.json: {}", e)))?;
        let mut content = String::new();
        manifest_file.read_to_string(&mut content)?;
        content
    };
    let manifest: ExtensionPackManifest = serde_json::from_str(&manifest_str)
        .map_err(|e| AppError::Other(format!("manifest.json 解析失败: {}", e)))?;
    let pack_id = manifest.id.clone();

    // 目标目录：user_dir/{pack_id}/
    let user_dir = crate::extension_pack::ExtensionPackLoader::user_packs_dir();
    let target_dir = user_dir.join(&pack_id);

    // 如果已存在，先删除（覆盖安装）
    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir)?;
        tracing::info!("已删除旧版本扩展包目录: {}", target_dir.display());
    }
    std::fs::create_dir_all(&target_dir)?;

    // 解压所有文件（跳过目录条目）
    for i in 0..archive.len() {
        let mut zip_file = archive
            .by_index(i)
            .map_err(|e| AppError::Other(format!("读取 zip 条目失败: {}", e)))?;
        let name = zip_file.name().to_string();
        if name.ends_with('/') {
            continue; // 跳过目录
        }
        let out_path = target_dir.join(&name);
        // 创建父目录
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out_file = std::fs::File::create(&out_path)?;
        std::io::copy(&mut zip_file, &mut out_file)?;
    }

    tracing::info!(
        "扩展包 {} v{} 已安装到 {}",
        pack_id,
        manifest.version,
        target_dir.display()
    );

    // 重新加载扩展包注册表
    reload_registry(&state)?;

    // Lua 动作注册：检查 actions[] 中是否有 executor_type = Lua 的动作
    let has_lua_actions = manifest
        .actions
        .iter()
        .any(|a| a.executor_type == ExecutorType::Lua);
    if has_lua_actions {
        register_pack_scripts(&state, &manifest, &target_dir)?;
    }

    // 返回安装后的 PackSummary
    let pack = state
        .extension_pack_registry
        .get_pack(&pack_id)
        .ok_or_else(|| AppError::Other(format!("扩展包 {} 安装后加载失败", pack_id)))?;

    Ok(pack_to_summary(&pack))
}

/// 卸载扩展包
///
/// 支持卸载所有来源的扩展包（包括 builtin，因 base-pack 已改为在线安装，不再内置捆绑）。
/// 卸载逻辑：按来源定位目录 → 删除 → 重新加载注册表。
#[tauri::command]
pub async fn uninstall_pack(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
) -> Result<()> {
    // 查找扩展包，确认来源
    let pack = state
        .extension_pack_registry
        .get_pack(&pack_id)
        .ok_or_else(|| AppError::NotFound(format!("扩展包 {} 不存在", pack_id)))?;

    // Lua 动作注销：检查是否有 Lua 动作需要从数据库清理
    let has_lua_actions = pack
        .manifest
        .actions
        .iter()
        .any(|a| a.executor_type == ExecutorType::Lua);
    if has_lua_actions {
        unregister_pack_scripts(&state, &pack.manifest)?;
    }

    // Rust .dll 卸载：先 FreeLibrary 再删除目录，避免文件占用（Beta5 Phase 2）
    if pack.manifest.rust_library.is_some() {
        state.rust_library_registry.unload(&pack_id)?;
        state.registry.unregister_extension_pack(&pack_id);
    }

    let custom_dir = read_custom_dir(&state);

    match pack.source {
        PackSource::Builtin => {
            // base-pack 已改为在线安装，builtin 目录默认为空；
            // 若仍有文件（开发模式 data/action-packs/），尝试删除
            if let Ok(builtin_dir) =
                crate::extension_pack::ExtensionPackLoader::builtin_packs_dir()
            {
                let pack_dir = builtin_dir.join(&pack_id);
                if pack_dir.exists() {
                    std::fs::remove_dir_all(&pack_dir)?;
                    tracing::info!("已删除 builtin 目录扩展包: {}", pack_dir.display());
                }
            }
        }
        PackSource::User => {
            let user_dir = crate::extension_pack::ExtensionPackLoader::user_packs_dir();
            let pack_dir = user_dir.join(&pack_id);
            if pack_dir.exists() {
                std::fs::remove_dir_all(&pack_dir)?;
                tracing::info!("已删除扩展包目录: {}", pack_dir.display());
            }
        }
        PackSource::Custom => {
            if let Some(custom) = custom_dir {
                let pack_dir = custom.join(&pack_id);
                if pack_dir.exists() {
                    std::fs::remove_dir_all(&pack_dir)?;
                    tracing::info!("已删除自定义目录扩展包: {}", pack_dir.display());
                }
            }
        }
    }

    // 重新加载扩展包注册表
    reload_registry(&state)?;

    tracing::info!("扩展包 {} 已卸载", pack_id);
    Ok(())
}

/// 在文件管理器中打开扩展包目录
///
/// dir_type: "user"（可写目录）/ "builtin"（只读目录）
#[tauri::command]
pub async fn open_packs_dir(dir_type: String) -> Result<()> {
    let dir = match dir_type.as_str() {
        "builtin" => crate::extension_pack::ExtensionPackLoader::builtin_packs_dir()?,
        _ => crate::extension_pack::ExtensionPackLoader::user_packs_dir(),
    };

    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }

    open::that(&dir).map_err(|e| AppError::Other(format!("打开目录失败: {}", e)))?;
    Ok(())
}

/// 执行插件动作（Phase 3 新增）
///
/// 供插件 iframe 通过桥接 API 调用，路由到 .dll 的 `exero_execute_action`。
/// 与 Flow 编辑器中的动作执行不同，此命令直接调用 .dll，不走 ActionExecutorRegistry。
#[tauri::command]
pub async fn execute_plugin_action(
    state: State<'_, Arc<AppState>>,
    pack_id: String,
    action_id: String,
    params: serde_json::Value,
) -> Result<serde_json::Value> {
    let params_json = serde_json::to_string(&params)?;
    let result_json = state
        .rust_library_registry
        .execute(&pack_id, &action_id, &params_json)?;
    let output: serde_json::Value = serde_json::from_str(&result_json).map_err(|e| {
        AppError::ActionExecution(format!(
            "插件动作返回值 JSON 解析失败 (pack_id={} action_id={}): {}",
            pack_id, action_id, e
        ))
    })?;
    Ok(output)
}

// ============================================================
// 内部辅助函数
// ============================================================

/// 从 settings 读取用户自定义扩展包目录
fn read_custom_dir(state: &State<'_, Arc<AppState>>) -> Option<PathBuf> {
    let repo = Repository::new(&state.db);
    repo.get_setting("extension_pack.user_dir")
        .ok()
        .flatten()
        .map(|s| s.value)
        .filter(|v| !v.trim().is_empty())
        .map(PathBuf::from)
}

/// 重新加载扩展包注册表（读取自定义目录 + 扫描三目录）
///
/// 同时重新加载 Rust .dll（Beta5 Phase 2）。
fn reload_registry(state: &State<'_, Arc<AppState>>) -> Result<()> {
    let custom_dir = read_custom_dir(state);
    state.extension_pack_registry.load_with_custom_dir(custom_dir)?;
    state.reload_rust_libraries();
    Ok(())
}

// ============================================================
// Lua 动作注册 / 注销（actions[] 中 executor_type = Lua 的条目）
// ============================================================

/// 获取 Lua 脚本目录 `<exe>/data/scripts/`，不存在则创建
fn scripts_dir() -> Result<PathBuf> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    let dir = exe_dir.join("data").join("scripts");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// 注册 Lua 动作到数据库
///
/// 遍历 actions[] 中 executor_type = Lua 的条目，
/// 将 .lua 文件复制到 scripts 目录，并在 lua_scripts 表中插入/更新记录。
fn register_pack_scripts(
    state: &State<'_, Arc<AppState>>,
    manifest: &ExtensionPackManifest,
    pack_dir: &std::path::Path,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    let scripts_dir = scripts_dir()?;
    let source_url = format!("pack://{}", manifest.id);

    for action in &manifest.actions {
        if action.executor_type != ExecutorType::Lua {
            continue;
        }

        let lua_path = pack_dir.join(&action.executor_id);
        let lua_content = std::fs::read_to_string(&lua_path).map_err(|e| {
            AppError::Other(format!("读取脚本文件失败 {}: {}", lua_path.display(), e))
        })?;

        // 复制到 scripts 目录
        let dest_path = scripts_dir.join(format!("{}.lua", action.id));
        std::fs::write(&dest_path, &lua_content)?;

        let content_hash = sha256_hex(&lua_content);

        // 从 ActionManifest + 包级信息构造 ScriptManifest
        let script_manifest = ScriptManifest {
            id: action.id.clone(),
            name: action.label.clone(),
            author: manifest.author.clone(),
            version: manifest.version.clone(),
            description: if action.description.is_empty() {
                manifest.description.clone()
            } else {
                action.description.clone()
            },
            permissions: action.permissions.clone(),
            params: action.params.clone(),
        };

        // 已存在则更新，否则插入
        if repo.get_installed_script(&action.id)?.is_some() {
            repo.update_installed_script(&script_manifest, &content_hash)?;
        } else {
            repo.insert_installed_script(&script_manifest, &source_url, &content_hash)?;
        }

        tracing::info!("已注册脚本: {} (来自扩展包 {})", action.id, manifest.id);
    }
    Ok(())
}

/// 注销 Lua 动作
///
/// 从 lua_scripts 表删除记录，并删除 scripts 目录中的 .lua 文件。
fn unregister_pack_scripts(
    state: &State<'_, Arc<AppState>>,
    manifest: &ExtensionPackManifest,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    let scripts_dir = scripts_dir()?;

    for action in &manifest.actions {
        if action.executor_type != ExecutorType::Lua {
            continue;
        }

        if let Err(e) = repo.delete_installed_script(&action.id) {
            tracing::warn!("删除脚本记录失败 {}: {}", action.id, e);
        }
        let lua_path = scripts_dir.join(format!("{}.lua", action.id));
        if lua_path.exists() {
            let _ = std::fs::remove_file(&lua_path);
        }
        tracing::info!("已注销脚本: {} (来自扩展包 {})", action.id, manifest.id);
    }
    Ok(())
}

/// 计算 SHA256 十六进制
fn sha256_hex(text: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}
