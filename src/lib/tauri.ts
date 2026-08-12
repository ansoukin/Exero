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
  | "LuaScript"
  // 扩展包动作（V0.4.0-Beta5 Phase 2 新增）
  // variant 格式："pack_id:action_id"（如 "my-pack:my_action"）
  | "Extension";

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
  updateLastCheckTime: "update.last_check_time",
  updateLastStatus: "update.last_status",
  automationLuaTimeoutSecs: "automation.lua_timeout_secs",
  automationLogRetention: "automation.log_retention",
  automationConcurrencyMode: "automation.concurrency_mode",
  automationDefaultVolume: "automation.default_volume",
  urlAliases: "url.aliases",
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

/** 动作节点（镜像 Action） */
export interface Action {
  id: string;
  flow_id: string;
  action_type: { kind: ActionTypeKind; variant: unknown | null };
  params: Record<string, unknown>;
  order: number;
  parent_id: string | null;
  fault_strategy: FaultStrategy | null;
  note: string | null;
  /** 画布横坐标（Phase 4 可视化编辑器节点位置） */
  position_x: number;
  /** 画布纵坐标（Phase 4 可视化编辑器节点位置） */
  position_y: number;
}

export const actionCommands = {
  list: (flowId: string) =>
    invoke<Action[]>("list_actions", { flowId }),
  set: (flowId: string, actions: Action[]) =>
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
  /**
   * 清空执行日志
   * @param before 可选 RFC3339 时间字符串，删除该时间点及之后的日志；省略则清空全部
   * @returns 被删除的记录数
   */
  clearLogs: (before?: string) =>
    invoke<number>("clear_logs", { before: before ?? null }),
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

// ============================================================
// 性能优化（镜像 models/performance.rs，snake_case 序列化）
// ============================================================

/** 进程优先级（镜像 ProcessPriority，#[serde(rename_all = "snake_case")]） */
export type ProcessPriority =
  | "high"
  | "above_normal"
  | "normal"
  | "below_normal"
  | "idle";

/** 进程排序维度（镜像 ProcessSortBy） */
export type ProcessSortBy = "cpu" | "memory";

/** CPU 状态 */
export interface CpuStatus {
  name: string;
  overall_usage: number;
  core_usages: number[];
  core_count: number;
}

/** 内存状态 */
export interface MemoryStatus {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

/** 温度读数 */
export interface TemperatureReading {
  component: string;
  temperature: number | null;
  note: string;
}

/** 硬件状态总览 */
export interface HardwareStatus {
  cpu: CpuStatus;
  memory: MemoryStatus;
  temperatures: TemperatureReading[];
}

/** 进程信息 */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_bytes: number;
  priority: ProcessPriority;
  command: string | null;
}

/** 一键优化结果 */
export interface OptimizeResult {
  killed_processes: string[];
  demoted_processes: string[];
  memory_freed_bytes: number;
  errors: string[];
}

export const performanceCommands = {
  /** 获取硬件监控状态（CPU/内存/温度占位） */
  getHardwareStatus: () => invoke<HardwareStatus>("get_hardware_status"),
  /** 获取进程列表（Top N，按指定维度排序） */
  listProcesses: (sortBy?: ProcessSortBy, limit?: number) =>
    invoke<ProcessInfo[]>("list_processes", {
      sortBy: sortBy ?? null,
      limit: limit ?? null,
    }),
  /** 调整进程优先级 */
  setProcessPriority: (pid: number, priority: ProcessPriority) =>
    invoke<void>("set_process_priority", { pid, priority }),
  /** 结束进程 */
  killProcess: (pid: number) => invoke<void>("kill_process", { pid }),
  /** 一键优化（结束黑名单 + 降级高 CPU + 清理内存） */
  oneClickOptimize: () => invoke<OptimizeResult>("one_click_optimize"),
  /** 获取优化黑名单（用户配置 + 默认硬编码） */
  getBlacklist: () => invoke<string[]>("get_optimize_blacklist"),
  /** 设置优化黑名单（覆盖用户配置部分） */
  setBlacklist: (blacklist: string[]) =>
    invoke<void>("set_optimize_blacklist", { blacklist }),
};

/** 优先级中文显示名（镜像 Rust display_name） */
export function priorityLabel(p: ProcessPriority): string {
  switch (p) {
    case "high":
      return "高";
    case "above_normal":
      return "高于正常";
    case "normal":
      return "正常";
    case "below_normal":
      return "低于正常";
    case "idle":
      return "低";
  }
}

/** 全部优先级档位（用于下拉选项） */
export const ALL_PRIORITIES: ProcessPriority[] = [
  "high",
  "above_normal",
  "normal",
  "below_normal",
  "idle",
];

// ============ Lua 脚本市场 ============

/** Lua 脚本参数定义（manifest 中的单个参数，用于动态生成表单） */
export interface ScriptParam {
  /** 参数名（Lua 脚本通过 args.xxx 访问） */
  name: string;
  /** 显示标签 */
  label: string;
  /** 参数类型 */
  type: "string" | "number" | "boolean" | "select";
  /** 默认值 */
  default: unknown;
  /** select 类型的可选项 */
  options: string[];
  /** 是否必填 */
  required: boolean;
}

/** 已安装脚本（数据库记录，字段 snake_case 对齐 Rust Serialize） */
export interface InstalledScript {
  script_id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  permissions: string[];
  params_schema: ScriptParam[];
  installed_at: string;
  updated_at: string;
  source_url: string;
  content_hash: string;
}

export const luaCommands = {
  /** 列出所有已安装脚本 */
  listInstalled: () => invoke<InstalledScript[]>("list_installed_scripts"),
  /** 获取单个已安装脚本详情 */
  getDetail: (scriptId: string) =>
    invoke<InstalledScript | null>("get_script_detail", { scriptId }),
};

// ============================================================
// 主题（Phase 6a · SPEC 3.2）
// ============================================================

/** 主题模式（镜像 ThemeMode，serde rename_all = "lowercase"） */
export type ThemeMode = "light" | "dark" | "system";

/** 主题色（镜像 ThemeColor，serde rename_all = "lowercase"） */
export type ThemeColor =
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "cyan"
  | "pink"
  | "yellow";

/** 主题配置（镜像 ThemeConfig） */
export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
  mica_enabled: boolean;
}

