//! 课表初始化引导向导命令（Phase 6a · SPEC 11.2）
//!
//! 提供首次启动检测、向导数据提交、演示模式加载、跳过、重置等命令。
//! 向导数据提交采用事务性写入（SPEC 11.2 数据流：全部成功 COMMIT，任一失败 ROLLBACK）。

use std::sync::Arc;

use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::Repository;
use crate::error::Result;
use crate::models::setting::Setting;
use crate::state::AppState;

/// 向导状态（首次启动检测用）
#[derive(Debug, Clone, serde::Serialize)]
pub struct OnboardingStatus {
    /// 是否已完成向导（settings.onboarding_completed）
    pub onboarding_completed: bool,
    /// 是否已有学期数据（semesters 表非空）
    pub has_semesters: bool,
    /// 是否演示模式（settings.demo_mode）
    pub demo_mode: bool,
}

/// 学期配置（步骤 1）
#[derive(Debug, Clone, serde::Deserialize)]
pub struct OnboardingSemester {
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub week_count: i32,
    pub is_active: bool,
}

/// 节次配置（步骤 2）
#[derive(Debug, Clone, serde::Deserialize)]
pub struct OnboardingPeriod {
    pub period_index: i32,
    pub start_time: String,
    pub end_time: String,
    pub name: Option<String>,
}

/// 课程配置（步骤 3）
#[derive(Debug, Clone, serde::Deserialize)]
pub struct OnboardingCourse {
    pub subject: String,
    pub day_of_week: i32,
    pub period_index: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub room: Option<String>,
    pub teacher: Option<String>,
    /// 周次模式 "all"/"odd"/"even"/"1,3,5,7"（None 视为 "all"）
    pub week_pattern: Option<String>,
}

/// 完整向导数据（步骤 4 提交）
#[derive(Debug, Clone, serde::Deserialize)]
pub struct OnboardingData {
    pub semester: OnboardingSemester,
    pub periods: Vec<OnboardingPeriod>,
    pub courses: Vec<OnboardingCourse>,
}

/// 读取向导状态
///
/// 首次启动检测：onboarding_completed=false 且 has_semesters=false 时触发向导。
#[tauri::command]
pub async fn get_onboarding_status(state: State<'_, Arc<AppState>>) -> Result<OnboardingStatus> {
    let repo = Repository::new(&state.db);

    let onboarding_completed = repo
        .get_setting("onboarding_completed")
        .ok()
        .flatten()
        .and_then(|s| s.as_bool())
        .unwrap_or(false);

    let demo_mode = repo
        .get_setting("demo_mode")
        .ok()
        .flatten()
        .and_then(|s| s.as_bool())
        .unwrap_or(false);

    let has_semesters = !repo.list_semesters()?.is_empty();

    Ok(OnboardingStatus {
        onboarding_completed,
        has_semesters,
        demo_mode,
    })
}

/// 完成向导（事务性写入学期 + 节次 + 课程 + 标记完成）
///
/// SPEC 11.2 数据流：步骤 1-3 缓存内存，步骤 4 开启事务一次性写入。
/// 任一失败 → ROLLBACK + 保留在步骤 4 + 显示错误信息。
#[tauri::command]
pub async fn complete_onboarding(
    state: State<'_, Arc<AppState>>,
    data: OnboardingData,
) -> Result<()> {
    let semester_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    state.db.with_transaction(|tx| {
        // 1. 写入学期
        tx.execute(
            "INSERT INTO semesters
             (id, name, start_date, end_date, week_count, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                semester_id,
                data.semester.name,
                data.semester.start_date,
                data.semester.end_date,
                data.semester.week_count,
                data.semester.is_active as i32,
                now,
                now,
            ],
        )?;

        // 2. 写入节次
        for p in &data.periods {
            tx.execute(
                "INSERT INTO class_periods
                 (id, semester_id, period_index, start_time, end_time, name)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    Uuid::new_v4().to_string(),
                    semester_id,
                    p.period_index,
                    p.start_time,
                    p.end_time,
                    p.name,
                ],
            )?;
        }

        // 3. 写入课程
        for c in &data.courses {
            tx.execute(
                "INSERT INTO courses
                 (id, semester_id, template_id, subject, day_of_week, period_index,
                  start_time, end_time, week_pattern, room, teacher, color, flow_id, note,
                  created_at, updated_at)
                 VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, NULL, NULL, NULL, ?11, ?11)",
                params![
                    Uuid::new_v4().to_string(),
                    semester_id,
                    c.subject,
                    c.day_of_week,
                    c.period_index,
                    c.start_time,
                    c.end_time,
                    c.week_pattern.as_deref().unwrap_or("all"),
                    c.room,
                    c.teacher,
                    now,
                ],
            )?;
        }

        // 4. 标记 onboarding_completed=true
        tx.execute(
            "INSERT INTO settings (key, value, value_type)
             VALUES ('onboarding_completed', 'true', 'bool')
             ON CONFLICT(key) DO UPDATE SET value = 'true', value_type = 'bool'",
            [],
        )?;

        Ok(())
    })?;

    tracing::info!(
        "课表向导完成：学期={}，节次={}，课程={}",
        data.semester.name,
        data.periods.len(),
        data.courses.len()
    );

    Ok(())
}

