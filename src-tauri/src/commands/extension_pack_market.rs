//! 扩展包在线市场命令（Beta3 阶段 c · 扩展市场）
//!
//! 对接 GitHub 仓库 `ansoukin/Exero` 的 `Market/` 目录，
//! 提供 .exero-pack 扩展包的在线浏览 / 安装 / 更新 / 卸载能力。
//!
//! 市场目录结构（统一存放于 `Market/` 下）：
//! - `Market/action-packs/`：动作包（pack_type=action）
//! - `Market/lua-scripts/`：Lua 脚本包（pack_type=lua_scripts）
//!
//! 网络策略（与 lua.rs 一致）：github.com 主 → ghproxy 镜像后备 → 离线模式（仅已安装）。
//!
//! 与 commands/extension_pack.rs 的关系：
//! - 本模块负责在线市场（GitHub 拉取列表 + 下载安装）
//! - commands/extension_pack.rs 负责本地管理（已安装列表 / 本地文件安装 / 卸载 / 目录）

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, Result};
use crate::extension_pack::PackType;
use crate::state::AppState;

/// GitHub 仓库所有者
const GITHUB_OWNER: &str = "ansoukin";
/// GitHub 仓库名
const GITHUB_REPO: &str = "Exero";
/// 动作包目录（存放 pack_type=action 的 .exero-pack 文件）
const ACTION_PACKS_PATH: &str = "Market/action-packs";
/// Lua 脚本包目录（存放 pack_type=lua_scripts 的 .exero-pack 文件）
const LUA_SCRIPTS_PATH: &str = "Market/lua-scripts";
/// ghproxy 镜像前缀
const GHPROXY_BASE: &str = "https://ghproxy.com";

/// 在线市场扩展包摘要
///
/// 由 GitHub Contents API 列出 Market/action-packs/ + Market/lua-scripts/ 目录下的 .exero-pack 文件，
/// 再逐个下载 zip 内的 manifest.json 提取元数据。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPack {
    /// 扩展包 id（来自 manifest）
    pub id: String,
    /// 显示名
    pub name: String,
    /// 版本
    pub version: String,
    /// 描述
    pub description: Option<String>,
    /// 作者
    pub author: Option<String>,
    /// exero_api_version
    pub exero_api_version: String,
    /// 扩展包类型：action / lua_scripts
    pub pack_type: String,
    /// 动作数量（pack_type = action 时有意义）
    pub action_count: usize,
    /// Lua 脚本数量（pack_type = lua_scripts 时有意义）
    pub script_count: usize,
    /// 是否注册侧边栏入口
    pub has_sidebar: bool,
    /// 下载 URL（raw.githubusercontent.com）
    pub download_url: String,
    /// 文件名（如 base-pack.exero-pack）
    pub file_name: String,
    /// 文件大小（字节，来自 GitHub API size 字段）
    pub size: u64,
    /// 是否已安装
    pub installed: bool,
    /// 已安装版本（如已安装）
    pub installed_version: Option<String>,
    /// 是否有更新（已安装版本 < 市场版本）
    pub update_available: bool,
}

/// GitHub Contents API 返回的文件项
#[derive(Deserialize)]
struct GithubContent {
    /// 文件名（如 "base-pack.exero-pack"）
    name: String,
    /// 文件大小（字节）
    size: u64,
    /// 下载 URL（raw.githubusercontent.com）
    download_url: Option<String>,
}

// ============ Tauri 命令 ============

