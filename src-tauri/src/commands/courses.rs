//! 课程与课表 CRUD 命令
//!
//! 暴露给前端的学期 / 节次 / 课程 / 临时调课 invoke 命令。
//! 对应 SPEC 3.5 页面 2（时间轴）的数据操作。

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::{
    ClassPeriodInput, CreateCourseRequest, CreateOverrideRequest, CreateSemesterRequest,
    CreateWeeklyTemplateRequest, Course, ScheduleOverride, Semester, ClassPeriod,
    UpdateCourseRequest, UpdateSemesterRequest, UpdateWeeklyTemplateRequest, WeeklyTemplate,
};
use crate::state::AppState;

// ============ 学期 ============

/// 列出所有学期
#[tauri::command]
pub async fn list_semesters(state: State<'_, Arc<AppState>>) -> Result<Vec<Semester>> {
    let repo = Repository::new(&state.db);
    repo.list_semesters()
}

/// 获取单个学期
#[tauri::command]
pub async fn get_semester(state: State<'_, Arc<AppState>>, id: String) -> Result<Option<Semester>> {
    let repo = Repository::new(&state.db);
    repo.get_semester(&id)
}

/// 获取当前激活学期
#[tauri::command]
pub async fn get_active_semester(state: State<'_, Arc<AppState>>) -> Result<Option<Semester>> {
    let repo = Repository::new(&state.db);
    repo.get_active_semester()
}

/// 创建学期
#[tauri::command]
pub async fn create_semester(
    state: State<'_, Arc<AppState>>,
    request: CreateSemesterRequest,
) -> Result<Semester> {
    let repo = Repository::new(&state.db);
    repo.create_semester(request)
}

/// 更新学期
#[tauri::command]
pub async fn update_semester(
    state: State<'_, Arc<AppState>>,
    id: String,
    request: UpdateSemesterRequest,
) -> Result<Semester> {
    let repo = Repository::new(&state.db);
    repo.update_semester(&id, request)
}

/// 删除学期
#[tauri::command]
pub async fn delete_semester(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_semester(&id)
}

// ============ 节次定义 ============

/// 列出指定学期的所有节次
#[tauri::command]
pub async fn list_class_periods(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
) -> Result<Vec<ClassPeriod>> {
    let repo = Repository::new(&state.db);
    repo.list_class_periods(&semester_id)
}

/// 替换指定学期的所有节次
#[tauri::command]
pub async fn set_class_periods(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
    periods: Vec<ClassPeriodInput>,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.set_class_periods(&semester_id, &periods)
}

// ============ 周课表模板 ============

/// 列出指定学期的所有周模板
#[tauri::command]
pub async fn list_weekly_templates(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
) -> Result<Vec<WeeklyTemplate>> {
    let repo = Repository::new(&state.db);
    repo.list_weekly_templates(&semester_id)
}

/// 创建周模板
#[tauri::command]
pub async fn create_weekly_template(
    state: State<'_, Arc<AppState>>,
    request: CreateWeeklyTemplateRequest,
) -> Result<WeeklyTemplate> {
    let repo = Repository::new(&state.db);
    repo.create_weekly_template(request)
}

/// 更新周模板
#[tauri::command]
pub async fn update_weekly_template(
    state: State<'_, Arc<AppState>>,
    id: String,
    request: UpdateWeeklyTemplateRequest,
) -> Result<WeeklyTemplate> {
    let repo = Repository::new(&state.db);
    repo.update_weekly_template(&id, request)
}

/// 删除周模板
#[tauri::command]
pub async fn delete_weekly_template(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_weekly_template(&id)
}

// ============ 课程 ============

/// 列出指定学期的所有课程
#[tauri::command]
pub async fn list_courses(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
) -> Result<Vec<Course>> {
    let repo = Repository::new(&state.db);
    repo.list_courses(&semester_id)
}

/// 获取单个课程
#[tauri::command]
pub async fn get_course(state: State<'_, Arc<AppState>>, id: String) -> Result<Option<Course>> {
    let repo = Repository::new(&state.db);
    repo.get_course(&id)
}

/// 创建课程
#[tauri::command]
pub async fn create_course(
    state: State<'_, Arc<AppState>>,
    request: CreateCourseRequest,
) -> Result<Course> {
    let repo = Repository::new(&state.db);
    repo.create_course(request)
}

/// 更新课程
#[tauri::command]
pub async fn update_course(
    state: State<'_, Arc<AppState>>,
    id: String,
    request: UpdateCourseRequest,
) -> Result<Course> {
    let repo = Repository::new(&state.db);
    repo.update_course(&id, request)
}

/// 删除课程
#[tauri::command]
pub async fn delete_course(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_course(&id)
}

// ============ 临时调课 ============

/// 列出指定学期的所有调课记录
#[tauri::command]
pub async fn list_overrides(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
) -> Result<Vec<ScheduleOverride>> {
    let repo = Repository::new(&state.db);
    repo.list_overrides(&semester_id)
}

/// 列出指定日期的调课记录
#[tauri::command]
pub async fn list_overrides_by_date(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
    date: String,
) -> Result<Vec<ScheduleOverride>> {
    let repo = Repository::new(&state.db);
    repo.list_overrides_by_date(&semester_id, &date)
}

/// 创建临时调课记录
#[tauri::command]
pub async fn create_override(
    state: State<'_, Arc<AppState>>,
    request: CreateOverrideRequest,
) -> Result<ScheduleOverride> {
    let repo = Repository::new(&state.db);
    repo.create_override(request)
}

/// 删除临时调课记录
#[tauri::command]
pub async fn delete_override(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_override(&id)
}

/// 删除指定日期的所有调课记录
#[tauri::command]
pub async fn delete_overrides_by_date(
    state: State<'_, Arc<AppState>>,
    semester_id: String,
    date: String,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_overrides_by_date(&semester_id, &date)
}
