//! 导入导出命令（Phase 6b · SPEC 5.5）
//!
//! 实现 .exero 文件格式（zip 包，含 JSON 数据 + Lua 脚本）。
//! 范围：快捷指令（flows + actions + triggers）/ 课表（semesters + class_periods +
//! weekly_templates + courses + schedule_overrides）/ 设置（settings）/ Lua 脚本
//! （本地 .lua 文件 + lua_scripts 表记录）。
//!
//! 用途：U 盘导入导出（家里 ↔ 学校配置同步）。
//!
//! 文件结构：
//! ```text
//! exero_export.exero (zip)
//! ├── meta.json         # 导出元信息（版本、时间、范围）
//! ├── data.json         # 各表数据（按 scope 分组）
//! └── scripts/          # Lua 脚本文件（可选）
//!     ├── hello-world.lua
//!     └── ...
//! ```

use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::error::{AppError, Result};
use crate::state::AppState;

/// 导入导出范围项
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportScope {
    /// 快捷指令（flows + actions + triggers）
    Flows,
    /// 课表（semesters + class_periods + weekly_templates + courses + schedule_overrides）
    Courses,
    /// 设置（settings 表，排除敏感项）
    Settings,
    /// Lua 脚本（本地 .lua 文件 + lua_scripts 表记录）
    Scripts,
    /// 全部
    All,
}

/// 导出元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMeta {
    /// 导出文件格式版本
    pub format_version: &'static str,
    /// 应用版本
    pub app_version: String,
    /// 导出时间（ISO 8601）
    pub exported_at: String,
    /// 导出范围（小写字符串列表）
    pub scope: Vec<String>,
}

/// 导出数据容器
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExportData {
    /// 快捷指令
    pub flows: Vec<FlowRow>,
    /// 动作
    pub actions: Vec<ActionRow>,
    /// 触发器
    pub triggers: Vec<TriggerRow>,
    /// 学期
    pub semesters: Vec<SemesterRow>,
    /// 节次定义
    pub class_periods: Vec<ClassPeriodRow>,
    /// 周课表模板
    pub weekly_templates: Vec<WeeklyTemplateRow>,
    /// 课程
    pub courses: Vec<CourseRow>,
    /// 临时调课
    pub schedule_overrides: Vec<OverrideRow>,
    /// 设置
    pub settings: Vec<SettingRow>,
    /// 已安装 Lua 脚本元数据
    pub lua_scripts: Vec<LuaScriptRow>,
}

// 简单行结构：所有字段以 String 形式存储，避免类型转换复杂度
macro_rules! row_struct {
    ($name:ident { $($field:ident),+ $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize)]
        pub struct $name {
            $(pub $field: String,)+
        }
    };
}

row_struct!(FlowRow { id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at });
row_struct!(ActionRow { id, flow_id, action_type, params, order_index, parent_id, fault_strategy, note, position_x, position_y });
row_struct!(TriggerRow { id, flow_id, trigger_type, params, enabled });
row_struct!(SemesterRow { id, name, start_date, end_date, week_count, is_active, created_at, updated_at });
row_struct!(ClassPeriodRow { id, semester_id, period_index, start_time, end_time, name });
row_struct!(WeeklyTemplateRow { id, semester_id, name, description, color, created_at, updated_at });
row_struct!(CourseRow { id, semester_id, template_id, subject, day_of_week, period_index, start_time, end_time, week_pattern, room, teacher, color, flow_id, note, created_at, updated_at });
row_struct!(OverrideRow { id, semester_id, date, type_field, course_id, target_period_index, target_start_time, target_end_time, note, created_at });
row_struct!(SettingRow { key, value, value_type });
row_struct!(LuaScriptRow { script_id, name, author, version, description, permissions, params_schema, installed_at, updated_at, source_url, content_hash });

/// 导出结果摘要
#[derive(Debug, Clone, Serialize)]
pub struct ExportResult {
    /// 导出文件路径
    pub file_path: String,
    /// 文件大小（字节）
    pub file_size: u64,
    /// 导出范围
    pub scope: Vec<String>,
    /// 各表导出条数
    pub counts: ExportCounts,
}