/// 示例数据 SQL（编译期嵌入）
///
/// 数据源：src/assets/seed_courses_data.sql（不参与 refinery 迁移）
///
/// 背景：原本 V004__seed_courses.sql 在 refinery 迁移时自动执行，
///       导致清库重建后示例数据被自动插入，与"跳过向导应得空课表"冲突（Beta6 修复）。
///       现在迁移文件 V004 保持空注释状态，示例数据移到 src/assets/，
///       仅当用户主动点击"加载示例数据"时通过本命令执行。
const SEED_COURSES_SQL: &str = include_str!("../assets/seed_courses_data.sql");

/// 加载演示数据（SPEC 11.2 演示模式）
///
/// 重新插入 V004 示例学期+节次+课程+周模板，并标记 onboarding_completed=true + demo_mode=true。
/// 幂等：先按 seed- ID 前缀清理可能残留的示例数据，再用 INSERT OR REPLACE 重新插入。
#[tauri::command]
pub async fn load_demo_data(state: State<'_, Arc<AppState>>) -> Result<()> {
    state.db.with_transaction(|tx| {
        // 1. 清理可能残留的 seed 数据（按 ID 前缀，幂等）
        //    按外键依赖顺序删除（子表优先）
        tx.execute("DELETE FROM schedule_overrides", [])?;
        tx.execute("DELETE FROM courses WHERE id LIKE 'seed-%'", [])?;
        tx.execute("DELETE FROM class_periods WHERE id LIKE 'seed-%'", [])?;
        tx.execute("DELETE FROM weekly_templates WHERE id LIKE 'seed-%'", [])?;
        tx.execute("DELETE FROM semesters WHERE id LIKE 'seed-%'", [])?;

        // 2. 执行示例数据 SQL（数据源：src/assets/seed_courses_data.sql）
        //    把 INSERT INTO 替换为 INSERT OR REPLACE INTO 实现幂等
        let seed_sql = SEED_COURSES_SQL.replace("INSERT INTO", "INSERT OR REPLACE INTO");
        tx.execute_batch(&seed_sql)?;

        // 3. 标记 onboarding_completed=true + demo_mode=true
        tx.execute(
            "INSERT INTO settings (key, value, value_type)
             VALUES ('onboarding_completed', 'true', 'bool')
             ON CONFLICT(key) DO UPDATE SET value = 'true', value_type = 'bool'",
            [],
        )?;
        tx.execute(
            "INSERT INTO settings (key, value, value_type)
             VALUES ('demo_mode', 'true', 'bool')
             ON CONFLICT(key) DO UPDATE SET value = 'true', value_type = 'bool'",
            [],
        )?;
        Ok(())
    })?;

    tracing::info!("演示模式已加载（重新插入 V004 示例数据）");
    Ok(())
}

/// 跳过向导（不创建任何数据，标记 onboarding_completed=true）
#[tauri::command]
pub async fn skip_onboarding(state: State<'_, Arc<AppState>>) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.set_setting(&Setting::from_bool("onboarding_completed", true))?;
    tracing::info!("已跳过课表向导（空课表）");
    Ok(())
}

/// 重置课表数据（SPEC 11.2 手动触发重新初始化）
///
/// 清空 5 张课表表 + 清除 onboarding_completed/demo_mode 标记，
/// 前端重新触发向导。
#[tauri::command]
pub async fn reset_schedule_data(state: State<'_, Arc<AppState>>) -> Result<()> {
    state.db.with_transaction(|tx| {
        // 按外键依赖顺序删除（子表优先）
        tx.execute("DELETE FROM schedule_overrides", [])?;
        tx.execute("DELETE FROM courses", [])?;
        tx.execute("DELETE FROM class_periods", [])?;
        tx.execute("DELETE FROM weekly_templates", [])?;
        tx.execute("DELETE FROM semesters", [])?;
        // 清除向导标记
        tx.execute(
            "DELETE FROM settings WHERE key IN ('onboarding_completed', 'demo_mode')",
            [],
        )?;
        Ok(())
    })?;

    tracing::info!("课表数据已清空，可重新触发向导");
    Ok(())
}
