//! 扩展包在线市场命令（Beta5 · 扩展机制重设计）
//!
//! 对接 GitHub 仓库 `ansoukin/Exero` 的 `Market/` 目录，
//! 提供 .exero-pack 扩展包的在线浏览 / 安装 / 更新 / 卸载能力。
//!
//! V0.4.0-Beta5 变更：
//! - 市场列表从"逐个下载 zip 读 manifest"优化为"只下载 market-index.json 索引"
//! - 目录结构：Market/action-packs/（原路径保持不变）+ Market/plugins/（Phase 3 新增）
//! - pack_type 统一为 action（lua_scripts 已合并）
//!
//! 市场目录结构（统一存放于 `Market/` 下）：
//! - `Market/market-index.json`：元数据索引（list_market_packs 只下载此文件）
//! - `Market/action-packs/`：动作包 .exero-pack
//! - `Market/plugins/`：插件 .exero-pack（Phase 3 新增）
//!
//! 网络策略：github.com 主 → ghproxy 镜像后备 → 离线模式（仅已安装）。
//!
//! 与 commands/extension_pack.rs 的关系：
//! - 本模块负责在线市场（GitHub 拉取索引 + 下载安装）
//! - commands/extension_pack.rs 负责本地管理（已安装列表 / 本地文件安装 / 卸载 / 目录）

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, Result};
use crate::state::AppState;

/// GitHub 仓库所有者
const GITHUB_OWNER: &str = "ansoukin";
/// GitHub 仓库名
const GITHUB_REPO: &str = "Exero";
/// 市场索引文件路径
const MARKET_INDEX_PATH: &str = "Market/market-index.json";

/// 在线市场扩展包摘要
///
/// 由 market-index.json 索引文件提供元数据，不再逐个下载 zip。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPack {
    /// 扩展包 id
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
    /// 扩展包类型：action
    pub pack_type: String,
    /// 动作数量
    pub action_count: usize,
    /// 是否注册侧边栏入口
    pub has_sidebar: bool,
    /// 下载 URL（raw.githubusercontent.com）
    pub download_url: String,
    /// 文件名（如 base-pack.exero-pack）
    pub file_name: String,
    /// 文件大小（字节）
    pub size: u64,
    /// 是否已安装
    pub installed: bool,
    /// 已安装版本（如已安装）
    pub installed_version: Option<String>,
    /// 是否有更新（已安装版本 < 市场版本）
    pub update_available: bool,
}

/// market-index.json 中的单个条目
#[derive(Debug, Deserialize)]
struct MarketIndexEntry {
    id: String,
    version: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    exero_api_version: String,
    /// 扩展包类型：action | plugin（旧索引可能为 null，视为 action）
    #[serde(default)]
    pack_type: Option<String>,
    file_name: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    action_count: usize,
    #[serde(default)]
    has_sidebar: bool,
    #[serde(default)]
    download_url: String,
}

/// market-index.json 根结构
#[derive(Debug, Deserialize)]
struct MarketIndex {
    #[serde(default)]
    actions: Vec<MarketIndexEntry>,
    #[serde(default)]
    plugins: Vec<MarketIndexEntry>,
}

// ============ Tauri 命令 ============

