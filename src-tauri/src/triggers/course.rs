//! 课表触发器（Beta9 · 任务1）
//!
//! 基于 CourseTriggerParams { course_id, timing, minutes } 计算下一次触发时间。
//! 读取关联课程/节次/学期，按 week_pattern 适配周次（all/odd/even/指定周次）。
//!
//! 触发时刻：
//! - Before：课程开始时间 - minutes（minutes=0 即开始即触发）
//! - During：课程开始时间
//! - After：课程结束时间

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, NaiveTime, TimeZone, Utc};

use crate::db::Repository;
use crate::error::{AppError, Result};
use crate::models::course::Course;
use crate::models::semester::Semester;
use crate::models::trigger::{CourseTiming, CourseTriggerParams};

/// 计算课表触发器下一次触发时间（UTC）
///
/// 从今天起往后查找：星期匹配 + 周次模式匹配 + 触发时刻在未来的最近一次。
pub fn next_fire_time(repo: &Repository, params: &CourseTriggerParams) -> Result<Option<DateTime<Utc>>> {
    let course = repo
        .get_course(&params.course_id)?
        .ok_or_else(|| AppError::Trigger(format!("课程不存在: {}", params.course_id)))?;
    let semester = repo
        .get_active_semester()?
        .ok_or_else(|| AppError::Trigger("无激活学期，课表触发无法调度".into()))?;

    // 确定课程开始/结束时间（HH:mm）
    let (start_hhmm, end_hhmm) = resolve_course_time(repo, &course, &semester)?;

    // 触发时刻
    let minutes = params.minutes.unwrap_or(0).max(0);
    let trigger_hhmm = match params.timing {
        CourseTiming::Before => subtract_minutes(&start_hhmm, minutes),
        CourseTiming::During => start_hhmm,
        CourseTiming::After => end_hhmm,
    };

    let now = Local::now();
    let today = now.date_naive();
    let semester_start = parse_date(&semester.start_date)?;
    let semester_end = parse_date(&semester.end_date)?;
    let trigger_time = parse_hhmm(&trigger_hhmm)?;

    // 从今天起往后找（最多学期周数 × 7 + 14 天容错）
    let max_days = (semester.week_count as i64) * 7 + 14;
    for day_offset in 0..max_days {
        let date = today + Duration::days(day_offset);
        // 超出学期范围停止
        if date > semester_end {
            break;
        }
        if date < semester_start {
            continue;
        }
        // 星期匹配（0=周日，与 Course.day_of_week 一致）
        if date.weekday().num_days_from_sunday() as i32 != course.day_of_week {
            continue;
        }
        // 周次模式匹配
        let week_num = (((date - semester_start).num_days() / 7) + 1).max(1);
        if !week_pattern_matches(&course.week_pattern, week_num) {
            continue;
        }
        // 本地触发时间转 UTC
        let local_naive = date.and_time(trigger_time);
        if let Some(local_dt) = Local.from_local_datetime(&local_naive).single() {
            if local_dt > now {
                return Ok(Some(local_dt.with_timezone(&Utc)));
            }
        }
    }
    Ok(None)
}

/// 解析课程时间（自由模式用 course.start_time/end_time，格点模式查 ClassPeriod）
fn resolve_course_time(
    repo: &Repository,
    course: &Course,
    semester: &Semester,
) -> Result<(String, String)> {
    if let (Some(s), Some(e)) = (&course.start_time, &course.end_time) {
        return Ok((s.clone(), e.clone()));
    }
    // 格点模式：查 ClassPeriod
    if let Some(pi) = course.period_index {
        let periods = repo.list_class_periods(&semester.id)?;
        if let Some(p) = periods.iter().find(|p| p.period_index == pi) {
            return Ok((p.start_time.clone(), p.end_time.clone()));
        }
    }
    Err(AppError::Trigger(format!(
        "无法确定课程时间: {}",
        course.subject
    )))
}

fn parse_date(s: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|e| AppError::Trigger(format!("日期解析失败 {}: {}", s, e)))
}

fn parse_hhmm(s: &str) -> Result<NaiveTime> {
    NaiveTime::parse_from_str(s, "%H:%M")
        .map_err(|e| AppError::Trigger(format!("时间解析失败 {}: {}", s, e)))
}

/// 从 HH:mm 减去分钟（课程时间合理不跨日，结果钳制到 00:00）
fn subtract_minutes(hhmm: &str, minutes: i32) -> String {
    let parts: Vec<&str> = hhmm.split(':').collect();
    if parts.len() != 2 {
        return hhmm.to_string();
    }
    let h: i32 = parts[0].parse().unwrap_or(0);
    let m: i32 = parts[1].parse().unwrap_or(0);
    let total = (h * 60 + m - minutes).max(0);
    format!("{:02}:{:02}", total / 60, total % 60)
}

/// 周次模式匹配
///
/// - "all" 或空 → 每周
/// - "odd" → 奇数周
/// - "even" → 偶数周
/// - "1,3,5" → 指定周次列表
fn week_pattern_matches(pattern: &str, week_num: i64) -> bool {
    let p = pattern.trim();
    if p.is_empty() || p == "all" {
        return true;
    }
    if p == "odd" {
        return week_num % 2 == 1;
    }
    if p == "even" {
        return week_num % 2 == 0;
    }
    // 逗号分隔的周次列表
    p.split(',')
        .filter_map(|s| s.trim().parse::<i64>().ok())
        .any(|w| w == week_num)
}
