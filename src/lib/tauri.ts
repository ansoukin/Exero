/**
 * Tauri 后端命令封装
 *
 * 对应 src-tauri/src/commands/ 下暴露的所有 invoke 命令。
 * 类型定义镜像 src-tauri/src/models/ 下的 Rust 模型。
 *
 * 注意：
 * - Rust Option<T> 序列化为 T | null
 * - chrono::DateTime<Utc> 序列化为 ISO 8601 字符串
 * - Rust enum 使用 #[serde(tag = "kind", content = "variant")] 内部标签
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================
// 通用类型
// ============================================================

/** 执行状态（镜像 ExecutionStatus） */
export type ExecutionStatus =
  | "Pending"
  | "Running"
  | "Success"
  | "Failed"
  | "Skipped";

/** 容错策略（镜像 FaultStrategy） */
export type FaultStrategy = "Continue" | "Stop" | "Rollback" | "Notify";

/** 动作类型 kind 标签（镜像 ActionType，单元变体序列化为 {kind: "..."}） */
export type ActionTypeKind =
  | "LaunchProgram"
  | "KillProcess"
  | "OpenUrl"
  | "OpenFile"
  | "SetVolume"
  | "PlaySound"
  | "SimulateKey"
  | "Shutdown"
  | "Reboot"
  | "LockScreen"
  | "Hibernate"
  | "Logoff"
  | "CleanTempFiles"
  | "SwitchPowerPlan"
  | "ShowToast"
  | "ShowInAppNotification"
  | "IfElse"
  | "Loop"
  | "SetVariable"
  | "LuaScript";

/** 触发器类型 kind 标签（镜像 TriggerType） */
export type TriggerTypeKind =
  | "Cron"
  | "CourseStart"
  | "SystemBoot"
  | "SystemShutdown"
  | "UserLogin"
  | "UserLockScreen"
  | "UsbPlug"
  | "UsbUnplug"
  | "NetworkChange"
  | "ProcessStart"
  | "ProcessStop"
  | "Manual";

// ============================================================
// 数据模型
// ============================================================

/** 快捷指令（镜像 AutomationFlow） */
export interface AutomationFlow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  default_fault_strategy: FaultStrategy;
  created_at: string;
  updated_at: string;
}