export const themeCommands = {
  /** 读取主题配置（缺失项回退默认 system/blue/false） */
  getConfig: () => invoke<ThemeConfig>("get_theme_config"),
  /** 保存主题配置并立即应用（含 Mica 窗口效果） */
  setConfig: (config: ThemeConfig) =>
    invoke<ThemeConfig>("set_theme_config", { config }),
};

// ============================================================
// 系统集成（Phase 6a · SPEC 4.1）
// ============================================================

export const systemCommands = {
  /** 退出应用 */
  exitApp: () => invoke<void>("exit_app"),
  /** 隐藏主窗口到托盘 */
  hideMainWindow: () => invoke<void>("hide_main_window"),
  /** 重启应用（OOBE 字体安装后重启） */
  restartApp: () => invoke<void>("restart_app"),
};

// ============================================================
// 课表初始化向导（Phase 6a · SPEC 11.2）
// ============================================================

/** 向导状态（首次启动检测用，镜像 OnboardingStatus） */
export interface OnboardingStatus {
  onboarding_completed: boolean;
  has_semesters: boolean;
  demo_mode: boolean;
}

/** 向导学期配置（步骤 1，镜像 OnboardingSemester） */
export interface OnboardingSemester {
  name: string;
  start_date: string;
  end_date: string;
  week_count: number;
  is_active: boolean;
}

/** 向导节次配置（步骤 2，镜像 OnboardingPeriod） */
export interface OnboardingPeriod {
  period_index: number;
  start_time: string;
  end_time: string;
  name: string | null;
}

/** 向导课程配置（步骤 3，镜像 OnboardingCourse） */
export interface OnboardingCourse {
  subject: string;
  day_of_week: number;
  period_index: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  teacher: string | null;
  /** 周次模式 "all"/"odd"/"even"（null 视为 "all"） */
  week_pattern: string | null;
}

