//! URL 短域名别名模型（Phase 6b · SPEC 11.3）
//!
//! OpenUrl 动作的 URL 自动补全增强功能。用户可在设置页配置短域名别名映射表，
//! OpenUrl 动作执行时自动解析别名并重写为完整 URL。
//!
//! 解析优先级（SPEC 11.3）：
//! 1. 别名匹配：输入完全等于某别名 -> 直接替换为目标 URL
//! 2. scheme 补全：输入无 `://` -> 补全 `https://`
//! 3. 原样使用：输入已含 scheme -> 保持不变

use serde::{Deserialize, Serialize};

use crate::db::Database;
use crate::error::Result;
use crate::models::Setting;

/// settings 表中存储 URL 别名的键名
pub const URL_ALIASES_KEY: &str = "url.aliases";

/// URL 别名条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlAlias {
    /// 别名（如 "baidu"）
    pub alias: String,
    /// 目标 URL（如 "https://www.baidu.com"）
    pub target: String,
}

/// 默认别名列表（首次启用时预置，SPEC 11.3）
pub const DEFAULT_ALIASES: &[(&str, &str)] = &[
    ("baidu", "https://www.baidu.com"),
    ("google", "https://www.google.com"),
    ("github", "https://github.com"),
    ("bing", "https://www.bing.com"),
];

impl UrlAlias {
    /// 构造默认别名列表
    pub fn defaults() -> Vec<UrlAlias> {
        DEFAULT_ALIASES
            .iter()
            .map(|(alias, target)| UrlAlias {
                alias: alias.to_string(),
                target: target.to_string(),
            })
            .collect()
    }

    /// 从 settings 表读取别名列表
    ///
    /// 键不存在或解析失败时返回空数组（向后兼容 Phase 5）。
    pub fn load(db: &Database) -> Result<Vec<UrlAlias>> {
        let repo = crate::db::Repository::new(db);
        match repo.get_setting(URL_ALIASES_KEY)? {
            Some(setting) => {
                let aliases: Vec<UrlAlias> = setting.as_json().unwrap_or_default();
                Ok(aliases
                    .into_iter()
                    .filter(|a| !a.alias.is_empty() && !a.target.is_empty())
                    .collect())
            }
            None => Ok(Vec::new()),
        }
    }

    /// 保存别名列表到 settings 表
    pub fn save(db: &Database, aliases: &[UrlAlias]) -> Result<()> {
        let repo = crate::db::Repository::new(db);
        let setting = Setting::from_json(URL_ALIASES_KEY, &aliases.to_vec())?;
        repo.set_setting(&setting)
    }
}

/// URL 解析（SPEC 11.3 优先级）
///
/// 1. 别名匹配（大小写敏感，完全相等才匹配）
/// 2. scheme 补全（无 `://` 时补 `https://`）
/// 3. 原样使用
///
/// # 参数
/// - `raw`: 用户输入的原始 URL
/// - `aliases`: 别名列表（从 settings 加载）
///
/// # 返回
/// 解析后的最终 URL
pub fn resolve_url(raw: &str, aliases: &[UrlAlias]) -> String {
    let trimmed = raw.trim();

    // 1. 别名匹配
    for alias in aliases {
        if trimmed == alias.alias {
            return alias.target.clone();
        }
    }

    // 2. scheme 补全
    if !trimmed.contains("://") {
        return format!("https://{}", trimmed);
    }

    // 3. 原样使用
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alias_match() {
        let aliases = UrlAlias::defaults();
        assert_eq!(resolve_url("baidu", &aliases), "https://www.baidu.com");
        assert_eq!(resolve_url("github", &aliases), "https://github.com");
    }

    #[test]
    fn test_scheme_completion() {
        let aliases: Vec<UrlAlias> = Vec::new();
        assert_eq!(resolve_url("example.com", &aliases), "https://example.com");
        assert_eq!(
            resolve_url("www.example.com", &aliases),
            "https://www.example.com"
        );
    }

    #[test]
    fn test_keep_original() {
        let aliases: Vec<UrlAlias> = Vec::new();
        assert_eq!(
            resolve_url("http://example.com", &aliases),
            "http://example.com"
        );
        assert_eq!(
            resolve_url("https://example.com", &aliases),
            "https://example.com"
        );
    }

    #[test]
    fn test_priority_alias_over_scheme() {
        // 别名优先于 scheme 补全
        let aliases = vec![UrlAlias {
            alias: "ex".to_string(),
            target: "https://example.com".to_string(),
        }];
        // "ex" 应该匹配别名而不是补全为 https://ex
        assert_eq!(resolve_url("ex", &aliases), "https://example.com");
    }
}
