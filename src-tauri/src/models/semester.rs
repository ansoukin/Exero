//! 学期与节次模型
//!
//! 学期是课表多周切换的基础（SPEC：学期制，不分单双周）。
//! 节次定义格点模式中每节课的时间段，按学期可配置。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 学期（Semester）
///
/// 一个学期包含若干周，课表通过学期 + 周次定位课程。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Semester {
    /// 唯一标识
    pub id: String,
    /// 显示名称（如 "2025-2026 第一学期"）
    pub name: String,
    /// 学期开始日期（ISO "2026-09-01"）
    pub start_date: String,
    /// 学期结束日期（ISO "2027-01-20"）
    pub end_date: String,
    /// 总周数（SPEC V2：week_count）
    pub week_count: i32,
    /// 是否当前激活学期
    pub is_active: bool,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl Semester {
    /// 创建新学期（生成新 ID，默认未激活）
    pub fn new(name: impl Into<String>, start_date: impl Into<String>, end_date: impl Into<String>, week_count: i32) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            start_date: start_date.into(),
            end_date: end_date.into(),
            week_count,
            is_active: false,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 创建学期请求（前端 → 后端）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSemesterRequest {
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub week_count: i32,
}

/// 更新学期请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSemesterRequest {
    pub name: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub week_count: Option<i32>,
    pub is_active: Option<bool>,
}

/// 节次定义（ClassPeriod）
///
/// 格点模式中第 N 节课的时间段，按学期可配置。
/// 不同学期可有不同作息时间。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassPeriod {
    /// 唯一标识
    pub id: String,
    /// 所属学期 ID
    pub semester_id: String,
    /// 第几节（1, 2, 3...）
    pub period_index: i32,
    /// 开始时间 "08:00"
    pub start_time: String,
    /// 结束时间 "08:45"
    pub end_time: String,
    /// 可选名称（如 "早读"/"晚自习"）（SPEC V2：name）
    pub name: Option<String>,
}

impl ClassPeriod {
    /// 创建新节次定义
    pub fn new(
        semester_id: impl Into<String>,
        period_index: i32,
        start_time: impl Into<String>,
        end_time: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            semester_id: semester_id.into(),
            period_index,
            start_time: start_time.into(),
            end_time: end_time.into(),
            name: None,
        }
    }
}

/// 创建/更新节次定义请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassPeriodInput {
    pub period_index: i32,
    pub start_time: String,
    pub end_time: String,
    pub name: Option<String>,
}
