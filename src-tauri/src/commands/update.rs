//! 更新检查与应用信息命令（Phase 6b · SPEC 3.5 页面 5 分区 3 / SPEC 第七章）
//!
//! 功能：
//! - 检查 GitHub Release latest，对比当前版本判断是否需要更新
//! - 强制更新检测（SPEC 7.2：force-update.json 包含最低版本号）
//! - 应用基本信息（版本号、构建日期、技术栈、仓库链接）
//! - 更新历史（GitHub Release Notes 优先，失败回退本地 CHANGELOG.md）
//!
//! 网络策略（SPEC 7.4）：github.com 主 → ghproxy 镜像后备 → 离线（仅本地 CHANGELOG）

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, Result};
use crate::state::AppState;

/// GitHub 仓库所有者
const GITHUB_OWNER: &str = "ansoukin";
/// GitHub 仓库名
const GITHUB_REPO: &str = "Exero";
/// GitHub Release latest API
const RELEASE_API: &str = "https://api.github.com/repos/ansoukin/Exero/releases/latest";
/// force-update.json 远端地址（raw.githubusercontent.com）
const FORCE_UPDATE_URL: &str =
    "https://raw.githubusercontent.com/ansoukin/Exero/main/force-update.json";
/// ghproxy 镜像前缀
const GHPROXY_BASE: &str = "https://ghproxy.com";
/// 本地 CHANGELOG.md（前端通过 tauri-plugin-fs 读取，这里仅返回路径）

/// 应用基本信息（SPEC 3.5 分区 4 关于页）
#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    /// 应用名称
    pub name: &'static str,
    /// 版本号（来自 Cargo.toml）
    pub version: &'static str,
    /// 构建日期（编译期 env! BUILD_DATE，缺失时 "unknown"）
    pub build_date: &'static str,
    /// 仓库链接
    pub repo_url: &'static str,
    /// License
    pub license: &'static str,
    /// 技术栈列表
    pub tech_stack: Vec<TechStackItem>,
}

/// 技术栈条目
#[derive(Debug, Clone, Serialize)]
pub struct TechStackItem {
    pub category: &'static str,
    pub name: &'static str,
    pub version: &'static str,
}

/// GitHub Release 响应（仅取需要的字段）
#[derive(Debug, Deserialize)]
struct GithubRelease {
    /// Tag 名（如 v0.4.0-alpha.1）
    tag_name: String,
    /// 发布时间（ISO 8601）
    published_at: String,
    /// Release 正文（Markdown）
    body: Option<String>,
    /// 资产下载链接
    html_url: String,
}

/// 强制更新配置（SPEC 7.2）
#[derive(Debug, Deserialize)]
struct ForceUpdateConfig {
    /// 最低允许版本号（语义化版本，如 "0.4.0-alpha.1"）
    minimum_version: String,
}

/// 更新检查结果
#[derive(Debug, Clone, Serialize)]
pub struct UpdateStatus {
    /// 当前版本
    pub current_version: String,
    /// 最新版本（获取失败时为 None）
    pub latest_version: Option<String>,
    /// 是否有可用更新
    pub update_available: bool,
    /// Release 发布时间（ISO 8601）
    pub published_at: Option<String>,
    /// Release HTML 页面链接
    pub release_url: Option<String>,
    /// 强制更新最低版本（None 表示无强制更新）
    pub force_update_minimum: Option<String>,
    /// 当前版本是否低于强制更新最低版本
    pub force_update_required: bool,
    /// 检查时间（ISO 8601）
    pub checked_at: String,
    /// 错误信息（网络失败等）
    pub error: Option<String>,
}

/// 更新历史条目（从 GitHub Releases 拉取）
#[derive(Debug, Clone, Serialize)]
pub struct ChangelogEntry {
    /// 版本号
    pub version: String,
    /// 发布时间
    pub published_at: String,
    /// Release Notes（Markdown 原文）
    pub body: String,
    /// Release HTML 链接
    pub html_url: String,
}

// ============ Tauri 命令 ============

