//! 数据库仓库层
//!
//! 封装所有实体的 CRUD 操作，提供类型安全的接口。

use chrono::{DateTime, Utc};
use rusqlite::{params, OptionalExtension};
use serde_json::Value;
use uuid::Uuid;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    common::{ActionType, ExecutionStatus, TriggerType},
    Action, AutomationFlow, ClassPeriod, ClassPeriodInput, Course, CreateCourseRequest,
    CreateFlowRequest, CreateOverrideRequest, CreateSemesterRequest, CreateWeeklyTemplateRequest,
    ExecutionLog, LogFilter, OverrideType, ScheduleOverride, Semester, Setting, Trigger,
    UpdateCourseRequest, UpdateFlowRequest, UpdateSemesterRequest, UpdateWeeklyTemplateRequest,
    WeeklyTemplate, InstalledScript, ScriptManifest, ScriptParam,
};

/// 仓库：提供所有实体的 CRUD 操作
pub struct Repository<'a> {
    db: &'a Database,
}

impl<'a> Repository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    // ============ 快捷指令 CRUD ============

    /// 列出所有快捷指令
    pub fn list_flows(&self) -> Result<Vec<AutomationFlow>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at
                 FROM automation_flows
                 ORDER BY created_at ASC",
            )?;
            let flows = stmt
                .query_map([], row_to_flow)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(flows)
        })
    }

    /// 获取单个快捷指令
    pub fn get_flow(&self, id: &str) -> Result<Option<AutomationFlow>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at
                 FROM automation_flows
                 WHERE id = ?1",
            )?;
            let flow = stmt
                .query_row(params![id], row_to_flow)
                .optional()?;
            Ok(flow)
        })
    }

    /// 创建快捷指令
    pub fn create_flow(&self, req: CreateFlowRequest) -> Result<AutomationFlow> {
        let flow = {
            let mut f = AutomationFlow::new(req.name);
            f.description = req.description;
            f.icon = req.icon;
            f.color = req.color;
            f
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO automation_flows
                 (id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    flow.id,
                    flow.name,
                    flow.description,
                    flow.icon,
                    flow.color,
                    flow.enabled as i32,
                    serde_json::to_string(&flow.default_fault_strategy)?,
                    flow.created_at.to_rfc3339(),
                    flow.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(flow)
    }

    /// 更新快捷指令
    pub fn update_flow(&self, id: &str, req: UpdateFlowRequest) -> Result<AutomationFlow> {
        let mut flow = self
            .get_flow(id)?
            .ok_or_else(|| AppError::NotFound(format!("快捷指令 {} 不存在", id)))?;

        if let Some(name) = req.name {
            flow.name = name;
        }
        if let Some(description) = req.description {
            flow.description = Some(description);
        }
        if let Some(icon) = req.icon {
            flow.icon = Some(icon);
        }
        if let Some(color) = req.color {
            flow.color = Some(color);
        }
        if let Some(enabled) = req.enabled {
            flow.enabled = enabled;
        }
        if let Some(strategy) = req.default_fault_strategy {
            flow.default_fault_strategy = strategy;
        }
        flow.updated_at = Utc::now();

        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows
                 SET name = ?2, description = ?3, icon = ?4, color = ?5, enabled = ?6,
                     default_fault_strategy = ?7, updated_at = ?8
                 WHERE id = ?1",
                params![
                    flow.id,
                    flow.name,
                    flow.description,
                    flow.icon,
                    flow.color,
                    flow.enabled as i32,
                    serde_json::to_string(&flow.default_fault_strategy)?,
                    flow.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(flow)
    }

    /// 删除快捷指令（级联删除关联的动作与触发器）
    pub fn delete_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM automation_flows WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    /// 启用快捷指令
    pub fn enable_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows SET enabled = 1, updated_at = ?2 WHERE id = ?1",
                params![id, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    /// 禁用快捷指令
    pub fn disable_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows SET enabled = 0, updated_at = ?2 WHERE id = ?1",
                params![id, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    // ============ 动作 CRUD ============

    /// 列出指定快捷指令的所有动作（按 order 排序）
    pub fn list_actions(&self, flow_id: &str) -> Result<Vec<Action>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note, position_x, position_y
                 FROM actions
                 WHERE flow_id = ?1
                 ORDER BY \"order\" ASC",
            )?;
            let actions = stmt
                .query_map(params![flow_id], row_to_action)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(actions)
        })
    }

    /// 替换快捷指令的所有动作（事务：先删除旧的再插入新的）
    pub fn set_actions(&self, flow_id: &str, actions: &[Action]) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "DELETE FROM actions WHERE flow_id = ?1",
                params![flow_id],
            )?;
            for action in actions {
                tx.execute(
                    "INSERT INTO actions
                     (id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note, position_x, position_y)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        action.id,
                        action.flow_id,
                        serde_json::to_string(&action.action_type)?,
                        action.params.to_string(),
                        action.order,
                        action.parent_id,
                        action
                            .fault_strategy
                            .map(|s| serde_json::to_string(&s).ok())
                            .flatten(),
                        action.note,
                        action.position_x,
                        action.position_y,
                    ],
                )?;
            }
            Ok(())
        })
    }

    // ============ 触发器 CRUD ============

    /// 列出指定快捷指令的所有触发器
    pub fn list_triggers(&self, flow_id: &str) -> Result<Vec<Trigger>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, flow_id, trigger_type, params, enabled
                 FROM triggers
                 WHERE flow_id = ?1",
            )?;
            let triggers = stmt
                .query_map(params![flow_id], row_to_trigger)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(triggers)
        })
    }

    /// 列出所有已启用的触发器（用于调度器轮询）
    pub fn list_all_enabled_triggers(&self) -> Result<Vec<Trigger>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT t.id, t.flow_id, t.trigger_type, t.params, t.enabled
                 FROM triggers t
                 INNER JOIN automation_flows f ON t.flow_id = f.id
                 WHERE t.enabled = 1 AND f.enabled = 1",
            )?;
            let triggers = stmt
                .query_map([], row_to_trigger)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(triggers)
        })
    }

    /// 替换快捷指令的所有触发器
    pub fn set_triggers(&self, flow_id: &str, triggers: &[Trigger]) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "DELETE FROM triggers WHERE flow_id = ?1",
                params![flow_id],
            )?;
            for trigger in triggers {
                tx.execute(
                    "INSERT INTO triggers (id, flow_id, trigger_type, params, enabled)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        trigger.id,
                        trigger.flow_id,
                        serde_json::to_string(&trigger.trigger_type)?,
                        trigger.params.to_string(),
                        trigger.enabled as i32,
                    ],
                )?;
            }
            Ok(())
        })
    }

    /// 启用触发器
    pub fn enable_trigger(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE triggers SET enabled = 1 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    /// 禁用触发器
    pub fn disable_trigger(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE triggers SET enabled = 0 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    // ============ 执行日志 CRUD ============

    /// 插入执行日志
    pub fn insert_log(&self, log: &ExecutionLog) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO execution_logs
                 (id, flow_id, action_id, status, started_at, finished_at, duration_ms, error, context)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    log.id,
                    log.flow_id,
                    log.action_id,
                    serde_json::to_string(&log.status)?,
                    log.started_at.to_rfc3339(),
                    log.finished_at.map(|t| t.to_rfc3339()),
                    log.duration_ms.map(|d| d as i64),
                    log.error,
                    log.context,
                ],
            )?;
            Ok(())
        })
    }

    /// 更新执行日志（状态/结束时间/耗时/错误信息）
    ///
    /// 用于执行完成或失败后更新已有记录。
    /// Phase 5 修复：原 chain.rs 在 start 时 insert、结束时再次 insert 导致主键冲突。
    pub fn update_log(&self, log: &ExecutionLog) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE execution_logs
                 SET status = ?1, finished_at = ?2, duration_ms = ?3, error = ?4, context = ?5
                 WHERE id = ?6",
                params![
                    serde_json::to_string(&log.status)?,
                    log.finished_at.map(|t| t.to_rfc3339()),
                    log.duration_ms.map(|d| d as i64),
                    log.error,
                    log.context,
                    log.id,
                ],
            )?;
            Ok(())
        })
    }

    /// 查询执行日志
    pub fn list_logs(&self, filter: &LogFilter) -> Result<Vec<ExecutionLog>> {
        self.db.with_conn(|conn| {
            let limit = filter.limit.unwrap_or(100) as i64;
            let offset = filter.offset.unwrap_or(0) as i64;

            let mut sql = String::from(
                "SELECT id, flow_id, action_id, status, started_at, finished_at, duration_ms, error, context
                 FROM execution_logs WHERE 1=1",
            );
            let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

            if let Some(flow_id) = &filter.flow_id {
                sql.push_str(" AND flow_id = ?");
                param_values.push(Box::new(flow_id.clone()));
            }
            if let Some(status) = &filter.status {
                sql.push_str(" AND status = ?");
                param_values.push(Box::new(serde_json::to_string(status)?));
            }

            sql.push_str(" ORDER BY started_at DESC LIMIT ? OFFSET ?");
            param_values.push(Box::new(limit));
            param_values.push(Box::new(offset));

            let params_refs: Vec<&dyn rusqlite::ToSql> =
                param_values.iter().map(|p| p.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let logs = stmt
                .query_map(params_refs.as_slice(), row_to_log)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(logs)
        })
    }

    /// 清理执行日志（保留最近 N 条）
    pub fn cleanup_logs(&self, keep: usize) -> Result<usize> {
        self.db.with_conn(|conn| {
            let deleted = conn.execute(
                "DELETE FROM execution_logs
                 WHERE id NOT IN (
                     SELECT id FROM execution_logs
                     ORDER BY started_at DESC
                     LIMIT ?1
                 )",
                params![keep as i64],
            )?;
            if deleted > 0 {
                tracing::info!("清理了 {} 条旧执行日志", deleted);
            }
            Ok(deleted)
        })
    }

    /// 清空执行日志
    ///
    /// - `before`：若指定，仅删除 `started_at >= before` 的日志（即该时间点之后的记录）；
    ///   否则清空全部。
    /// - 返回被删除的记录数。
    pub fn clear_logs(&self, before: Option<DateTime<Utc>>) -> Result<usize> {
        self.db.with_conn(|conn| {
            let deleted = if let Some(before) = before {
                conn.execute(
                    "DELETE FROM execution_logs WHERE datetime(started_at) >= datetime(?)",
                    params![before.to_rfc3339()],
                )?
            } else {
                conn.execute("DELETE FROM execution_logs", [])?
            };
            Ok(deleted)
        })
    }

    // ============ 设置 CRUD ============

    /// 获取设置项
    pub fn get_setting(&self, key: &str) -> Result<Option<Setting>> {
        self.db.with_conn(|conn| {
            let setting = conn
                .query_row(
                    "SELECT key, value, value_type FROM settings WHERE key = ?1",
                    params![key],
                    |row| {
                        Ok(Setting {
                            key: row.get(0)?,
                            value: row.get(1)?,
                            value_type: row.get(2)?,
                        })
                    },
                )
                .optional()?;
            Ok(setting)
        })
    }

    /// 设置值（upsert：存在则更新，不存在则插入）
    pub fn set_setting(&self, setting: &Setting) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO settings (key, value, value_type) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = ?2, value_type = ?3",
                params![setting.key, setting.value, setting.value_type],
            )?;
            Ok(())
        })
    }

    /// 获取所有设置
    pub fn get_all_settings(&self) -> Result<Vec<Setting>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT key, value, value_type FROM settings")?;
            let settings = stmt
                .query_map([], |row| {
                    Ok(Setting {
                        key: row.get(0)?,
                        value: row.get(1)?,
                        value_type: row.get(2)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(settings)
        })
    }

    // ============ 学期 CRUD ============

    /// 列出所有学期
    pub fn list_semesters(&self) -> Result<Vec<Semester>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, start_date, end_date, week_count, is_active, created_at, updated_at
                 FROM semesters
                 ORDER BY start_date DESC",
            )?;
            let semesters = stmt
                .query_map([], row_to_semester)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(semesters)
        })
    }

    /// 获取单个学期
    pub fn get_semester(&self, id: &str) -> Result<Option<Semester>> {
        self.db.with_conn(|conn| {
            let semester = conn
                .query_row(
                    "SELECT id, name, start_date, end_date, week_count, is_active, created_at, updated_at
                     FROM semesters WHERE id = ?1",
                    params![id],
                    row_to_semester,
                )
                .optional()?;
            Ok(semester)
        })
    }

    /// 获取当前激活学期
    pub fn get_active_semester(&self) -> Result<Option<Semester>> {
        self.db.with_conn(|conn| {
            let semester = conn
                .query_row(
                    "SELECT id, name, start_date, end_date, week_count, is_active, created_at, updated_at
                     FROM semesters WHERE is_active = 1 LIMIT 1",
                    [],
                    row_to_semester,
                )
                .optional()?;
            Ok(semester)
        })
    }

    /// 创建学期
    pub fn create_semester(&self, req: CreateSemesterRequest) -> Result<Semester> {
        let semester = Semester::new(req.name, req.start_date, req.end_date, req.week_count);

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO semesters
                 (id, name, start_date, end_date, week_count, is_active, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    semester.id,
                    semester.name,
                    semester.start_date,
                    semester.end_date,
                    semester.week_count,
                    semester.is_active as i32,
                    semester.created_at.to_rfc3339(),
                    semester.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(semester)
    }

    /// 更新学期
    pub fn update_semester(&self, id: &str, req: UpdateSemesterRequest) -> Result<Semester> {
        let mut semester = self
            .get_semester(id)?
            .ok_or_else(|| AppError::NotFound(format!("学期 {} 不存在", id)))?;

        if let Some(name) = req.name {
            semester.name = name;
        }
        if let Some(start_date) = req.start_date {
            semester.start_date = start_date;
        }
        if let Some(end_date) = req.end_date {
            semester.end_date = end_date;
        }
        if let Some(week_count) = req.week_count {
            semester.week_count = week_count;
        }
        if let Some(is_active) = req.is_active {
            semester.is_active = is_active;
        }
        semester.updated_at = Utc::now();

        // 激活学期为互斥操作：同一时刻仅一个学期激活
        self.db.with_transaction(|tx| {
            if semester.is_active {
                tx.execute(
                    "UPDATE semesters SET is_active = 0 WHERE id != ?1",
                    params![semester.id],
                )?;
            }
            tx.execute(
                "UPDATE semesters
                 SET name = ?2, start_date = ?3, end_date = ?4, week_count = ?5,
                     is_active = ?6, updated_at = ?7
                 WHERE id = ?1",
                params![
                    semester.id,
                    semester.name,
                    semester.start_date,
                    semester.end_date,
                    semester.week_count,
                    semester.is_active as i32,
                    semester.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(semester)
    }

    /// 删除学期（级联删除节次/课程/调课）
    pub fn delete_semester(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM semesters WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    // ============ 节次定义 CRUD ============

    /// 列出指定学期的所有节次（按节次顺序）
    pub fn list_class_periods(&self, semester_id: &str) -> Result<Vec<ClassPeriod>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, semester_id, period_index, start_time, end_time, name
                 FROM class_periods
                 WHERE semester_id = ?1
                 ORDER BY period_index ASC",
            )?;
            let periods = stmt
                .query_map(params![semester_id], row_to_class_period)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(periods)
        })
    }

    /// 替换指定学期的所有节次（事务：先删除旧的再插入新的）
    pub fn set_class_periods(
        &self,
        semester_id: &str,
        periods: &[ClassPeriodInput],
    ) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "DELETE FROM class_periods WHERE semester_id = ?1",
                params![semester_id],
            )?;
            for p in periods {
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
            Ok(())
        })
    }

    // ============ 课程 CRUD ============

    /// 列出指定学期的所有课程
    pub fn list_courses(&self, semester_id: &str) -> Result<Vec<Course>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, semester_id, template_id, subject, day_of_week, period_index, start_time,
                        end_time, week_pattern, room, teacher, color, flow_id, note,
                        created_at, updated_at
                 FROM courses
                 WHERE semester_id = ?1
                 ORDER BY day_of_week ASC, COALESCE(period_index, 0) ASC",
            )?;
            let courses = stmt
                .query_map(params![semester_id], row_to_course)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(courses)
        })
    }

    /// 获取单个课程
    pub fn get_course(&self, id: &str) -> Result<Option<Course>> {
        self.db.with_conn(|conn| {
            let course = conn
                .query_row(
                    "SELECT id, semester_id, template_id, subject, day_of_week, period_index, start_time,
                            end_time, week_pattern, room, teacher, color, flow_id, note,
                            created_at, updated_at
                     FROM courses WHERE id = ?1",
                    params![id],
                    row_to_course,
                )
                .optional()?;
            Ok(course)
        })
    }

    /// 创建课程
    pub fn create_course(&self, req: CreateCourseRequest) -> Result<Course> {
        let now = Utc::now();
        let course = Course {
            id: Uuid::new_v4().to_string(),
            semester_id: req.semester_id,
            template_id: req.template_id,
            subject: req.subject,
            day_of_week: req.day_of_week,
            period_index: req.period_index,
            start_time: req.start_time,
            end_time: req.end_time,
            week_pattern: req.week_pattern.unwrap_or_else(|| "all".to_string()),
            room: req.room,
            teacher: req.teacher,
            color: req.color,
            flow_id: req.flow_id,
            note: req.note,
            created_at: now,
            updated_at: now,
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO courses
                 (id, semester_id, template_id, subject, day_of_week, period_index, start_time, end_time,
                  week_pattern, room, teacher, color, flow_id, note, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    course.id,
                    course.semester_id,
                    course.template_id,
                    course.subject,
                    course.day_of_week,
                    course.period_index,
                    course.start_time,
                    course.end_time,
                    course.week_pattern,
                    course.room,
                    course.teacher,
                    course.color,
                    course.flow_id,
                    course.note,
                    course.created_at.to_rfc3339(),
                    course.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(course)
    }

    /// 更新课程
    pub fn update_course(&self, id: &str, req: UpdateCourseRequest) -> Result<Course> {
        let mut course = self
            .get_course(id)?
            .ok_or_else(|| AppError::NotFound(format!("课程 {} 不存在", id)))?;

        if let Some(template_id) = req.template_id {
            course.template_id = template_id;
        }
        if let Some(subject) = req.subject {
            course.subject = subject;
        }
        if let Some(day_of_week) = req.day_of_week {
            course.day_of_week = day_of_week;
        }
        if let Some(period_index) = req.period_index {
            course.period_index = period_index;
        }
        if let Some(start_time) = req.start_time {
            course.start_time = start_time;
        }
        if let Some(end_time) = req.end_time {
            course.end_time = end_time;
        }
        if let Some(week_pattern) = req.week_pattern {
            course.week_pattern = week_pattern;
        }
        if let Some(room) = req.room {
            course.room = room;
        }
        if let Some(teacher) = req.teacher {
            course.teacher = teacher;
        }
        if let Some(color) = req.color {
            course.color = color;
        }
        if let Some(flow_id) = req.flow_id {
            course.flow_id = flow_id;
        }
        if let Some(note) = req.note {
            course.note = note;
        }
        course.updated_at = Utc::now();

        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE courses
                 SET template_id = ?2, subject = ?3, day_of_week = ?4, period_index = ?5, start_time = ?6,
                     end_time = ?7, week_pattern = ?8, room = ?9, teacher = ?10, color = ?11,
                     flow_id = ?12, note = ?13, updated_at = ?14
                 WHERE id = ?1",
                params![
                    course.id,
                    course.template_id,
                    course.subject,
                    course.day_of_week,
                    course.period_index,
                    course.start_time,
                    course.end_time,
                    course.week_pattern,
                    course.room,
                    course.teacher,
                    course.color,
                    course.flow_id,
                    course.note,
                    course.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(course)
    }

    /// 删除课程
    pub fn delete_course(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM courses WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    // ============ 周课表模板 CRUD ============

    /// 列出指定学期的所有周模板
    pub fn list_weekly_templates(&self, semester_id: &str) -> Result<Vec<WeeklyTemplate>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, semester_id, name, description, color, created_at, updated_at
                 FROM weekly_templates
                 WHERE semester_id = ?1
                 ORDER BY created_at ASC",
            )?;
            let templates = stmt
                .query_map(params![semester_id], row_to_weekly_template)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(templates)
        })
    }

    /// 获取单个周模板
    pub fn get_weekly_template(&self, id: &str) -> Result<Option<WeeklyTemplate>> {
        self.db.with_conn(|conn| {
            let template = conn
                .query_row(
                    "SELECT id, semester_id, name, description, color, created_at, updated_at
                     FROM weekly_templates WHERE id = ?1",
                    params![id],
                    row_to_weekly_template,
                )
                .optional()?;
            Ok(template)
        })
    }

    /// 创建周模板
    pub fn create_weekly_template(
        &self,
        req: CreateWeeklyTemplateRequest,
    ) -> Result<WeeklyTemplate> {
        let mut template = WeeklyTemplate::new(req.semester_id, req.name);
        template.description = req.description;
        template.color = req.color;

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO weekly_templates
                 (id, semester_id, name, description, color, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    template.id,
                    template.semester_id,
                    template.name,
                    template.description,
                    template.color,
                    template.created_at.to_rfc3339(),
                    template.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(template)
    }

    /// 更新周模板
    pub fn update_weekly_template(
        &self,
        id: &str,
        req: UpdateWeeklyTemplateRequest,
    ) -> Result<WeeklyTemplate> {
        let mut template = self
            .get_weekly_template(id)?
            .ok_or_else(|| AppError::NotFound(format!("周模板 {} 不存在", id)))?;

        if let Some(name) = &req.name {
            template.name = name.clone();
        }
        if let Some(description) = &req.description {
            template.description = Some(description.clone());
        }
        if let Some(color) = &req.color {
            template.color = Some(color.clone());
        }
        template.updated_at = Utc::now();

        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE weekly_templates
                 SET name = ?2, description = ?3, color = ?4, updated_at = ?5
                 WHERE id = ?1",
                params![
                    template.id,
                    template.name,
                    template.description,
                    template.color,
                    template.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(template)
    }

    /// 删除周模板（关联课程的 template_id 置 NULL）
    pub fn delete_weekly_template(&self, id: &str) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "UPDATE courses SET template_id = NULL WHERE template_id = ?1",
                params![id],
            )?;
            tx.execute(
                "DELETE FROM weekly_templates WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    // ============ 临时调课 CRUD ============

    /// 列出指定学期某日期范围的调课记录
    pub fn list_overrides(&self, semester_id: &str) -> Result<Vec<ScheduleOverride>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, semester_id, date, course_id, type, target_period_index,
                        target_start_time, target_end_time, note, created_at
                 FROM schedule_overrides
                 WHERE semester_id = ?1
                 ORDER BY date ASC",
            )?;
            let overrides = stmt
                .query_map(params![semester_id], row_to_override)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(overrides)
        })
    }

    /// 列出指定日期的调课记录
    pub fn list_overrides_by_date(
        &self,
        semester_id: &str,
        date: &str,
    ) -> Result<Vec<ScheduleOverride>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, semester_id, date, course_id, type, target_period_index,
                        target_start_time, target_end_time, note, created_at
                 FROM schedule_overrides
                 WHERE semester_id = ?1 AND date = ?2",
            )?;
            let overrides = stmt
                .query_map(params![semester_id, date], row_to_override)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(overrides)
        })
    }

    /// 创建临时调课记录
    pub fn create_override(&self, req: CreateOverrideRequest) -> Result<ScheduleOverride> {
        let override_record = ScheduleOverride {
            id: Uuid::new_v4().to_string(),
            semester_id: req.semester_id,
            date: req.date,
            course_id: req.course_id,
            r#type: req.r#type,
            target_period_index: req.target_period_index,
            target_start_time: req.target_start_time,
            target_end_time: req.target_end_time,
            note: req.note,
            created_at: Utc::now(),
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO schedule_overrides
                 (id, semester_id, date, course_id, type, target_period_index,
                  target_start_time, target_end_time, note, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    override_record.id,
                    override_record.semester_id,
                    override_record.date,
                    override_record.course_id,
                    override_record.r#type.as_str(),
                    override_record.target_period_index,
                    override_record.target_start_time,
                    override_record.target_end_time,
                    override_record.note,
                    override_record.created_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(override_record)
    }

    /// 删除临时调课记录
    pub fn delete_override(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM schedule_overrides WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    /// 删除指定日期的所有调课记录
    pub fn delete_overrides_by_date(&self, semester_id: &str, date: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM schedule_overrides WHERE semester_id = ?1 AND date = ?2",
                params![semester_id, date],
            )?;
            Ok(())
        })
    }

    // ============ Lua 脚本 CRUD ============

    /// 列出所有已安装脚本
    pub fn list_installed_scripts(&self) -> Result<Vec<InstalledScript>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT script_id, name, author, version, description, permissions, params_schema,
                        installed_at, updated_at, source_url, content_hash
                 FROM lua_scripts
                 ORDER BY installed_at ASC",
            )?;
            let scripts = stmt
                .query_map([], row_to_installed_script)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(scripts)
        })
    }

    /// 获取单个已安装脚本
    pub fn get_installed_script(&self, script_id: &str) -> Result<Option<InstalledScript>> {
        self.db.with_conn(|conn| {
            let script = conn
                .query_row(
                    "SELECT script_id, name, author, version, description, permissions, params_schema,
                            installed_at, updated_at, source_url, content_hash
                     FROM lua_scripts
                     WHERE script_id = ?1",
                    params![script_id],
                    row_to_installed_script,
                )
                .optional()?;
            Ok(script)
        })
    }

    /// 插入已安装脚本（安装时调用）
    pub fn insert_installed_script(
        &self,
        manifest: &ScriptManifest,
        source_url: &str,
        content_hash: &str,
    ) -> Result<()> {
        let permissions_json = serde_json::to_string(&manifest.permissions)?;
        let params_json = serde_json::to_string(&manifest.params)?;
        let now = Utc::now().to_rfc3339();
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO lua_scripts
                    (script_id, name, author, version, description, permissions, params_schema,
                     installed_at, updated_at, source_url, content_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9, ?10)",
                params![
                    manifest.id,
                    manifest.name,
                    manifest.author,
                    manifest.version,
                    manifest.description,
                    permissions_json,
                    params_json,
                    now,
                    source_url,
                    content_hash,
                ],
            )?;
            Ok(())
        })
    }

    /// 更新已安装脚本（市场更新时调用）
    pub fn update_installed_script(
        &self,
        manifest: &ScriptManifest,
        content_hash: &str,
    ) -> Result<()> {
        let permissions_json = serde_json::to_string(&manifest.permissions)?;
        let params_json = serde_json::to_string(&manifest.params)?;
        let now = Utc::now().to_rfc3339();
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE lua_scripts
                 SET name = ?2, author = ?3, version = ?4, description = ?5,
                     permissions = ?6, params_schema = ?7, updated_at = ?8, content_hash = ?9
                 WHERE script_id = ?1",
                params![
                    manifest.id,
                    manifest.name,
                    manifest.author,
                    manifest.version,
                    manifest.description,
                    permissions_json,
                    params_json,
                    now,
                    content_hash,
                ],
            )?;
            Ok(())
        })
    }

    /// 删除已安装脚本记录
    pub fn delete_installed_script(&self, script_id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM lua_scripts WHERE script_id = ?1", params![script_id])?;
            Ok(())
        })
    }
}