/// 各表导出条数
#[derive(Debug, Clone, Serialize, Default)]
pub struct ExportCounts {
    pub flows: usize,
    pub actions: usize,
    pub triggers: usize,
    pub semesters: usize,
    pub class_periods: usize,
    pub weekly_templates: usize,
    pub courses: usize,
    pub schedule_overrides: usize,
    pub settings: usize,
    pub lua_scripts: usize,
}

/// 导入模式
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ImportMode {
    /// 合并：保留现有数据，新数据 INSERT OR REPLACE
    Merge,
    /// 替换：先清空范围内现有数据，再导入
    Replace,
}

/// 导入结果摘要
#[derive(Debug, Clone, Serialize, Default)]
pub struct ImportResult {
    pub flows: usize,
    pub actions: usize,
    pub triggers: usize,
    pub semesters: usize,
    pub class_periods: usize,
    pub weekly_templates: usize,
    pub courses: usize,
    pub schedule_overrides: usize,
    pub settings: usize,
    pub lua_scripts: usize,
    /// 导入的 Lua 脚本文件数
    pub script_files: usize,
}

// ============ Tauri 命令 ============

/// 导出数据到 .exero 文件
///
/// - `file_path`: 用户通过 dialog 选择的保存路径
/// - `scope`: 导出范围（小写字符串列表）
#[tauri::command]
pub async fn export_data(
    state: State<'_, Arc<AppState>>,
    file_path: String,
    scope: Vec<String>,
) -> Result<ExportResult> {
    let scope = parse_scope(&scope)?;
    let data = collect_export_data(&state, &scope).await?;
    let counts = count_export_data(&data);
    let lua_files = if scope.contains(&ExportScope::Scripts) || scope.contains(&ExportScope::All) {
        collect_lua_script_files()?
    } else {
        Vec::new()
    };

    let meta = ExportMeta {
        format_version: "1",
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        scope: scope.iter().map(|s| scope_to_str(s).to_string()).collect(),
    };

    // 写入 zip
    let file = std::fs::File::create(&file_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // meta.json
    zip.start_file("meta.json", options)?;
    zip.write_all(&serde_json::to_vec_pretty(&meta)?)?;

    // data.json
    zip.start_file("data.json", options)?;
    zip.write_all(&serde_json::to_vec_pretty(&data)?)?;

    // scripts/*.lua
    for (name, content) in &lua_files {
        let path = format!("scripts/{}", name);
        zip.start_file(&path, options)?;
        zip.write_all(content.as_bytes())?;
    }

    zip.finish()?;

    let file_size = std::fs::metadata(&file_path)?.len();

    tracing::info!(
        "导出完成: {} ({} 字节, 范围={:?})",
        file_path,
        file_size,
        meta.scope
    );

    Ok(ExportResult {
        file_path,
        file_size,
        scope: meta.scope,
        counts,
    })
}

/// 从 .exero 文件导入数据
///
/// - `file_path`: 用户通过 dialog 选择的 .exero 文件路径
/// - `scope`: 导入范围（小写字符串列表）
/// - `mode`: 导入模式（merge / replace）
#[tauri::command]
pub async fn import_data(
    state: State<'_, Arc<AppState>>,
    file_path: String,
    scope: Vec<String>,
    mode: ImportMode,
) -> Result<ImportResult> {
    let scope = parse_scope(&scope)?;
    let file = std::fs::File::open(&file_path)?;
    let mut archive = ZipArchive::new(file)?;

    // 读取 meta.json（可选，仅用于校验）
    let mut result = ImportResult::default();

    // 读取 data.json
    let data: ExportData = if let Ok(mut entry) = archive.by_name("data.json") {
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)?;
        serde_json::from_slice(&buf)?
    } else {
        return Err(AppError::InvalidArgument(
            "导入文件缺少 data.json".to_string(),
        ));
    };

    // 事务性写入数据库
    state.db.with_transaction(|tx| {
        if scope.contains(&ExportScope::Flows) || scope.contains(&ExportScope::All) {
            if mode == ImportMode::Replace {
                clear_flows_tables(tx)?;
            }
            import_flows_tables(tx, &data, &mut result)?;
        }

        if scope.contains(&ExportScope::Courses) || scope.contains(&ExportScope::All) {
            if mode == ImportMode::Replace {
                clear_courses_tables(tx)?;
            }
            import_courses_tables(tx, &data, &mut result)?;
        }

        if scope.contains(&ExportScope::Settings) || scope.contains(&ExportScope::All) {
            import_settings(tx, &data, &mut result)?;
        }

        if scope.contains(&ExportScope::Scripts) || scope.contains(&ExportScope::All) {
            import_lua_scripts_db(tx, &data, &mut result)?;
        }
        Ok(())
    })?;

    // 导入 Lua 脚本文件（事务外，文件系统操作）
    if scope.contains(&ExportScope::Scripts) || scope.contains(&ExportScope::All) {
        result.script_files = extract_lua_scripts(&mut archive)?;
    }

    tracing::info!("导入完成: {} (模式={:?})", file_path, mode);
    Ok(result)
}

