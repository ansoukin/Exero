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

/** 市场脚本（GitHub 列表项，含安装状态） */
export interface MarketScript {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  permissions: string[];
  params: ScriptParam[];
  /** 是否已安装 */
  installed: boolean;
  /** 已安装版本（若已安装） */
  installed_version: string | null;
  /** 是否有更新 */
  update_available: boolean;
}

export const luaCommands = {
  /** 列出所有已安装脚本 */
  listInstalled: () => invoke<InstalledScript[]>("list_installed_scripts"),
  /** 获取单个已安装脚本详情 */
  getDetail: (scriptId: string) =>
    invoke<InstalledScript | null>("get_script_detail", { scriptId }),
  /** 列出市场可用脚本（网络失败进入离线模式，仅返回已安装） */
  listMarket: () => invoke<MarketScript[]>("list_market_scripts"),
  /** 安装脚本（下载 .lua + .json，写入本地与数据库） */
  install: (scriptId: string) =>
    invoke<InstalledScript>("install_script", { scriptId }),
  /** 卸载脚本（删数据库 + 删本地文件） */
  uninstall: (scriptId: string) =>
    invoke<void>("uninstall_script", { scriptId }),
  /** 更新脚本（重新下载 + 覆盖） */
  update: (scriptId: string) =>
    invoke<InstalledScript>("update_script", { scriptId }),
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
  /** 检查更新（GitHub Release latest + force-update.json） */
  checkForUpdates: () => invoke<UpdateStatus>("check_for_updates"),
  /** 获取更新历史（GitHub Releases 优先，失败回退本地 CHANGELOG.md） */
  getChangelog: () => invoke<ChangelogEntry[]>("get_changelog"),
  /** 获取本地 CHANGELOG.md 路径 */
  getChangelogPath: () => invoke<string>("get_changelog_path"),
};

// ============================================================
// 导入导出（Phase 6b · SPEC 5.5）
// ============================================================

/** 导入导出范围 */
export type ExportScope = "flows" | "courses" | "settings" | "scripts" | "all";

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