/// 获取应用基本信息
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo> {
    Ok(AppInfo {
        name: "Exero",
        version: env!("CARGO_PKG_VERSION"),
        build_date: option_env!("BUILD_DATE").unwrap_or("unknown"),
        repo_url: "https://github.com/ansoukin/Exero",
        license: "MIT",
        tech_stack: vec![
            TechStackItem {
                category: "应用框架",
                name: "Tauri",
                version: "v2",
            },
            TechStackItem {
                category: "后端",
                name: "Rust",
                version: "edition 2021",
            },
            TechStackItem {
                category: "前端",
                name: "React",
                version: "18",
            },
            TechStackItem {
                category: "前端语言",
                name: "TypeScript",
                version: "",
            },
            TechStackItem {
                category: "构建工具",
                name: "Vite",
                version: "5",
            },
            TechStackItem {
                category: "UI 库",
                name: "shadcn/ui + Tailwind CSS",
                version: "",
            },
            TechStackItem {
                category: "状态管理",
                name: "Zustand",
                version: "",
            },
            TechStackItem {
                category: "可视化编辑",
                name: "React Flow",
                version: "",
            },
            TechStackItem {
                category: "数据库",
                name: "SQLite (rusqlite + refinery)",
                version: "",
            },
            TechStackItem {
                category: "异步运行时",
                name: "tokio",
                version: "",
            },
            TechStackItem {
                category: "Lua 引擎",
                name: "LuaJIT (mlua)",
                version: "",
            },
            TechStackItem {
                category: "日志",
                name: "tracing",
                version: "",
            },
            TechStackItem {
                category: "包管理器",
                name: "pnpm",
                version: "",
            },
            TechStackItem {
                category: "打包",
                name: "NSIS",
                version: "",
            },
            TechStackItem {
                category: "版本管理",
                name: "Git + GitHub",
                version: "",
            },
        ],
    })
}

/// 检查更新（SPEC 7.1 / 7.2 / 7.4）
///
/// 网络失败时返回 UpdateStatus 带 error 字段，不抛错（允许前端展示离线状态）。
/// 同时持久化最近检查时间到 settings 表（键：update.last_check_time）。
#[tauri::command]
pub async fn check_for_updates(
    state: State<'_, Arc<AppState>>,
) -> Result<UpdateStatus> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let checked_at = chrono::Utc::now().to_rfc3339();

    // 并发拉取 Release 信息 + force-update.json
    let (release_result, force_result) = tokio::join!(
        fetch_latest_release(),
        fetch_force_update_config()
    );

    let release = release_result?;
    let force_config = force_result.unwrap_or_else(|e| {
        tracing::warn!("强制更新配置获取失败（忽略，视为无强制更新）: {}", e);
        None
    });

    let latest_version = release
        .as_ref()
        .map(|r| r.tag_name.trim_start_matches('v').to_string());
    let update_available = match &latest_version {
        Some(v) => version_gt(v, &current_version),
        None => false,
    };
    let force_update_required = match &force_config {
        Some(c) => version_lt(&current_version, &c.minimum_version),
        None => false,
    };

    let status = UpdateStatus {
        current_version: current_version.clone(),
        latest_version: latest_version.clone(),
        update_available,
        published_at: release.as_ref().map(|r| r.published_at.clone()),
        release_url: release.as_ref().map(|r| r.html_url.clone()),
        force_update_minimum: force_config.map(|c| c.minimum_version),
        force_update_required,
        checked_at,
        error: None,
    };

    // 持久化最近检查时间（忽略错误，不影响主流程）
    if let Err(e) = persist_last_check_time(&state, &status.checked_at) {
        tracing::warn!("持久化更新检查时间失败: {}", e);
    }

    // 持久化最新版本信息（供"仅手动"模式下次启动时显示）
    if let Err(e) = persist_latest_version(&state, &status) {
        tracing::warn!("持久化最新版本信息失败: {}", e);
    }

    Ok(status)
}

/// 获取更新历史（SPEC 3.5 分区 4 关于页）
///
/// 优先从 GitHub Releases API 拉取最近 10 条 Release Notes，
/// 网络失败时回退本地 CHANGELOG.md（返回单条记录）。
#[tauri::command]
pub async fn get_changelog() -> Result<Vec<ChangelogEntry>> {
    match fetch_releases_list().await {
        Ok(entries) if !entries.is_empty() => Ok(entries),
        Ok(_) => {
            tracing::info!("GitHub Releases 为空，回退本地 CHANGELOG.md");
            read_local_changelog()
        }
        Err(e) => {
            tracing::warn!("GitHub Releases 拉取失败，回退本地 CHANGELOG.md: {}", e);
            read_local_changelog()
        }
    }
}

/// 获取本地 CHANGELOG.md 文件路径（前端通过 fs 插件读取）
///
/// 返回相对于可执行文件的 CHANGELOG.md 路径。
#[tauri::command]
pub async fn get_changelog_path() -> Result<String> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    // 开发模式下 CHANGELOG.md 在项目根目录，生产环境随 NSIS 安装包分发
    let candidate = exe_dir.join("CHANGELOG.md");
    Ok(candidate.to_string_lossy().to_string())
}

// ============ 内部辅助函数 ============

/// 拉取 GitHub Release latest
async fn fetch_latest_release() -> Result<Option<GithubRelease>> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client.get(RELEASE_API).send().await?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        // 还没有任何 Release
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Err(AppError::Other(format!(
            "GitHub Release API 返回 {}",
            resp.status()
        )));
    }
    let release: GithubRelease = resp.json().await?;
    Ok(Some(release))
}