// ============ Row 映射函数 ============

fn row_to_flow(row: &rusqlite::Row<'_>) -> rusqlite::Result<AutomationFlow> {
    let enabled: i32 = row.get(5)?;
    let strategy_str: String = row.get(6)?;
    let created_str: String = row.get(7)?;
    let updated_str: String = row.get(8)?;

    Ok(AutomationFlow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        icon: row.get(3)?,
        color: row.get(4)?,
        enabled: enabled != 0,
        default_fault_strategy: serde_json::from_str(&strategy_str).unwrap_or_default(),
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_action(row: &rusqlite::Row<'_>) -> rusqlite::Result<Action> {
    let action_type_str: String = row.get(2)?;
    let params_str: String = row.get(3)?;
    let strategy_str: Option<String> = row.get(6)?;

    Ok(Action {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        action_type: serde_json::from_str(&action_type_str).unwrap_or(ActionType::SetVariable),
        params: serde_json::from_str(&params_str).unwrap_or_else(|_| Value::Null),
        order: row.get(4)?,
        parent_id: row.get(5)?,
        fault_strategy: strategy_str
            .and_then(|s| serde_json::from_str(&s).ok()),
        note: row.get(7)?,
        position_x: row.get(8)?,
        position_y: row.get(9)?,
    })
}

fn row_to_trigger(row: &rusqlite::Row<'_>) -> rusqlite::Result<Trigger> {
    let trigger_type_str: String = row.get(2)?;
    let params_str: String = row.get(3)?;
    let enabled: i32 = row.get(4)?;

    Ok(Trigger {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        trigger_type: serde_json::from_str(&trigger_type_str).unwrap_or(TriggerType::Manual),
        params: serde_json::from_str(&params_str).unwrap_or_else(|_| Value::Null),
        enabled: enabled != 0,
    })
}

fn row_to_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExecutionLog> {
    let status_str: String = row.get(3)?;
    let started_str: String = row.get(4)?;
    let finished_str: Option<String> = row.get(5)?;
    let duration: Option<i64> = row.get(6)?;

    Ok(ExecutionLog {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        action_id: row.get(2)?,
        status: serde_json::from_str(&status_str).unwrap_or(ExecutionStatus::Failed),
        started_at: DateTime::parse_from_rfc3339(&started_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        finished_at: finished_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        duration_ms: duration.map(|d| d as u64),
        error: row.get(7)?,
        context: row.get(8)?,
    })
}

// FaultStrategy 不需要 FromSql，因为通过 serde_json 序列化字符串存储
// Default 实现由 common.rs 中的 #[derive(Default)] + #[default] variant 提供

fn row_to_semester(row: &rusqlite::Row<'_>) -> rusqlite::Result<Semester> {
    let is_active: i32 = row.get(5)?;
    let created_str: String = row.get(6)?;
    let updated_str: String = row.get(7)?;

    Ok(Semester {
        id: row.get(0)?,
        name: row.get(1)?,
        start_date: row.get(2)?,
        end_date: row.get(3)?,
        week_count: row.get(4)?,
        is_active: is_active != 0,
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_class_period(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClassPeriod> {
    Ok(ClassPeriod {
        id: row.get(0)?,
        semester_id: row.get(1)?,
        period_index: row.get(2)?,
        start_time: row.get(3)?,
        end_time: row.get(4)?,
        name: row.get(5)?,
    })
}

fn row_to_course(row: &rusqlite::Row<'_>) -> rusqlite::Result<Course> {
    let created_str: String = row.get(14)?;
    let updated_str: String = row.get(15)?;

    Ok(Course {
        id: row.get(0)?,
        semester_id: row.get(1)?,
        template_id: row.get(2)?,
        subject: row.get(3)?,
        day_of_week: row.get(4)?,
        period_index: row.get(5)?,
        start_time: row.get(6)?,
        end_time: row.get(7)?,
        week_pattern: row.get(8)?,
        room: row.get(9)?,
        teacher: row.get(10)?,
        color: row.get(11)?,
        flow_id: row.get(12)?,
        note: row.get(13)?,
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_weekly_template(row: &rusqlite::Row<'_>) -> rusqlite::Result<WeeklyTemplate> {
    let created_str: String = row.get(5)?;
    let updated_str: String = row.get(6)?;

    Ok(WeeklyTemplate {
        id: row.get(0)?,
        semester_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        color: row.get(4)?,
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_override(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScheduleOverride> {
    let type_str: String = row.get(4)?;
    let created_str: String = row.get(9)?;

    Ok(ScheduleOverride {
        id: row.get(0)?,
        semester_id: row.get(1)?,
        date: row.get(2)?,
        course_id: row.get(3)?,
        r#type: OverrideType::from_str(&type_str).unwrap_or(OverrideType::Cancel),
        target_period_index: row.get(5)?,
        target_start_time: row.get(6)?,
        target_end_time: row.get(7)?,
        note: row.get(8)?,
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_installed_script(row: &rusqlite::Row<'_>) -> rusqlite::Result<InstalledScript> {
    let permissions_str: String = row.get(5)?;
    let params_str: String = row.get(6)?;
    let installed_str: String = row.get(7)?;
    let updated_str: String = row.get(8)?;

    let permissions: Vec<String> = serde_json::from_str(&permissions_str).unwrap_or_default();
    let params_schema: Vec<ScriptParam> = serde_json::from_str(&params_str).unwrap_or_default();

    Ok(InstalledScript {
        script_id: row.get(0)?,
        name: row.get(1)?,
        author: row.get(2)?,
        version: row.get(3)?,
        description: row.get(4)?,
        permissions,
        params_schema,
        installed_at: DateTime::parse_from_rfc3339(&installed_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        source_url: row.get(9)?,
        content_hash: row.get(10)?,
    })
}