// ============ 导出辅助函数 ============

/// 解析 scope 字符串列表
fn parse_scope(scope: &[String]) -> Result<Vec<ExportScope>> {
    if scope.is_empty() {
        return Err(AppError::InvalidArgument(
            "导出范围不能为空".to_string(),
        ));
    }
    scope
        .iter()
        .map(|s| match s.to_lowercase().as_str() {
            "flows" => Ok(ExportScope::Flows),
            "courses" => Ok(ExportScope::Courses),
            "settings" => Ok(ExportScope::Settings),
            "scripts" => Ok(ExportScope::Scripts),
            "all" => Ok(ExportScope::All),
            other => Err(AppError::InvalidArgument(format!(
                "未知导出范围: {}",
                other
            ))),
        })
        .collect()
}

fn scope_to_str(s: &ExportScope) -> &'static str {
    match s {
        ExportScope::Flows => "flows",
        ExportScope::Courses => "courses",
        ExportScope::Settings => "settings",
        ExportScope::Scripts => "scripts",
        ExportScope::All => "all",
    }
}

/// 从数据库收集导出数据
async fn collect_export_data(
    state: &State<'_, Arc<AppState>>,
    scope: &[ExportScope],
) -> Result<ExportData> {
    let include_flows = scope.contains(&ExportScope::Flows) || scope.contains(&ExportScope::All);
    let include_courses =
        scope.contains(&ExportScope::Courses) || scope.contains(&ExportScope::All);
    let include_settings =
        scope.contains(&ExportScope::Settings) || scope.contains(&ExportScope::All);
    let include_scripts =
        scope.contains(&ExportScope::Scripts) || scope.contains(&ExportScope::All);

    state.db.with_conn(|conn| {
        let mut data = ExportData::default();

        if include_flows {
            export_flows_tables(conn, &mut data)?;
        }
        if include_courses {
            export_courses_tables(conn, &mut data)?;
        }
        if include_settings {
            export_settings_table(conn, &mut data)?;
        }
        if include_scripts {
            export_lua_scripts_table(conn, &mut data)?;
        }
        Ok(data)
    })
}

/// 导出快捷指令相关表（flows + actions + triggers）
fn export_flows_tables(conn: &rusqlite::Connection, data: &mut ExportData) -> Result<()> {
    // flows
    let mut stmt = conn.prepare(
        "SELECT id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at
         FROM automation_flows ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(FlowRow {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            icon: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            color: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            enabled: row.get::<_, i32>(5)?.to_string(),
            default_fault_strategy: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    for r in rows {
        data.flows.push(r?);
    }

    // actions
    let mut stmt = conn.prepare(
        "SELECT id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note, position_x, position_y
         FROM actions ORDER BY flow_id, \"order\" ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ActionRow {
            id: row.get(0)?,
            flow_id: row.get(1)?,
            action_type: row.get(2)?,
            params: row.get(3)?,
            order_index: row.get::<_, i32>(4)?.to_string(),
            parent_id: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            fault_strategy: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            note: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            position_x: row.get::<_, f64>(8)?.to_string(),
            position_y: row.get::<_, f64>(9)?.to_string(),
        })
    })?;
    for r in rows {
        data.actions.push(r?);
    }

    // triggers
    let mut stmt = conn.prepare(
        "SELECT id, flow_id, trigger_type, params, enabled FROM triggers ORDER BY flow_id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TriggerRow {
            id: row.get(0)?,
            flow_id: row.get(1)?,
            trigger_type: row.get(2)?,
            params: row.get(3)?,
            enabled: row.get::<_, i32>(4)?.to_string(),
        })
    })?;
    for r in rows {
        data.triggers.push(r?);
    }
    Ok(())
}

