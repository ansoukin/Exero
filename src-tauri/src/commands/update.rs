//! 更新检查与应用信息命令（Phase 6b · SPEC 3.5 页面 5 分区 3 / SPEC 第七章）
//!
//! 功能：
//! - 检查 GitHub Release latest，对比当前版本判断是否需要更新
//! - 强制更新检测（SPEC 7.2 / 13.6：GitHub Release body 包含 `[强制更新]` 标记 + tag 高于当前版本）
//! - 应用基本信息（版本号、构建日期、技术栈、仓库链接）
//! - 更新历史（GitHub Release Notes 优先，失败回退本地 CHANGELOG.md）
//!
//! 网络策略（SPEC 7.4）：github.com 主 -> ghproxy 镜像后备 -> 离线（仅本地 CHANGELOG）

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::Repository;

/// GitHub Release latest API（主源）
const RELEASE_API: &str = "https://api.github.com/repos/ansoukin/Exero/releases/latest";
/// GitHub Releases 列表 API（主源，最近 10 条）
const RELEASES_LIST_API: &str =
    "https://api.github.com/repos/ansoukin/Exero/releases?per_page=10";
/// ghproxy 镜像前缀（SPEC 7.4 网络后备）
const GHPROXY_BASE: &str = "https://ghproxy.com";
/// 强制更新标记（SPEC 7.2 / 13.6.1）
const FORCE_UPDATE_MARKER: &str = "[强制更新]";
/// 推荐更新标记（SPEC 7.2 / 13.6.2）
const RECOMMEND_UPDATE_MARKER: &str = "[推荐更新]";
/// 最低版本标记前缀（SPEC 7.2 / 13.6.3，完整格式 `[最低版本 x.y.z]`）
const MINIMUM_VERSION_MARKER_PREFIX: &str = "[最低版本 ";

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

/// GitHub Release 资产（下载文件）
#[derive(Debug, Deserialize)]
struct GithubAsset {
    /// 文件名（如 Exero_0.4.0-Beta5_x64-setup.exe）
    name: String,
    /// 浏览器下载链接
    browser_download_url: String,
}

/// GitHub Release 响应（仅取需要的字段）
#[derive(Debug, Deserialize)]
struct GithubRelease {
    /// Tag 名（如 v0.4.0-Alpha1，SPEC 13.10）
    tag_name: String,
    /// 发布时间（ISO 8601）
    published_at: String,
    /// Release 正文（Markdown）
    body: Option<String>,
    /// Release HTML 页面链接
    html_url: String,
    /// 资产列表（下载文件）
    #[serde(default)]
    assets: Vec<GithubAsset>,
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
    /// 是否需要强制更新（SPEC 7.2 A：Release body 含 `[强制更新]` 标记且 tag 高于当前版本）
    pub force_update_required: bool,
    /// 是否为推荐更新（SPEC 7.2 B：Release body 含 `[推荐更新]` 标记且 tag 高于当前版本）
    pub recommend_update: bool,
    /// 最低版本要求（SPEC 7.2 C：Release body 含 `[最低版本 x.y.z]` 标记时的 x.y.z）
    /// 当当前版本 < x.y.z 时，minimum_version_required = true
    pub minimum_version: Option<String>,
    /// 当前版本是否低于最低版本要求（触发强制更新行为）
    pub minimum_version_required: bool,
    /// 检查时间（ISO 8601）
    pub checked_at: String,
    /// Release 正文（Markdown，供更新弹窗显示 Release Note）
    pub release_body: Option<String>,
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

/// 检查更新（SPEC 7.1 / 7.2 / 7.4 / 13.6）
///
/// 网络失败时返回 UpdateStatus 带 error 字段，不抛错（允许前端展示离线状态）。
/// 同时持久化最近检查时间到 settings 表（键：update.last_check_time）。
///
/// 三级更新级别解析（SPEC 7.2，标记互斥）：
/// A. 强制更新 `[强制更新]`：tag 高于当前版本 -> force_update_required = true
/// B. 推荐更新 `[推荐更新]`：tag 高于当前版本 -> recommend_update = true
/// C. 最低版本 `[最低版本 x.y.z]`：当前版本 < x.y.z -> minimum_version_required = true（同 A 行为）
/// D. 普通更新（无标记）：默认行为
#[tauri::command]
pub async fn check_for_updates(
    state: State<'_, Arc<AppState>>,
) -> Result<UpdateStatus> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let checked_at = chrono::Utc::now().to_rfc3339();

