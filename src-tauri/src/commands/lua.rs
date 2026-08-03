//! Lua 脚本市场命令
//!
//! 对接 GitHub 仓库 `scripts/` 目录，提供脚本浏览 / 安装 / 更新 / 卸载能力。
//! SPEC 第六章：仓库结构平铺，每个脚本一个 `.lua` + 同名 `.json` manifest。
//!
//! 网络策略（SPEC 6.3）：github.com 主 → ghproxy 镜像后备 → 离线模式（仅已安装）。

use std::sync::Arc;

use serde::Deserialize;
use tauri::State;

use crate::db::Repository;
use crate::error::{AppError, Result};
use crate::models::{InstalledScript, MarketScript, ScriptManifest};
use crate::state::AppState;

/// GitHub 仓库所有者
const GITHUB_OWNER: &str = "ansoukin";
/// GitHub 仓库名
const GITHUB_REPO: &str = "Exero";
/// 默认分支
const GITHUB_BRANCH: &str = "main";
/// 脚本目录
const SCRIPTS_PATH: &str = "scripts";
/// ghproxy 镜像前缀
const GHPROXY_BASE: &str = "https://ghproxy.com";

/// GitHub Contents API 返回的文件项
#[derive(Deserialize)]
struct GithubContent {
    /// 文件名（如 "hello.lua" / "hello.json"）
    name: String,
}

// ============ Tauri 命令 ============

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