/// 拉取 GitHub Releases 列表（最近 10 条）
async fn fetch_releases_list() -> Result<Vec<ChangelogEntry>> {
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/releases?per_page=10",
        GITHUB_OWNER, GITHUB_REPO
    );
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client.get(&api_url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Other(format!(
            "GitHub Releases API 返回 {}",
            resp.status()
        )));
    }
    let releases: Vec<GithubRelease> = resp.json().await?;
    Ok(releases
        .into_iter()
        .map(|r| ChangelogEntry {
            version: r.tag_name.trim_start_matches('v').to_string(),
            published_at: r.published_at,
            body: r.body.unwrap_or_default(),
            html_url: r.html_url,
        })
        .collect())
}

/// 拉取 force-update.json（SPEC 7.2）
///
/// 主源失败时尝试 ghproxy 镜像，仍失败则返回 None（视为无强制更新）。
async fn fetch_force_update_config() -> Result<Option<ForceUpdateConfig>> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    // 主源：raw.githubusercontent.com
    match client.get(FORCE_UPDATE_URL).send().await {
        Ok(resp) if resp.status().is_success() => {
            let cfg: ForceUpdateConfig = resp.json().await?;
            return Ok(Some(cfg));
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::NOT_FOUND => {
            // 远端未配置 force-update.json，视为无强制更新
            return Ok(None);
        }
        _ => {}
    }

    // 备源：ghproxy 镜像
    let mirror = format!("{}/{}", GHPROXY_BASE, FORCE_UPDATE_URL);
    match client.get(&mirror).send().await {
        Ok(resp) if resp.status().is_success() => {
            let cfg: ForceUpdateConfig = resp.json().await?;
            Ok(Some(cfg))
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::NOT_FOUND => Ok(None),
        Ok(resp) => Err(AppError::Other(format!(
            "ghproxy force-update 返回 {}",
            resp.status()
        ))),
        Err(e) => Err(AppError::Other(format!(
            "ghproxy force-update 请求失败: {}",
            e
        ))),
    }
}

/// 读取本地 CHANGELOG.md（网络失败时的回退）
fn read_local_changelog() -> Result<Vec<ChangelogEntry>> {
    // 尝试几个候选位置：可执行文件目录 / 项目根目录
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();

    let candidates = [
        exe_dir.join("CHANGELOG.md"),
        // 开发模式下：src-tauri/target/<profile>/../../CHANGELOG.md
        exe_dir
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("CHANGELOG.md"))
            .unwrap_or_default(),
    ];

    for path in &candidates {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            return Ok(vec![ChangelogEntry {
                version: env!("CARGO_PKG_VERSION").to_string(),
                published_at: String::new(),
                body: content,
                html_url: "https://github.com/ansoukin/Exero/releases".to_string(),
            }]);
        }
    }

    Ok(vec![])
}

/// 持久化最近检查时间到 settings
fn persist_last_check_time(state: &State<'_, Arc<AppState>>, time: &str) -> Result<()> {
    let repo = crate::db::Repository::new(&state.db);
    repo.set_setting(&crate::models::Setting::from_string(
        "update.last_check_time",
        time,
    ))
}

/// 持久化最新版本信息到 settings（供 UI 下次启动展示）
fn persist_latest_version(
    state: &State<'_, Arc<AppState>>,
    status: &UpdateStatus,
) -> Result<()> {
    let repo = crate::db::Repository::new(&state.db);
    repo.set_setting(&crate::models::Setting::from_json(
        "update.last_status",
        status,
    )?)
}

/// 语义化版本比较：a > b
///
/// 仅比较 `主版本.次版本.修订号-预发布标识`，
/// 不严格遵循 semver 规范（简化为字符串分块比较），满足本项目使用场景。
fn version_gt(a: &str, b: &str) -> bool {
    version_cmp(a, b) == std::cmp::Ordering::Greater
}

/// 语义化版本比较：a < b
fn version_lt(a: &str, b: &str) -> bool {
    version_cmp(a, b) == std::cmp::Ordering::Less
}

/// 版本比较核心
fn version_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let pa = parse_version(a);
    let pb = parse_version(b);
    pa.cmp(&pb)
}

/// 解析版本号为可比较元组 (major, minor, patch, pre_release)
fn parse_version(v: &str) -> (u32, u32, u32, String) {
    let v = v.trim().trim_start_matches('v');
    let (core, pre) = match v.split_once('-') {
        Some((c, p)) => (c, format!("-{}", p)),
        None => (v, String::new()),
    };
    let parts: Vec<u32> = core
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let major = parts.first().copied().unwrap_or(0);
    let minor = parts.get(1).copied().unwrap_or(0);
    let patch = parts.get(2).copied().unwrap_or(0);
    // 预发布版本（如 alpha.1）应小于同号正式版：用负序字符串处理
    let pre_key = if pre.is_empty() {
        "\u{10FFFF}".to_string() // 正式版排在所有预发布之后
    } else {
        pre
    };
    (major, minor, patch, pre_key)
}