/** 完整向导数据（步骤 4 提交，镜像 OnboardingData） */
export interface OnboardingData {
  semester: OnboardingSemester;
  periods: OnboardingPeriod[];
  courses: OnboardingCourse[];
}

export const onboardingCommands = {
  /** 读取向导状态（首次启动检测：onboarding_completed=false 且 has_semesters=false 时触发） */
  getStatus: () => invoke<OnboardingStatus>("get_onboarding_status"),
  /** 完成向导（事务性写入学期+节次+课程+标记完成，任一失败回滚） */
  complete: (data: OnboardingData) =>
    invoke<void>("complete_onboarding", { data }),
  /** 加载演示数据（V004 示例 + 标记 demo_mode=true） */
  loadDemoData: () => invoke<void>("load_demo_data"),
  /** 跳过向导（空课表，仅标记 onboarding_completed=true） */
  skip: () => invoke<void>("skip_onboarding"),
  /** 重置课表数据（清空 5 张表 + 清除标记，前端重新触发向导） */
  resetScheduleData: () => invoke<void>("reset_schedule_data"),
};

// ============================================================
// 更新检查与应用信息（Phase 6b · SPEC 3.5 分区 3 / 第七章）
// ============================================================

/** 技术栈条目 */
export interface TechStackItem {
  category: string;
  name: string;
  version: string;
}

/** 应用基本信息（镜像 AppInfo） */
export interface AppInfo {
  name: string;
  version: string;
  build_date: string;
  repo_url: string;
  license: string;
  tech_stack: TechStackItem[];
}

/** 更新检查结果 */
export interface UpdateStatus {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  published_at: string | null;
  release_url: string | null;
  /** 强制更新（SPEC 7.2 A：Release body 含 `[强制更新]` 标记且 tag 高于当前版本） */
  force_update_required: boolean;
  /** 推荐更新（SPEC 7.2 B：Release body 含 `[推荐更新]` 标记且 tag 高于当前版本） */
  recommend_update: boolean;
  /** 最低版本要求（SPEC 7.2 C：Release body 含 `[最低版本 x.y.z]` 标记时的 x.y.z） */
  minimum_version: string | null;
  /** 当前版本是否低于最低版本要求（触发强制更新行为） */
  minimum_version_required: boolean;
  checked_at: string;
  /** Release 正文（Markdown，供更新弹窗显示 Release Note） */
  release_body: string | null;
  error: string | null;
}

/** 更新历史条目 */
export interface ChangelogEntry {
  version: string;
  published_at: string;
  body: string;
  html_url: string;
}

export const updateCommands = {
  /** 获取应用基本信息（关于页） */
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  /** 检查更新（GitHub Release latest + 三级更新级别标记解析，SPEC 7.2） */
  checkForUpdates: () => invoke<UpdateStatus>("check_for_updates"),
  /** 获取更新历史（GitHub Releases 优先，失败回退本地 CHANGELOG.md） */
  getChangelog: () => invoke<ChangelogEntry[]>("get_changelog"),
  /** 下载并安装更新（SPEC 7.6：下载 x64 .exe -> NSIS /S 静默安装 -> 退出应用） */
  downloadAndInstall: () => invoke<void>("download_and_install_update"),
  /** 恢复更新检查频率（新版本启动时调用，SPEC 7.6 R4） */
  restoreCheckFrequency: () => invoke<void>("restore_check_frequency"),
  /** 准备强制更新（保存原频率 + 改为 startup，SPEC 7.6 R4） */
  prepareForceUpdate: () => invoke<void>("prepare_force_update"),
  /** 清理临时目录中的旧安装包（SPEC 7.6 R3） */
  cleanupOldInstallers: () => invoke<void>("cleanup_old_installers"),
};

// ============================================================
// 导入导出（Phase 6b · SPEC 5.5）
// ============================================================

/** 导入导出范围 */
export type ExportScope = "flows" | "courses" | "settings" | "scripts" | "extensions" | "all";

/** 导入模式 */
export type ImportMode = "merge" | "replace";

/** 导出结果 */
export interface ExportResult {
  file_path: string;
  file_size: number;
  scope: string[];
  counts: {
    flows: number;
    actions: number;
    triggers: number;
    semesters: number;
    class_periods: number;
    weekly_templates: number;
    courses: number;
    schedule_overrides: number;
    settings: number;
    lua_scripts: number;
    extension_packs: number;
  };
}