/// 列出在线市场可用扩展包
///
/// 网络失败时进入离线模式，仅返回已安装扩展包（无更新检查）。
#[tauri::command]
pub async fn list_market_packs(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<MarketPack>> {
    // 已安装扩展包 id → version 映射
    let installed: std::collections::HashMap<String, String> = state
        .extension_pack_registry
        .list_packs()
        .into_iter()
        .map(|p| (p.manifest.id, p.manifest.version))
        .collect();

    // 拉取 Market/action-packs/ + Market/lua-scripts/ 两个目录合并
    let mut files: Vec<GithubContent> = Vec::new();
    match fetch_github_contents(ACTION_PACKS_PATH).await {
        Ok(f) => files.extend(f),
        Err(e) => tracing::warn!("action-packs 目录拉取失败: {}", e),
    }
    match fetch_github_contents(LUA_SCRIPTS_PATH).await {
        Ok(f) => files.extend(f),
        Err(e) => tracing::warn!("lua-scripts 目录拉取失败: {}", e),
    }

    if !files.is_empty() {
        // 筛选 .exero-pack 文件
        let pack_files: Vec<&GithubContent> = files
            .iter()
            .filter(|f| f.name.ends_with(".exero-pack"))
            .collect();

        let mut market: Vec<MarketPack> = Vec::new();
        for file in pack_files {
            // 下载 .exero-pack 并读取 manifest.json（失败则跳过）
            match fetch_pack_manifest(&file.download_url.clone().unwrap_or_default()).await {
                Ok(manifest) => {
                    let installed_info = installed.get(&manifest.id);
                    let installed_version = installed_info.cloned();
                    let update_available = match &installed_version {
                        Some(v) => version_gt(&manifest.version, v),
                        None => false,
                    };
                    market.push(MarketPack {
                        id: manifest.id.clone(),
                        name: manifest.name,
                        version: manifest.version,
                        description: opt_str(manifest.description),
                        author: opt_str(manifest.author),
                        exero_api_version: manifest.exero_api_version,
                        pack_type: pack_type_str(manifest.pack_type).to_string(),
                        action_count: manifest.actions.len(),
                        script_count: manifest.scripts.len(),
                        has_sidebar: manifest.sidebar.is_some(),
                        download_url: file.download_url.clone().unwrap_or_default(),
                        file_name: file.name.clone(),
                        size: file.size,
                        installed: installed_info.is_some(),
                        installed_version,
                        update_available,
                    });
                }
                Err(e) => {
                    tracing::warn!(
                        "扩展包 {} manifest 读取失败，跳过: {}",
                        file.name,
                        e
                    );
                }
            }
        }
        Ok(market)
    } else {
        tracing::warn!("两个市场目录均拉取失败，进入离线模式");
        // 离线模式：仅返回已安装扩展包（无 download_url）
        let mut market: Vec<MarketPack> = Vec::new();
        for (id, version) in installed {
            // 尝试从注册表获取完整信息
            if let Some(pack) = state.extension_pack_registry.get_pack(&id) {
                market.push(MarketPack {
                    id: pack.manifest.id,
                    name: pack.manifest.name,
                    version: pack.manifest.version,
                    description: opt_str(pack.manifest.description),
                    author: opt_str(pack.manifest.author),
                    exero_api_version: pack.manifest.exero_api_version,
                    pack_type: pack_type_str(pack.manifest.pack_type).to_string(),
                    action_count: pack.manifest.actions.len(),
                    script_count: pack.manifest.scripts.len(),
                    has_sidebar: pack.manifest.sidebar.is_some(),
                    download_url: String::new(),
                    file_name: String::new(),
                    size: 0,
                    installed: true,
                    installed_version: Some(version),
                    update_available: false,
                });
            }
        }
        Ok(market)
    }
}

/// 从 GitHub 下载并安装扩展包
///
/// 下载 .exero-pack（zip）到临时文件，复用 install_pack_from_file 逻辑。
/// download_url 为 raw.githubusercontent.com 直链。
#[tauri::command]
pub async fn install_pack_from_github(
    state: State<'_, Arc<AppState>>,
    download_url: String,
    file_name: String,
) -> Result<crate::commands::extension_pack::PackSummary> {
    if download_url.is_empty() {
        return Err(AppError::InvalidArgument(
            "download_url 为空（可能处于离线模式）".into(),
        ));
    }

    // 下载到临时文件
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!(
        "exero-pack-{}-{}",
        file_name,
        chrono::Utc::now().timestamp_millis()
    ));

    tracing::info!("开始下载扩展包: {} -> {}", download_url, temp_path.display());

    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    // 主源下载
    let downloaded = download_to_file(&client, &download_url, &temp_path).await;
    if downloaded.is_err() {
        // 镜像后备
        let mirror = mirror_url(&download_url);
        tracing::info!("主源下载失败，尝试镜像: {}", mirror);
        download_to_file(&client, &mirror, &temp_path).await?;
    }

    tracing::info!("扩展包下载完成，开始安装: {}", temp_path.display());

    // 复用本地安装逻辑
    let summary = crate::commands::extension_pack::install_pack_from_file(
        state,
        temp_path.to_string_lossy().to_string(),
    )
    .await?;

    // 清理临时文件
    let _ = std::fs::remove_file(&temp_path);

    Ok(summary)
}