/// 导出课表相关表（5 张）
fn export_courses_tables(conn: &rusqlite::Connection, data: &mut ExportData) -> Result<()> {
    // semesters
    let mut stmt = conn.prepare(
        "SELECT id, name, start_date, end_date, week_count, is_active, created_at, updated_at
         FROM semesters ORDER BY start_date ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SemesterRow {
            id: row.get(0)?,
            name: row.get(1)?,
            start_date: row.get(2)?,
            end_date: row.get(3)?,
            week_count: row.get::<_, i32>(4)?.to_string(),
            is_active: row.get::<_, i32>(5)?.to_string(),
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    for r in rows {
        data.semesters.push(r?);
    }

    // class_periods
    let mut stmt = conn.prepare(
        "SELECT id, semester_id, period_index, start_time, end_time, name FROM class_periods",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ClassPeriodRow {
            id: row.get(0)?,
            semester_id: row.get(1)?,
            period_index: row.get::<_, i32>(2)?.to_string(),
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            name: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
        })
    })?;
    for r in rows {
        data.class_periods.push(r?);
    }

    // weekly_templates
    let mut stmt = conn.prepare(
        "SELECT id, semester_id, name, description, color, created_at, updated_at FROM weekly_templates",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WeeklyTemplateRow {
            id: row.get(0)?,
            semester_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            color: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    for r in rows {
        data.weekly_templates.push(r?);
    }

    // courses
    let mut stmt = conn.prepare(
        "SELECT id, semester_id, template_id, subject, day_of_week, period_index, start_time, end_time,
                week_pattern, room, teacher, color, flow_id, note, created_at, updated_at
         FROM courses",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CourseRow {
            id: row.get(0)?,
            semester_id: row.get(1)?,
            template_id: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            subject: row.get(3)?,
            day_of_week: row.get::<_, i32>(4)?.to_string(),
            period_index: row.get::<_, Option<i32>>(5)?.map(|i| i.to_string()).unwrap_or_default(),
            start_time: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            end_time: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            week_pattern: row.get(8)?,
            room: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
            teacher: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            color: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            flow_id: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
            note: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;
    for r in rows {
        data.courses.push(r?);
    }

    // schedule_overrides
    let mut stmt = conn.prepare(
        "SELECT id, semester_id, date, type, course_id, target_period_index, target_start_time,
                target_end_time, note, created_at
         FROM schedule_overrides",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(OverrideRow {
            id: row.get(0)?,
            semester_id: row.get(1)?,
            date: row.get(2)?,
            type_field: row.get(3)?,
            course_id: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            target_period_index: row.get::<_, Option<i32>>(5)?.map(|i| i.to_string()).unwrap_or_default(),
            target_start_time: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            target_end_time: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            note: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            created_at: row.get(9)?,
        })
    })?;
    for r in rows {
        data.schedule_overrides.push(r?);
    }
    Ok(())
}

/// 导出 settings 表（排除敏感项）
fn export_settings_table(conn: &rusqlite::Connection, data: &mut ExportData) -> Result<()> {
    let mut stmt = conn.prepare("SELECT key, value, value_type FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok(SettingRow {
            key: row.get(0)?,
            value: row.get(1)?,
            value_type: row.get(2)?,
        })
    })?;
    for r in rows {
        let s = r?;
        // 排除敏感/本地状态项
        if !is_sensitive_setting(&s.key) {
            data.settings.push(s);
        }
    }
    Ok(())
}

/// 判断是否敏感设置项（不导出）
fn is_sensitive_setting(key: &str) -> bool {
    matches!(
        key,
        "onboarding_completed" | "demo_mode" | "update.last_check_time" | "update.last_status"
    )
}

/// 导出 lua_scripts 表
fn export_lua_scripts_table(conn: &rusqlite::Connection, data: &mut ExportData) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT script_id, name, author, version, description, permissions, params_schema,
                installed_at, updated_at, source_url, content_hash
         FROM lua_scripts",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(LuaScriptRow {
            script_id: row.get(0)?,
            name: row.get(1)?,
            author: row.get(2)?,
            version: row.get(3)?,
            description: row.get(4)?,
            permissions: row.get(5)?,
            params_schema: row.get(6)?,
            installed_at: row.get(7)?,
            updated_at: row.get(8)?,
            source_url: row.get(9)?,
            content_hash: row.get(10)?,
        })
    })?;
    for r in rows {
        data.lua_scripts.push(r?);
    }
    Ok(())
}