/// 列出在线市场可用扩展包
///
/// 下载 market-index.json 索引文件（1 次请求），解析后与本地已安装列表对比。
/// 网络失败时进入离线模式，仅返回已安装扩展包（无更新检查）。
#[tauri::command]
pub async fn list_market_packs(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<MarketPack>> {
    // 已安装扩展包 id -> version 映射
    let installed: std::collections::HashMap<String, String> = state
        .extension_pack_registry
        .list_packs()
        .into_iter()
        .map(|p| (p.manifest.id, p.manifest.version))
        .collect();

    // 下载 market-index.json
    match fetch_market_index().await {
        Ok(index) => {
            let mut market: Vec<MarketPack> = Vec::new();

            // 合并 actions + plugins 条目
            for entry in index.actions.iter().chain(index.plugins.iter()) {
                let installed_info = installed.get(&entry.id);
                let installed_version = installed_info.cloned();
                let update_available = match &installed_version {
                    Some(v) => version_gt(&entry.version, v),
                    None => false,
                };
                market.push(MarketPack {
                    id: entry.id.clone(),
                    name: entry.name.clone(),
                    version: entry.version.clone(),
                    description: opt_str(entry.description.clone()),
                    author: opt_str(entry.author.clone()),
                    exero_api_version: entry.exero_api_version.clone(),
                    pack_type: entry.pack_type.clone().unwrap_or_else(|| "action".to_string()),
                    action_count: entry.action_count,
                    has_sidebar: entry.has_sidebar,
                    download_url: entry.download_url.clone(),
                    file_name: entry.file_name.clone(),
                    size: entry.size,
                    installed: installed_info.is_some(),
                    installed_version,
                    update_available,
                });
            }
            Ok(market)
        }
        Err(e) => {
            tracing::warn!("市场索引下载失败，进入离线模式: {}", e);
            // 离线模式：仅返回已安装扩展包（无 download_url）
            let mut market: Vec<MarketPack> = Vec::new();
            for (id, version) in installed {
                if let Some(pack) = state.extension_pack_registry.get_pack(&id) {
                    market.push(MarketPack {
                        id: pack.manifest.id,
                        name: pack.manifest.name,
                        version: pack.manifest.version,
                        description: opt_str(pack.manifest.description),
                        author: opt_str(pack.manifest.author),
                        exero_api_version: pack.manifest.exero_api_version,
                        pack_type: "action".to_string(),
                        action_count: pack.manifest.actions.len(),
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

    // 下载候选源：主源 + 多镜像（应对国内访问不稳定）
    let mirror1 = format!("https://ghfast.top/{}", download_url);
    let mirror2 = format!("https://gh-proxy.com/{}", download_url);
    let candidates = [download_url.clone(), mirror1, mirror2];

    let mut last_err: Option<String> = None;
    let mut downloaded = false;
    for (i, url) in candidates.iter().enumerate() {
        match download_to_file(&client, url, &temp_path).await {
            Ok(()) => {
                downloaded = true;
                break;
            }
            Err(e) => {
                tracing::warn!("扩展包下载源 {} 失败: {}", url, e);
                last_err = Some(format!("{}", e));
                if i + 1 < candidates.len() {
                    tracing::info!("切换到下一个下载源...");
                }
            }
        }
    }
    if !downloaded {
        return Err(AppError::Other(format!(
            "所有下载源均失败，最后错误: {}",
            last_err.unwrap_or_else(|| "未知错误".into())
        )));
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

/// 下载并解析 market-index.json
///
/// 主源 raw.githubusercontent.com，失败走 ghproxy 镜像。
async fn fetch_market_index() -> Result<MarketIndex> {
    let raw_url = format!(
        "https://raw.githubusercontent.com/{}/{}/main/{}",
        GITHUB_OWNER, GITHUB_REPO, MARKET_INDEX_PATH
    );

    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    // 候选源列表：主源 raw.githubusercontent.com + 多个镜像（应对国内访问不稳定）
    let mirror1 = format!(
        "https://ghfast.top/https://raw.githubusercontent.com/{}/{}/main/{}",
        GITHUB_OWNER, GITHUB_REPO, MARKET_INDEX_PATH
    );
    let mirror2 = format!(
        "https://gh-proxy.com/https://raw.githubusercontent.com/{}/{}/main/{}",
        GITHUB_OWNER, GITHUB_REPO, MARKET_INDEX_PATH
    );
    let candidates = [raw_url.clone(), mirror1, mirror2];

    let mut last_err: Option<String> = None;
    for (i, url) in candidates.iter().enumerate() {
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.bytes().await {
                    Ok(b) if !b.is_empty() => {
                        let mut bytes = b.to_vec();
                        // 剥离 UTF-8 BOM（PowerShell Out-File -Encoding utf8 默认带 BOM）
                        if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
                            bytes.drain(..3);
                        }
                        // 校验首字符是否为 JSON 起始（{ 或 [），避免 HTML 劫持页被当 JSON 解析
                        if bytes.first().map(|c| *c == b'{' || *c == b'[').unwrap_or(false) {
                            match serde_json::from_slice::<MarketIndex>(&bytes) {
                                Ok(index) => return Ok(index),
                                Err(e) => {
                                    tracing::warn!(
                                        "市场索引源 {} 解析失败: {}（内容前缀: {:?}）",
                                        url,
                                        e,
                                        String::from_utf8_lossy(&bytes[..bytes.len().min(80)])
                                    );
                                    last_err = Some(format!("索引解析失败: {}", e));
                                }
                            }
                        } else {
                            tracing::warn!(
                                "市场索引源 {} 返回非 JSON 内容（前缀: {:?}）",
                                url,
                                String::from_utf8_lossy(&bytes[..bytes.len().min(80)])
                            );
                            last_err = Some("索引内容非 JSON 格式".into());
                        }
                    }
                    Ok(_) => {
                        tracing::warn!("市场索引源 {} 返回空内容", url);
                        last_err = Some("索引内容为空".into());
                    }
                    Err(e) => {
                        tracing::warn!("市场索引源 {} 读取失败: {}", url, e);
                        last_err = Some(format!("索引读取失败: {}", e));
                    }
                }
            }
            Ok(resp) => {
                tracing::warn!("市场索引源 {} 返回非 200: {}", url, resp.status());
                last_err = Some(format!("HTTP {}", resp.status()));
            }
            Err(e) => {
                tracing::warn!("市场索引源 {} 请求失败: {}", url, e);
                last_err = Some(format!("请求失败: {}", e));
            }
        }
        if i + 1 < candidates.len() {
            tracing::info!("市场索引切换到下一个源...");
        }
    }

    Err(AppError::Other(format!(
        "所有市场索引源均失败，最后错误: {}",
        last_err.unwrap_or_else(|| "未知错误".into())
    )))
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

/// 空字符串转 None，非空转 Some
fn opt_str(s: String) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

/// 简单语义化版本比较：a > b（x.y.z）
fn version_gt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.trim_start_matches(['v', 'V'])
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