    let release = match fetch_latest_release().await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("GitHub Release 拉取失败（含 ghproxy 后备）: {}", e);
            // 网络完全失败，返回带 error 的状态
            let status = UpdateStatus {
                current_version: current_version.clone(),
                latest_version: None,
                update_available: false,
                published_at: None,
                release_url: None,
                force_update_required: false,
                recommend_update: false,
                minimum_version: None,
                minimum_version_required: false,
                checked_at: checked_at.clone(),
                release_body: None,
                error: Some(format!("更新检查失败: {}", e)),
            };
            if let Err(e) = persist_latest_version(&state, &status) {
                tracing::warn!("持久化最新版本信息失败: {}", e);
            }
            return Ok(status);
        }
    };

    let latest_version = release
        .as_ref()
        .map(|r| r.tag_name.trim_start_matches('v').to_string());
    let update_available = match &latest_version {
        Some(v) => version_gt(v, &current_version),
        None => false,
    };

    // 三级更新级别解析（SPEC 7.2 / 13.6，标记互斥）
    let body = release
        .as_ref()
        .and_then(|r| r.body.as_deref())
        .unwrap_or("");

    // A. 强制更新：body 含 `[强制更新]` 标记且 tag 高于当前版本
    let force_update_required = body.contains(FORCE_UPDATE_MARKER) && update_available;

    // B. 推荐更新：body 含 `[推荐更新]` 标记且 tag 高于当前版本
    let recommend_update = body.contains(RECOMMEND_UPDATE_MARKER) && update_available;

    // C. 最低版本：body 含 `[最低版本 x.y.z]` 标记，解析 x.y.z 并比较
    let (minimum_version, minimum_version_required) = parse_minimum_version_marker(body)
        .map(|min_ver| {
            let required = version_lt(&current_version, &min_ver);
            (Some(min_ver), required)
        })
        .unwrap_or((None, false));

    let status = UpdateStatus {
        current_version: current_version.clone(),
        latest_version: latest_version.clone(),
        update_available,
        published_at: release.as_ref().map(|r| r.published_at.clone()),
        release_url: release.as_ref().map(|r| r.html_url.clone()),
        force_update_required,
        recommend_update,
        minimum_version,
        minimum_version_required,
        checked_at,
        release_body: release.as_ref().and_then(|r| r.body.clone()),
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

/// 拉取 GitHub Release latest（SPEC 7.4：主源 -> ghproxy 后备）
async fn fetch_latest_release() -> Result<Option<GithubRelease>> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    // 主源：api.github.com
    match fetch_release_from(&client, RELEASE_API).await {
        Ok(result) => return Ok(result),
        Err(e) => tracing::warn!("GitHub Release 主源失败，尝试 ghproxy 后备: {}", e),
    }

    // 备源：ghproxy 镜像
    let mirror = format!("{}/{}", GHPROXY_BASE, RELEASE_API);
    fetch_release_from(&client, &mirror)
        .await
        .map_err(|e| AppError::Other(format!("GitHub Release 拉取失败（含 ghproxy 后备）: {}", e)))
}