/** 导入结果 */
export interface ImportResult {
  flows: number;
  actions: number;
  triggers: number;
  semesters: number;
  class_periods: number;
  weekly_templates: number;
  courses: number;
  schedule_overrides: number;
  settings: number;
  lua_scripts: number;
  script_files: number;
  extension_packs: number;
}

export const ioCommands = {
  /** 导出数据到 .exero 文件 */
  exportData: (filePath: string, scope: ExportScope[]) =>
    invoke<ExportResult>("export_data", { filePath, scope }),
  /** 从 .exero 文件导入数据 */
  importData: (filePath: string, scope: ExportScope[], mode: ImportMode) =>
    invoke<ImportResult>("import_data", { filePath, scope, mode }),
};

// ============================================================
// URL 短域名别名（Phase 6b · SPEC 11.3）
// ============================================================

/** URL 别名条目 */
export interface UrlAlias {
  alias: string;
  target: string;
}

export const urlAliasCommands = {
  /** 获取别名列表 */
  list: () => invoke<UrlAlias[]>("get_url_aliases"),
  /** 保存别名列表（自动过滤空项） */
  set: (aliases: UrlAlias[]) =>
    invoke<void>("set_url_aliases", { aliases }),
  /** 重置为默认别名（baidu/google/github/bing） */
  reset: () => invoke<UrlAlias[]>("reset_url_aliases"),
};

// ============================================================
// 扩展包（Beta3 · 扩展包架构）
// ============================================================

/** 执行器类型（镜像 ExecutorType） */
export type ExecutorType = "rust" | "lua";

/** 端口位置（镜像 PortPosition） */
export type PortPosition = "top" | "bottom" | "left" | "right";

/** 端口声明（镜像 PortManifest） */
export interface PortManifest {
  id: string;
  position: PortPosition;
  label?: string | null;
}

/** 端口配置（镜像 PortsManifest） */
export interface PortsManifest {
  inputs: PortManifest[];
  outputs: PortManifest[];
}

/** 动作 manifest 声明（镜像 ActionManifest） */
export interface ActionManifest {
  id: string;
  executor_type: ExecutorType;
  executor_id: string;
  label: string;
  category: string;
  icon: string;
  default_params: Record<string, unknown>;
  ports: PortsManifest;
  summarize_template: string;
  /** 动作描述（Lua 动作注册到数据库时使用） */
  description?: string;
  /** Lua 沙箱权限声明（仅 executor_type = "Lua" 时有意义） */
  permissions?: string[];
  /** Lua 脚本参数定义（仅 executor_type = "Lua" 时有意义） */
  params?: ScriptParam[];
}

/** 页面类型（镜像 PageType） */
export type PageType = "detail" | "declarative" | "web";

/** 侧边栏入口声明（镜像 SidebarManifest） */
export interface SidebarManifest {
  id: string;
  label: string;
  icon: string;
  page_type: PageType;
}

/** 插件 UI 声明（镜像 UiManifest，Phase 3 新增） */
export interface UiManifest {
  /** 前端入口文件相对路径（如 "index.html"） */
  entry: string;
}

/** 扩展包 manifest（镜像 ExtensionPackManifest） */
export interface ExtensionPackManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  exero_api_version: string;
  /** 扩展包类型：action（动作包）或 plugin（插件） */
  pack_type: string;
  /** Rust 动态库文件相对路径（可选，插件必填） */
  rust_library?: string | null;
  actions: ActionManifest[];
  sidebar?: SidebarManifest | null;
  /** 插件 UI 声明（仅 plugin 类型，Phase 3 新增） */
  ui?: UiManifest | null;
  /** 是否隐藏插件 iframe 上方的标题栏（默认 false） */
  hide_header?: boolean;
}

/** 已安装扩展包摘要 */
export interface PackSummary {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  exero_api_version: string;
  /** 扩展包类型：action */
  pack_type: string;
  action_count: number;
  has_sidebar: boolean;
  /** 来源目录类型：builtin / user / custom */
  source: string;
}

