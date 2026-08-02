//! 周课表模板模型
//!
//! 支持特殊周模板（考试周/活动周），可被多个周次复用。
//! 普通周不需要记录（courses.template_id = NULL 即代表普通周）。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 周课表模板（WeeklyTemplate）
///
/// 特殊周的课表模板。courses.template_id 关联到此表，
/// NULL 表示普通周默认模板。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyTemplate {
    /// 唯一标识
    pub id: String,
    /// 所属学期 ID
    pub semester_id: String,
    /// 模板名称（如 "期中考试周"/"活动周"）
    pub name: String,
    /// 可选描述
    pub description: Option<String>,
    /// 颜色标识（hex，用于 UI 区分）
    pub color: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl WeeklyTemplate {
    /// 创建新周模板
    pub fn new(
        semester_id: impl Into<String>,
        name: impl Into<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            semester_id: semester_id.into(),
            name: name.into(),
            description: None,
            color: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 创建周模板请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWeeklyTemplateRequest {
    pub semester_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

/// 更新周模板请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWeeklyTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}