/// 从指定 URL 拉取单个 Release（返回 None 表示 404 无 Release）
async fn fetch_release_from(
    client: &reqwest::Client,
    url: &str,
) -> Result<Option<GithubRelease>> {
    let resp = client.get(url).send().await?;
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

/// 拉取 GitHub Releases 列表（最近 10 条，SPEC 7.4：主源 -> ghproxy 后备）
async fn fetch_releases_list() -> Result<Vec<ChangelogEntry>> {
    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    // 主源：api.github.com
    match fetch_releases_from(&client, RELEASES_LIST_API).await {
        Ok(entries) => return Ok(entries),
        Err(e) => tracing::warn!("GitHub Releases 列表主源失败，尝试 ghproxy 后备: {}", e),
    }

    // 备源：ghproxy 镜像
    let mirror = format!("{}/{}", GHPROXY_BASE, RELEASES_LIST_API);
    fetch_releases_from(&client, &mirror)
        .await
        .map_err(|e| AppError::Other(format!("GitHub Releases 列表拉取失败（含 ghproxy 后备）: {}", e)))
}

/// 从指定 URL 拉取 Releases 列表
async fn fetch_releases_from(
    client: &reqwest::Client,
    url: &str,
) -> Result<Vec<ChangelogEntry>> {
    let resp = client.get(url).send().await?;
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

// ============ 版本号比较（SPEC 13.10 自定义 SemVer） ============
//
// 格式：`VMajor.Minor.Patch-StageN`（V/v 前缀可选）
// 比较规则：
// 1. 第一级：比较语义化版本号（Major.Minor.Patch），从左到右逐段比较数字
// 2. 第二级：语义化版本号相同时，比较阶段（Alpha < Beta < Stable）
//    - 同阶段内数字大的大（Alpha2 > Alpha1）
//    - Stable 无数字后缀，视为最高阶段
//
// 完整示例：
//   0.4.0-Alpha1 < 0.4.0-Alpha2 < 0.4.0-Beta1 < 0.4.0-Beta2 < 0.4.0-Stable
//   0.4.0-Stable < 0.4.1-Stable
//   0.4.2-Beta3 < 0.4.3-Alpha1（不同 Minor，直接比较 0.4.2 < 0.4.3）

/// 解析后的版本号
#[derive(Debug, PartialEq, Eq)]
struct ParsedVersion {
    major: u32,
    minor: u32,
    patch: u32,
    /// 阶段：Alpha=0, Beta=1, Stable=2
    stage_order: u8,
    /// 阶段数字（Alpha1=1, Alpha2=2...，Stable 视为 u32::MAX）
    stage_num: u32,
}

/// 解析版本号字符串（SPEC 13.10）
///
/// 支持格式：`0.4.0-Alpha1` / `V0.4.0-Beta2` / `v0.4.0-Stable` / `0.4.0`
/// 大小写不敏感（SPEC 13.10：tag_name 比较时大小写不敏感）
fn parse_version(v: &str) -> Option<ParsedVersion> {
    let v = v.trim().trim_start_matches(|c| c == 'v' || c == 'V');

    // 分离语义化版本号和阶段标识
    let (core, stage_str) = match v.split_once('-') {
        Some((c, s)) => (c, s),
        None => (v, "Stable"), // 无阶段标识视为 Stable
    };

    // 解析 Major.Minor.Patch
    let parts: Vec<u32> = core.split('.').filter_map(|s| s.parse().ok()).collect();
    if parts.len() < 3 {
        return None;
    }
    let major = parts[0];
    let minor = parts[1];
    let patch = parts[2];

    // 解析阶段（大小写不敏感）
    let stage_lower = stage_str.to_lowercase();
    let (stage_order, stage_num) = if stage_lower.starts_with("alpha") {
        let num: u32 = stage_lower[5..].parse().unwrap_or(0);
        (0u8, num)
    } else if stage_lower.starts_with("beta") {
        let num: u32 = stage_lower[4..].parse().unwrap_or(0);
        (1u8, num)
    } else if stage_lower == "stable" {
        (2u8, u32::MAX) // Stable 视为最高数字
    } else {
        return None;
    };

    Some(ParsedVersion {
        major,
        minor,
        patch,
        stage_order,
        stage_num,
    })
}

/// 版本比较核心（SPEC 13.10）
fn version_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    match (parse_version(a), parse_version(b)) {
        (Some(pa), Some(pb)) => {
            // 第一级：比较语义化版本号
            pa.major
                .cmp(&pb.major)
                .then(pa.minor.cmp(&pb.minor))
                .then(pa.patch.cmp(&pb.patch))
                // 第二级：比较阶段
                .then(pa.stage_order.cmp(&pb.stage_order))
                .then(pa.stage_num.cmp(&pb.stage_num))
        }
        _ => {
            // 解析失败时回退为字符串比较（容错）
            a.cmp(b)
        }
    }
}

/// 语义化版本比较：a > b
fn version_gt(a: &str, b: &str) -> bool {
    version_cmp(a, b) == std::cmp::Ordering::Greater
}

/// 语义化版本比较：a < b
fn version_lt(a: &str, b: &str) -> bool {
    version_cmp(a, b) == std::cmp::Ordering::Less
}

// ============ 更新级别标记解析（SPEC 7.2 / 13.6） ============

/// 从 Release body 解析 `[最低版本 x.y.z]` 标记
///
/// 标记格式：`[最低版本 0.4.0]`（SPEC 13.6.3）
/// 返回解析出的版本号字符串（仅 Major.Minor.Patch，无阶段标识）
fn parse_minimum_version_marker(body: &str) -> Option<String> {
    let prefix = MINIMUM_VERSION_MARKER_PREFIX;
    let start = body.find(prefix)?;
    let after_prefix = &body[start + prefix.len()..];
    let end = after_prefix.find(']')?;
    let version = after_prefix[..end].trim();
    if version.is_empty() {
        None
    } else {
        Some(version.to_string())
    }
}

// ============ 自动更新：下载安装 + 频率恢复 + 清理（SPEC 7.6） ============

/// 下载并安装更新（SPEC 7.6 R3）
///
/// 流程：
/// 1. 拉取最新 Release，查找 x64 .exe 安装包
/// 2. 下载到系统临时目录（主源 -> ghproxy 后备）
/// 3. 以 NSIS /S 静默模式启动安装程序
/// 4. 退出当前应用（安装程序将覆盖可执行文件）
#[tauri::command]
pub async fn download_and_install_update(
    app: tauri::AppHandle,
) -> Result<()> {
    // 1. 拉取最新 Release
    let release = fetch_latest_release()
        .await?
        .ok_or_else(|| AppError::Other("未找到任何 Release".into()))?;

    // 2. 查找 x64 .exe 安装包
    let asset = release
        .assets
        .iter()
        .find(|a| a.name.contains("x64") && a.name.ends_with(".exe"))
        .ok_or_else(|| AppError::Other("未找到 x64 .exe 安装包".into()))?;

    tracing::info!("找到安装包: {} ({})", asset.name, asset.browser_download_url);

    // 3. 下载到临时目录（主源 -> ghproxy 后备）
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&asset.name);

    let client = reqwest::Client::builder()
        .user_agent("Exero-App")
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    let download_urls = [
        asset.browser_download_url.clone(),
        format!("{}/{}", GHPROXY_BASE, asset.browser_download_url),
    ];

    let mut downloaded = false;
    for url in &download_urls {
        tracing::info!("尝试下载: {}", url);
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let bytes = resp.bytes().await?;
                std::fs::write(&file_path, &bytes)?;
                downloaded = true;
                tracing::info!("安装包已下载: {} ({} bytes)", file_path.display(), bytes.len());
                break;
            }
            Ok(resp) => {
                tracing::warn!("下载失败 (HTTP {}): {}", resp.status(), url);
            }
            Err(e) => {
                tracing::warn!("下载失败: {} -> {}", url, e);
            }
        }
    }

    if !downloaded {
        return Err(AppError::Other(
            "安装包下载失败（含 ghproxy 后备）".into(),
        ));
    }

    // 4. 以 NSIS /S 静默模式启动安装程序
    tracing::info!("启动静默安装: {} /S", file_path.display());
    std::process::Command::new(&file_path)
        .arg("/S")
        .spawn()
        .map_err(|e| AppError::Other(format!("启动安装程序失败: {}", e)))?;

    // 5. 退出当前应用
    tracing::info!("安装程序已启动，退出当前应用");
    app.exit(0);

    Ok(())
}