/** 扩展包详情 */
export interface PackDetail {
  summary: PackSummary;
  manifest: ExtensionPackManifest;
  pack_dir: string;
}

/** 侧边栏入口（含所属扩展包 id） */
export interface SidebarEntry {
  pack_id: string;
  sidebar: SidebarManifest;
}

/** 扩展包目录信息 */
export interface PackDirsInfo {
  /** 只读目录（base-pack 所在） */
  builtin_dir: string;
  /** 可写目录（用户扩展包） */
  user_dir: string;
}

export const extensionPackCommands = {
  /** 获取完整动作目录（所有扩展包动作合集） */
  listActionCatalog: () =>
    invoke<ActionManifest[]>("list_action_catalog"),
  /** 获取已安装扩展包列表 */
  listInstalledPacks: () =>
    invoke<PackSummary[]>("list_installed_packs"),
  /** 获取指定扩展包详情 */
  getPackDetail: (packId: string) =>
    invoke<PackDetail | null>("get_pack_detail", { packId }),
  /** 获取扩展包注册的侧边栏入口 */
  getSidebarEntries: () =>
    invoke<SidebarEntry[]>("get_sidebar_entries"),
  /** 重新扫描扩展包目录（安装/卸载/改自定义目录后调用） */
  reloadPacks: () => invoke<number>("reload_packs"),
  /** 获取用户自定义扩展包目录（未设置返回空字符串） */
  getUserDir: () => invoke<string>("get_extension_pack_user_dir"),
  /** 设置用户自定义扩展包目录（空字符串表示清除） */
  setUserDir: (dir: string) =>
    invoke<void>("set_extension_pack_user_dir", { dir }),
  /** 获取默认扩展包目录信息（只读 + 可写路径） */
  getPackDirsInfo: () => invoke<PackDirsInfo>("get_pack_dirs_info"),
  /** 从 .exero-pack 文件安装扩展包（zip 格式，覆盖同名） */
  installPackFromFile: (filePath: string) =>
    invoke<PackSummary>("install_pack_from_file", { filePath }),
  /** 卸载扩展包（所有来源可卸载，base-pack 已改为在线安装） */
  uninstallPack: (packId: string) =>
    invoke<void>("uninstall_pack", { packId }),
  /** 在文件管理器中打开扩展包目录（dirType: "user" / "builtin"） */
  openPacksDir: (dirType: "user" | "builtin") =>
    invoke<void>("open_packs_dir", { dirType }),
  /** 执行插件动作（Phase 3 · 供 iframe 桥接 API 调用） */
  executePluginAction: (
    packId: string,
    actionId: string,
    params: Record<string, unknown>,
  ) =>
    invoke<unknown>("execute_plugin_action", { packId, actionId, params }),
};

// ============================================================
// 扩展包在线市场（Beta3 阶段 c · GitHub 在线安装）
// ============================================================

/** 在线市场扩展包摘要 */
export interface MarketPack {
  /** 扩展包 id */
  id: string;
  /** 显示名 */
  name: string;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string | null;
  /** 作者 */
  author: string | null;
  /** exero_api_version */
  exero_api_version: string;
  /** 扩展包类型：action */
  pack_type: string;
  /** 动作数量 */
  action_count: number;
  /** 是否注册侧边栏入口 */
  has_sidebar: boolean;
  /** 下载 URL（raw.githubusercontent.com，离线模式为空） */
  download_url: string;
  /** 文件名（如 base-pack.exero-pack） */
  file_name: string;
  /** 文件大小（字节） */
  size: number;
  /** 是否已安装 */
  installed: boolean;
  /** 已安装版本 */
  installed_version: string | null;
  /** 是否有更新 */
  update_available: boolean;
}

export const extensionPackMarketCommands = {
  /** 列出在线市场可用扩展包（网络失败进入离线模式，仅返回已安装） */
  listMarketPacks: () => invoke<MarketPack[]>("list_market_packs"),
  /** 从 GitHub 下载并安装扩展包 */
  installPackFromGithub: (downloadUrl: string, fileName: string) =>
    invoke<PackSummary>("install_pack_from_github", {
      downloadUrl,
      fileName,
    }),
};