/// 收集本地 Lua 脚本文件（.lua 内容）
fn collect_lua_script_files() -> Result<Vec<(String, String)>> {
    let dir = scripts_dir()?;
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("lua") {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                let content = std::fs::read_to_string(&path)?;
                files.push((name.to_string(), content));
            }
        }
    }
    Ok(files)
}

/// 获取脚本目录
fn scripts_dir() -> Result<PathBuf> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    let dir = exe_dir.join("data").join("scripts");
    Ok(dir)
}

fn count_export_data(data: &ExportData) -> ExportCounts {
    ExportCounts {
        flows: data.flows.len(),
        actions: data.actions.len(),
        triggers: data.triggers.len(),
        semesters: data.semesters.len(),
        class_periods: data.class_periods.len(),
        weekly_templates: data.weekly_templates.len(),
        courses: data.courses.len(),
        schedule_overrides: data.schedule_overrides.len(),
        settings: data.settings.len(),
        lua_scripts: data.lua_scripts.len(),
    }
}

// ============ 导入辅助函数 ============

fn clear_flows_tables(tx: &rusqlite::Transaction<'_>) -> Result<()> {
    tx.execute("DELETE FROM triggers", [])?;
    tx.execute("DELETE FROM actions", [])?;
    tx.execute("DELETE FROM automation_flows", [])?;
    Ok(())
}

fn clear_courses_tables(tx: &rusqlite::Transaction<'_>) -> Result<()> {
    tx.execute("DELETE FROM schedule_overrides", [])?;
    tx.execute("DELETE FROM courses", [])?;
    tx.execute("DELETE FROM class_periods", [])?;
    tx.execute("DELETE FROM weekly_templates", [])?;
    tx.execute("DELETE FROM semesters", [])?;
    Ok(())
}

fn import_flows_tables(
    tx: &rusqlite::Transaction<'_>,
    data: &ExportData,
    result: &mut ImportResult,
) -> Result<()> {
    for f in &data.flows {
        tx.execute(
            "INSERT OR REPLACE INTO automation_flows
             (id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                f.id, f.name, opt_str(&f.description), opt_str(&f.icon),
                opt_str(&f.color), f.enabled.parse::<i32>().unwrap_or(0),
                f.default_fault_strategy, f.created_at, f.updated_at,
            ],
        )?;
        result.flows += 1;
    }

    for a in &data.actions {
        tx.execute(
            "INSERT OR REPLACE INTO actions
             (id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note, position_x, position_y)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                a.id, a.flow_id, a.action_type, a.params,
                a.order_index.parse::<i32>().unwrap_or(0),
                opt_str(&a.parent_id), opt_str(&a.fault_strategy), opt_str(&a.note),
                a.position_x.parse::<f64>().unwrap_or(0.0),
                a.position_y.parse::<f64>().unwrap_or(0.0),
            ],
        )?;
        result.actions += 1;
    }

    for t in &data.triggers {
        tx.execute(
            "INSERT OR REPLACE INTO triggers
             (id, flow_id, trigger_type, params, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                t.id, t.flow_id, t.trigger_type, t.params,
                t.enabled.parse::<i32>().unwrap_or(1),
            ],
        )?;
        result.triggers += 1;
    }
    Ok(())
}