/** 创建快捷指令请求（镜像 CreateFlowRequest） */
export interface CreateFlowRequest {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** 更新快捷指令请求（镜像 UpdateFlowRequest） */
export interface UpdateFlowRequest {
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  enabled?: boolean | null;
  default_fault_strategy?: FaultStrategy | null;
}

/** 触发器（镜像 Trigger） */
export interface Trigger {
  id: string;
  flow_id: string;
  trigger_type: { kind: TriggerTypeKind; variant: unknown | null };
  params: unknown;
  enabled: boolean;
}

/** 执行日志（镜像 ExecutionLog） */
export interface ExecutionLog {
  id: string;
  flow_id: string;
  action_id: string | null;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  context: string | null;
}

/** 日志查询筛选（镜像 LogFilter） */
export interface LogFilter {
  flow_id?: string | null;
  status?: ExecutionStatus | null;
  limit?: number | null;
  offset?: number | null;
}

/** 设置项（镜像 Setting，KV 形式存储在 settings 表） */
export interface Setting {
  /** 键名（如 "theme.mode"、"general.autostart"） */
  key: string;
  /** 值（JSON 编码的字符串，可表示任意类型） */
  value: string;
  /** 类型标识："string" / "number" / "bool" / "json" */
  value_type: string;
}

/** 后端默认设置键名（镜像 setting.rs defaults 模块） */
export const SettingKeys = {
  themeMode: "theme.mode",
  themeColor: "theme.color",
  themeMicaEnabled: "theme.mica_enabled",
  generalAutostart: "general.autostart",
  generalCloseBehavior: "general.close_behavior",
  generalSidebarCollapsed: "general.sidebar_collapsed",
  updateCheckFrequency: "update.check_frequency",
  updateAutoUpdate: "update.auto_update",
  updateChannel: "update.channel",
  automationLuaTimeoutSecs: "automation.lua_timeout_secs",
  automationLogRetention: "automation.log_retention",
  automationConcurrencyMode: "automation.concurrency_mode",
  automationDefaultVolume: "automation.default_volume",
} as const;

// ============================================================
// 命令封装
// ============================================================

// ---- 数据库 ----
export const dbCommands = {
  ping: () => invoke<string>("ping"),
  getDbInfo: () => invoke<Record<string, unknown>>("get_db_info"),
  runMigrations: () => invoke<void>("run_migrations"),
};

// ---- 快捷指令 ----
export const flowCommands = {
  list: () => invoke<AutomationFlow[]>("list_flows"),
  get: (id: string) => invoke<AutomationFlow | null>("get_flow", { id }),
  create: (request: CreateFlowRequest) =>
    invoke<AutomationFlow>("create_flow", { request }),
  update: (id: string, request: UpdateFlowRequest) =>
    invoke<AutomationFlow>("update_flow", { id, request }),
  delete: (id: string) => invoke<void>("delete_flow", { id }),
  enable: (id: string) => invoke<void>("enable_flow", { id }),
  disable: (id: string) => invoke<void>("disable_flow", { id }),
};

// ---- 动作 ----
export const actionCommands = {
  list: (flowId: string) =>
    invoke<unknown[]>("list_actions", { flowId }),
  set: (flowId: string, actions: unknown[]) =>
    invoke<void>("set_actions", { flowId, actions }),
};

// ---- 触发器 ----
export const triggerCommands = {
  list: (flowId: string) =>
    invoke<Trigger[]>("list_triggers", { flowId }),
  set: (flowId: string, triggers: unknown[]) =>
    invoke<void>("set_triggers", { flowId, triggers }),
  enable: (id: string) => invoke<void>("enable_trigger", { id }),
  disable: (id: string) => invoke<void>("disable_trigger", { id }),
};

// ---- 执行与日志 ----
export const executionCommands = {
  executeFlow: (flowId: string) =>
    invoke<ExecutionLog>("execute_flow", { flowId }),
  executeAction: (actionType: unknown, params: unknown) =>
    invoke<unknown>("execute_action", { actionType, params }),
  listLogs: (filter?: LogFilter) =>
    invoke<ExecutionLog[]>("list_logs", { filter: filter ?? null }),
  clearLogs: () => invoke<void>("clear_logs"),
};

// ---- 设置 ----
export const settingCommands = {
  get: (key: string) => invoke<Setting | null>("get_setting", { key }),
  set: (setting: Setting) => invoke<void>("set_setting", { setting }),
  getAll: () => invoke<Setting[]>("get_all_settings"),
};

// ---- 测试 ----
export const testCommands = {
  e2eTest: () => invoke<string>("e2e_test"),
};

// ============================================================
// 学期 / 课表 / 课程（Phase 3）
// ============================================================

/** 学期（镜像 Semester） */
export interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  week_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 创建学期请求（镜像 CreateSemesterRequest） */
export interface CreateSemesterRequest {
  name: string;
  start_date: string;
  end_date: string;
  week_count: number;
}

/** 更新学期请求（镜像 UpdateSemesterRequest） */
export interface UpdateSemesterRequest {
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  week_count?: number | null;
  is_active?: boolean | null;
}

/** 节次定义（镜像 ClassPeriod） */
export interface ClassPeriod {
  id: string;
  semester_id: string;
  period_index: number;
  start_time: string;
  end_time: string;
  name: string | null;
}

/** 节次输入（镜像 ClassPeriodInput，用于批量替换） */
export interface ClassPeriodInput {
  period_index: number;
  start_time: string;
  end_time: string;
  name?: string | null;
}

/** 课程条目（镜像 Course） */
export interface Course {
  id: string;
  semester_id: string;
  template_id: string | null;
  subject: string;
  day_of_week: number;
  period_index: number | null;
  start_time: string | null;
  end_time: string | null;
  week_pattern: string;
  room: string | null;
  teacher: string | null;
  color: string | null;
  flow_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建课程请求（镜像 CreateCourseRequest） */
export interface CreateCourseRequest {
  semester_id: string;
  template_id?: string | null;
  subject: string;
  day_of_week: number;
  period_index?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  week_pattern?: string | null;
  room?: string | null;
  teacher?: string | null;
  color?: string | null;
  flow_id?: string | null;
  note?: string | null;
}

/** 更新课程请求（镜像 UpdateCourseRequest） */
export interface UpdateCourseRequest {
  template_id?: string | null;
  subject?: string | null;
  day_of_week?: number | null;
  period_index?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  week_pattern?: string | null;
  room?: string | null;
  teacher?: string | null;
  color?: string | null;
  flow_id?: string | null;
  note?: string | null;
}

/** 临时调课类型（镜像 OverrideType，rename_all="lowercase"） */
export type OverrideType = "cancel" | "move" | "add";

/** 临时调课记录（镜像 ScheduleOverride） */
export interface ScheduleOverride {
  id: string;
  semester_id: string;
  date: string;
  course_id: string | null;
  type: OverrideType;
  target_period_index: number | null;
  target_start_time: string | null;
  target_end_time: string | null;
  note: string | null;
  created_at: string;
}

/** 创建临时调课请求（镜像 CreateOverrideRequest） */
export interface CreateOverrideRequest {
  semester_id: string;
  date: string;
  course_id?: string | null;
  type: OverrideType;
  target_period_index?: number | null;
  target_start_time?: string | null;
  target_end_time?: string | null;
  note?: string | null;
}

/** 周课表模板（镜像 WeeklyTemplate） */
export interface WeeklyTemplate {
  id: string;
  semester_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建周模板请求（镜像 CreateWeeklyTemplateRequest） */
export interface CreateWeeklyTemplateRequest {
  semester_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

/** 更新周模板请求（镜像 UpdateWeeklyTemplateRequest） */
export interface UpdateWeeklyTemplateRequest {
  name?: string | null;
  description?: string | null;
  color?: string | null;
}

// ---- 学期 ----
export const semesterCommands = {
  list: () => invoke<Semester[]>("list_semesters"),
  get: (id: string) => invoke<Semester | null>("get_semester", { id }),
  getActive: () => invoke<Semester | null>("get_active_semester"),
  create: (request: CreateSemesterRequest) =>
    invoke<Semester>("create_semester", { request }),
  update: (id: string, request: UpdateSemesterRequest) =>
    invoke<Semester>("update_semester", { id, request }),
  delete: (id: string) => invoke<void>("delete_semester", { id }),
};

// ---- 节次定义 ----
export const classPeriodCommands = {
  list: (semesterId: string) =>
    invoke<ClassPeriod[]>("list_class_periods", { semesterId }),
  set: (semesterId: string, periods: ClassPeriodInput[]) =>
    invoke<void>("set_class_periods", { semesterId, periods }),
};

// ---- 周课表模板 ----
export const weeklyTemplateCommands = {
  list: (semesterId: string) =>
    invoke<WeeklyTemplate[]>("list_weekly_templates", { semesterId }),
  create: (request: CreateWeeklyTemplateRequest) =>
    invoke<WeeklyTemplate>("create_weekly_template", { request }),
  update: (id: string, request: UpdateWeeklyTemplateRequest) =>
    invoke<WeeklyTemplate>("update_weekly_template", { id, request }),
  delete: (id: string) => invoke<void>("delete_weekly_template", { id }),
};

// ---- 课程 ----
export const courseCommands = {
  list: (semesterId: string) =>
    invoke<Course[]>("list_courses", { semesterId }),
  get: (id: string) => invoke<Course | null>("get_course", { id }),
  create: (request: CreateCourseRequest) =>
    invoke<Course>("create_course", { request }),
  update: (id: string, request: UpdateCourseRequest) =>
    invoke<Course>("update_course", { id, request }),
  delete: (id: string) => invoke<void>("delete_course", { id }),
};

// ---- 临时调课 ----
export const overrideCommands = {
  list: (semesterId: string) =>
    invoke<ScheduleOverride[]>("list_overrides", { semesterId }),
  listByDate: (semesterId: string, date: string) =>
    invoke<ScheduleOverride[]>("list_overrides_by_date", { semesterId, date }),
  create: (request: CreateOverrideRequest) =>
    invoke<ScheduleOverride>("create_override", { request }),
  delete: (id: string) => invoke<void>("delete_override", { id }),
  deleteByDate: (semesterId: string, date: string) =>
    invoke<void>("delete_overrides_by_date", { semesterId, date }),
};