/// 列出市场可用脚本
///
/// 网络失败时进入离线模式，仅返回已安装脚本（无更新检查）。
#[tauri::command]
pub async fn list_market_scripts(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<MarketScript>> {
    let repo = Repository::new(&state.db);
    let installed: std::collections::HashMap<String, InstalledScript> = repo
        .list_installed_scripts()?
        .into_iter()
        .map(|s| (s.script_id.clone(), s))
        .collect();

    // 尝试 GitHub Contents API 列 scripts/ 目录
    match fetch_github_contents().await {
        Ok(files) => {
            // 收集所有 .lua 文件对应的脚本 ID（去重 + 排序）
            let mut ids: Vec<String> = files
                .iter()
                .filter(|f| f.name.ends_with(".lua"))
                .map(|f| f.name.trim_end_matches(".lua").to_string())
                .collect();
            ids.sort();
            ids.dedup();

            let mut market: Vec<MarketScript> = Vec::new();
            for id in &ids {
                // 拉取 manifest（失败则跳过该脚本）
                if let Ok(manifest) = fetch_manifest(id).await {
                    let installed_info = installed.get(id);
                    let installed_version = installed_info.map(|s| s.version.clone());
                    let update_available = match &installed_version {
                        Some(v) => version_gt(&manifest.version, v),
                        None => false,
                    };
                    market.push(MarketScript {
                        id: manifest.id.clone(),
                        name: manifest.name,
                        author: manifest.author,
                        version: manifest.version,
                        description: manifest.description,
                        permissions: manifest.permissions,
                        params: manifest.params,
                        installed: installed_info.is_some(),
                        installed_version,
                        update_available,
                    });
                }
            }
            Ok(market)
        }
        Err(e) => {
            tracing::warn!("市场列表获取失败，进入离线模式: {}", e);
            // 离线模式：仅返回已安装脚本
            let mut market: Vec<MarketScript> = Vec::new();
            for (_, s) in installed {
                market.push(MarketScript {
                    id: s.script_id,
                    name: s.name,
                    author: s.author,
                    version: s.version.clone(),
                    description: s.description,
                    permissions: s.permissions,
                    params: s.params_schema,
                    installed: true,
                    installed_version: Some(s.version),
                    update_available: false,
                });
            }
            Ok(market)
        }
    }
}

/// 安装脚本
///
/// 下载 `.lua` + `.json`，写入本地 `<exe>/data/scripts/` 与数据库。
#[tauri::command]
pub async fn install_script(
    state: State<'_, Arc<AppState>>,
    script_id: String,
) -> Result<InstalledScript> {
    let repo = Repository::new(&state.db);
    if repo.get_installed_script(&script_id)?.is_some() {
        return Err(AppError::InvalidArgument(format!(
            "脚本已安装: {}",
            script_id
        )));
    }

    let manifest = fetch_manifest(&script_id).await?;
    let lua_content = fetch_script_content(&script_id).await?;
    let content_hash = sha256_hex(&lua_content);
    let source_url = raw_url_lua(&script_id);

    write_script_file(&script_id, &lua_content)?;
    repo.insert_installed_script(&manifest, &source_url, &content_hash)?;

    repo.get_installed_script(&script_id)?
        .ok_or_else(|| AppError::Other("安装后查询失败".into()))
}

/// 卸载脚本
///
/// 删除数据库记录与本地脚本文件。
#[tauri::command]
pub async fn uninstall_script(
    state: State<'_, Arc<AppState>>,
    script_id: String,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    if repo.get_installed_script(&script_id)?.is_none() {
        return Err(AppError::NotFound(format!("脚本未安装: {}", script_id)));
    }
    repo.delete_installed_script(&script_id)?;
    delete_script_file(&script_id)?;
    Ok(())
}

/// 更新脚本
///
/// 重新下载 `.lua` + `.json`，覆盖本地文件与数据库记录。
#[tauri::command]
pub async fn update_script(
    state: State<'_, Arc<AppState>>,
    script_id: String,
) -> Result<InstalledScript> {
    let repo = Repository::new(&state.db);
    if repo.get_installed_script(&script_id)?.is_none() {
        return Err(AppError::NotFound(format!("脚本未安装: {}", script_id)));
    }

    let manifest = fetch_manifest(&script_id).await?;
    let lua_content = fetch_script_content(&script_id).await?;
    let content_hash = sha256_hex(&lua_content);

    write_script_file(&script_id, &lua_content)?;
    repo.update_installed_script(&manifest, &content_hash)?;

    repo.get_installed_script(&script_id)?
        .ok_or_else(|| AppError::Other("更新后查询失败".into()))
}

// ============ 内部辅助函数 ============

/// 获取数据脚本目录 `<exe>/data/scripts/`，不存在则创建
fn scripts_dir() -> Result<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    let dir = exe_dir.join("data").join("scripts");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// 写入脚本文件到本地
fn write_script_file(script_id: &str, content: &str) -> Result<()> {
    let dir = scripts_dir()?;
    let path = dir.join(format!("{}.lua", script_id));
    std::fs::write(&path, content)?;
    tracing::debug!("已写入脚本文件: {}", path.display());
    Ok(())
}

/// 删除本地脚本文件
fn delete_script_file(script_id: &str) -> Result<()> {
    let dir = scripts_dir()?;
    let path = dir.join(format!("{}.lua", script_id));
    if path.exists() {
        std::fs::remove_file(&path)?;
        tracing::debug!("已删除脚本文件: {}", path.display());
    }
    Ok(())
}

/// 构造 raw.githubusercontent.com 的 .lua URL
fn raw_url_lua(script_id: &str) -> String {
    format!(
        "https://raw.githubusercontent.com/{}/{}/{}/{}/{}.lua",
        GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, SCRIPTS_PATH, script_id
    )
}

/// 构造 raw.githubusercontent.com 的 .json URL
fn raw_url_json(script_id: &str) -> String {
    format!(
        "https://raw.githubusercontent.com/{}/{}/{}/{}/{}.json",
        GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, SCRIPTS_PATH, script_id
    )
}

/// 构造 ghproxy 镜像 URL
fn mirror_url(raw: &str) -> String {
    format!("{}/{}", GHPROXY_BASE, raw)
}

/// 拉取 GitHub Contents API 列出 scripts/ 目录
async fn fetch_github_contents() -> Result<Vec<GithubContent>> {
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        GITHUB_OWNER, GITHUB_REPO, SCRIPTS_PATH
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

/// 拉取脚本 manifest（scripts/<id>.json）
///
/// 主：raw.githubusercontent.com，失败：ghproxy 镜像
async fn fetch_manifest(script_id: &str) -> Result<ScriptManifest> {
    let raw = raw_url_json(script_id);
    let mirror = mirror_url(&raw);
    let json_str = fetch_text_with_fallback(&raw, &mirror).await?;
    let manifest: ScriptManifest = serde_json::from_str(&json_str)
        .map_err(|e| AppError::Other(format!("manifest 解析失败 ({}): {}", script_id, e)))?;
    Ok(manifest)
}

/// 拉取脚本内容（scripts/<id>.lua）
///
/// 主：raw.githubusercontent.com，失败：ghproxy 镜像
async fn fetch_script_content(script_id: &str) -> Result<String> {
    let raw = raw_url_lua(script_id);
    let mirror = mirror_url(&raw);
    fetch_text_with_fallback(&raw, &mirror).await
}

/// 主 URL 失败时回退镜像
async fn fetch_text_with_fallback(primary: &str, mirror: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    // 主源
    if let Ok(resp) = client.get(primary).send().await {
        if resp.status().is_success() {
            if let Ok(text) = resp.text().await {
                if !text.is_empty() {
                    return Ok(text);
                }
            }
        }
    }

    // 镜像后备
    if let Ok(resp) = client.get(mirror).send().await {
        if resp.status().is_success() {
            if let Ok(text) = resp.text().await {
                if !text.is_empty() {
                    tracing::debug!("通过镜像下载成功: {}", mirror);
                    return Ok(text);
                }
            }
        }
    }

    Err(AppError::Other(format!(
        "主源与镜像均不可达: {}",
        primary
    )))
}

/// 计算 SHA256 十六进制
fn sha256_hex(text: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_gt() {
        assert!(version_gt("1.1.0", "1.0.0"));
        assert!(version_gt("2.0.0", "1.9.9"));
        assert!(!version_gt("1.0.0", "1.0.0"));
        assert!(!version_gt("1.0.0", "1.0.1"));
        assert!(version_gt("v1.2.0", "1.1.0"));
    }

    #[test]
    fn test_raw_url() {
        let url = raw_url_json("hello");
        assert!(url.contains("ansoukin/Exero"));
        assert!(url.contains("main/scripts/hello.json"));
    }

    #[test]
    fn test_sha256() {
        let h = sha256_hex("hello");
        assert_eq!(h.len(), 64);
        // "hello" 的 SHA256 已知值
        assert_eq!(
            h,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }
}