/// 恢复更新检查频率（SPEC 7.6 R4 保险措施）
///
/// 新版本启动时调用：检查 `update.previous_check_frequency`，
/// 若存在非空值则恢复 `update.check_frequency` 并清除该键。
#[tauri::command]
pub async fn restore_check_frequency(
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let repo = Repository::new(&state.db);

    if let Some(prev) = repo.get_setting("update.previous_check_frequency")? {
        if !prev.value.is_empty() {
            repo.set_setting(&crate::models::Setting::from_string(
                "update.check_frequency",
                &prev.value,
            ))?;
            tracing::info!("已恢复更新检查频率: {}", prev.value);
        }
        // 清除 previous_check_frequency（设为空字符串）
        repo.set_setting(&crate::models::Setting::from_string(
            "update.previous_check_frequency",
            "",
        ))?;
        tracing::info!("已清除 update.previous_check_frequency");
    }

    Ok(())
}

/// 准备强制更新（SPEC 7.6 R4 保险措施）
///
/// 检测到强制更新时调用：
/// 1. 保存当前 check_frequency 到 previous_check_frequency
/// 2. 将 check_frequency 改为 "startup"
/// 防止标签更新后被弹窗卡死。
#[tauri::command]
pub async fn prepare_force_update(
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let repo = Repository::new(&state.db);

    // 读取当前频率（缺失时默认 "startup"）
    let current = repo
        .get_setting("update.check_frequency")?
        .map(|s| s.value)
        .unwrap_or_else(|| "startup".to_string());

    // 保存到 previous_check_frequency
    repo.set_setting(&crate::models::Setting::from_string(
        "update.previous_check_frequency",
        &current,
    ))?;

    // 改为 startup
    repo.set_setting(&crate::models::Setting::from_string(
        "update.check_frequency",
        "startup",
    ))?;

    tracing::info!("强制更新准备完成：频率 {} -> startup（原值已保存）", current);

    Ok(())
}

/// 清理旧安装包（SPEC 7.6 R3）
///
/// 新版本启动时调用：清理临时目录中的 Exero_*_x64-setup.exe 文件。
#[tauri::command]
pub async fn cleanup_old_installers() -> Result<()> {
    let temp_dir = std::env::temp_dir();
    if let Ok(entries) = std::fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("Exero_") && name_str.ends_with("_x64-setup.exe") {
                let _ = std::fs::remove_file(entry.path());
                tracing::info!("已清理旧安装包: {}", name_str);
            }
        }
    }
    Ok(())
}