// ============ 内部辅助函数 ============

/// 拉取 GitHub Contents API 列出指定目录
async fn fetch_github_contents(path: &str) -> Result<Vec<GithubContent>> {
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        GITHUB_OWNER, GITHUB_REPO, path
    );
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    let resp = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("GitHub API 请求失败: {}", e)))?;
    if !resp.status().is_success() {
        return Err(AppError::Other(format!(
            "GitHub API 返回 {}",
            resp.status()
        )));
    }
    let files: Vec<GithubContent> = resp
        .json()
        .await
        .map_err(|e| AppError::Other(format!("GitHub API 解析失败: {}", e)))?;
    Ok(files)
}

/// 下载 .exero-pack 并读取其中的 manifest.json
///
/// 下载到内存后用 Cursor 读取 zip，仅提取 manifest（不保留字节）。
async fn fetch_pack_manifest(
    download_url: &str,
) -> Result<crate::extension_pack::ExtensionPackManifest> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    // 主源下载
    let bytes = match client.get(download_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            match resp.bytes().await {
                Ok(b) if !b.is_empty() => b.to_vec(),
                _ => return Err(AppError::Other("主源返回空内容".into())),
            }
        }
        _ => {
            // 镜像后备
            let mirror = mirror_url(download_url);
            tracing::info!("manifest 主源失败，尝试镜像: {}", mirror);
            let resp = client
                .get(&mirror)
                .send()
                .await
                .map_err(|e| AppError::Other(format!("镜像请求失败: {}", e)))?;
            if !resp.status().is_success() {
                return Err(AppError::Other(format!(
                    "镜像返回 {}",
                    resp.status()
                )));
            }
            resp.bytes()
                .await
                .map_err(|e| AppError::Other(format!("镜像读取失败: {}", e)))?
                .to_vec()
        }
    };

    // 从内存读 zip，提取 manifest.json
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::Other(format!("zip 解析失败: {}", e)))?;

    let manifest_file = archive
        .by_name("manifest.json")
        .map_err(|e| AppError::Other(format!("zip 内未找到 manifest.json: {}", e)))?;

    let manifest: crate::extension_pack::ExtensionPackManifest =
        serde_json::from_reader(manifest_file)
            .map_err(|e| AppError::Other(format!("manifest 解析失败: {}", e)))?;

    Ok(manifest)
}

/// 下载 URL 内容到文件
async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    dest: &std::path::Path,
) -> Result<()> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("下载请求失败: {}", e)))?;
    if !resp.status().is_success() {
        return Err(AppError::Other(format!(
            "下载返回 {}",
            resp.status()
        )));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Other(format!("下载读取失败: {}", e)))?;
    std::fs::write(dest, &bytes)?;
    Ok(())
}

/// 构造 ghproxy 镜像 URL
fn mirror_url(raw: &str) -> String {
    format!("{}/{}", GHPROXY_BASE, raw)
}

/// 空字符串转 None，非空转 Some
fn opt_str(s: String) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

/// PackType 转字符串标识
fn pack_type_str(t: PackType) -> &'static str {
    match t {
        PackType::Action => "action",
        PackType::LuaScripts => "lua_scripts",
    }
}

/// 简单语义化版本比较：a > b（x.y.z）
fn version_gt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.trim_start_matches('v')
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect()
    };
    let va = parse(a);
    let vb = parse(b);
    let len = va.len().max(vb.len());
    for i in 0..len {
        let ai = va.get(i).copied().unwrap_or(0);
        let bi = vb.get(i).copied().unwrap_or(0);
        if ai > bi {
            return true;
        }
        if ai < bi {
            return false;
        }
    }
    false
}