fn import_courses_tables(
    tx: &rusqlite::Transaction<'_>,
    data: &ExportData,
    result: &mut ImportResult,
) -> Result<()> {
    for s in &data.semesters {
        tx.execute(
            "INSERT OR REPLACE INTO semesters
             (id, name, start_date, end_date, week_count, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                s.id, s.name, s.start_date, s.end_date,
                s.week_count.parse::<i32>().unwrap_or(0),
                s.is_active.parse::<i32>().unwrap_or(0),
                s.created_at, s.updated_at,
            ],
        )?;
        result.semesters += 1;
    }

    for p in &data.class_periods {
        tx.execute(
            "INSERT OR REPLACE INTO class_periods
             (id, semester_id, period_index, start_time, end_time, name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                p.id, p.semester_id, p.period_index.parse::<i32>().unwrap_or(0),
                p.start_time, p.end_time, opt_str(&p.name),
            ],
        )?;
        result.class_periods += 1;
    }

    for w in &data.weekly_templates {
        tx.execute(
            "INSERT OR REPLACE INTO weekly_templates
             (id, semester_id, name, description, color, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                w.id, w.semester_id, w.name, opt_str(&w.description),
                opt_str(&w.color), w.created_at, w.updated_at,
            ],
        )?;
        result.weekly_templates += 1;
    }

    for c in &data.courses {
        tx.execute(
            "INSERT OR REPLACE INTO courses
             (id, semester_id, template_id, subject, day_of_week, period_index, start_time, end_time,
              week_pattern, room, teacher, color, flow_id, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            rusqlite::params![
                c.id, c.semester_id, opt_str(&c.template_id), c.subject,
                c.day_of_week.parse::<i32>().unwrap_or(1),
                c.period_index.parse::<i32>().ok(),
                opt_str(&c.start_time), opt_str(&c.end_time),
                c.week_pattern, opt_str(&c.room), opt_str(&c.teacher),
                opt_str(&c.color), opt_str(&c.flow_id), opt_str(&c.note),
                c.created_at, c.updated_at,
            ],
        )?;
        result.courses += 1;
    }

    for o in &data.schedule_overrides {
        tx.execute(
            "INSERT OR REPLACE INTO schedule_overrides
             (id, semester_id, date, type, course_id, target_period_index, target_start_time,
              target_end_time, note, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                o.id, o.semester_id, o.date, o.type_field, opt_str(&o.course_id),
                o.target_period_index.parse::<i32>().ok(),
                opt_str(&o.target_start_time), opt_str(&o.target_end_time),
                opt_str(&o.note), o.created_at,
            ],
        )?;
        result.schedule_overrides += 1;
    }
    Ok(())
}

fn import_settings(
    tx: &rusqlite::Transaction<'_>,
    data: &ExportData,
    result: &mut ImportResult,
) -> Result<()> {
    for s in &data.settings {
        // 跳过敏感项
        if is_sensitive_setting(&s.key) {
            continue;
        }
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value, value_type) VALUES (?1, ?2, ?3)",
            rusqlite::params![s.key, s.value, s.value_type],
        )?;
        result.settings += 1;
    }
    Ok(())
}

fn import_lua_scripts_db(
    tx: &rusqlite::Transaction<'_>,
    data: &ExportData,
    result: &mut ImportResult,
) -> Result<()> {
    for s in &data.lua_scripts {
        tx.execute(
            "INSERT OR REPLACE INTO lua_scripts
             (script_id, name, author, version, description, permissions, params_schema,
              installed_at, updated_at, source_url, content_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                s.script_id, s.name, s.author, s.version, s.description,
                s.permissions, s.params_schema, s.installed_at, s.updated_at,
                s.source_url, s.content_hash,
            ],
        )?;
        result.lua_scripts += 1;
    }
    Ok(())
}

/// 从 zip 中解压 Lua 脚本到本地 scripts 目录
fn extract_lua_scripts(archive: &mut ZipArchive<std::fs::File>) -> Result<usize> {
    let dir = scripts_dir()?;
    std::fs::create_dir_all(&dir)?;

    // 先收集所有 scripts/*.lua 的文件名，避免 ZipFile<'_> 借用逃逸闭包
    let mut names: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name.starts_with("scripts/") && name.ends_with(".lua") {
            names.push(name);
        }
    }

    let mut count = 0;
    for name in names {
        let mut entry = archive.by_name(&name)?;
        // 提取文件名（去掉 scripts/ 前缀）
        let file_name = name.trim_start_matches("scripts/");
        let path = dir.join(file_name);
        let mut file = std::fs::File::create(&path)?;
        std::io::copy(&mut entry, &mut file)?;
        count += 1;
        tracing::debug!("已导入 Lua 脚本: {}", file_name);
    }

    Ok(count)
}

/// 将空字符串转换为 None
fn opt_str(s: &str) -> Option<&str> {
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}
