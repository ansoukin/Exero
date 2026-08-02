/**
 * 节点目录定义（Phase 4 可视化编辑器）
 *
 * 镜像后端 `ActionType` 枚举（src-tauri/src/models/common.rs），
 * 定义 20 种动作节点的元数据：类别 / 图标 / 默认参数 / 端口配置 / 参数摘要渲染器。
 *
 * 端口约定：
 * - 普通动作节点：1 输入端口（top）+ 1 输出端口（bottom）
 * - IfElse：1 输入 + 2 输出（then / else）
 * - Loop：1 输入 + 1 输出（body，循环体）
 * - SetVariable：1 输入 + 1 输出
 *
 * 连线存储约定（与 chain.rs 执行引擎对齐）：
 * - 线性链：子节点 parent_id = 父节点 id，按 order 排序
 * - IfElse 分支：子节点 params.branch = "then" | "else"
 * - Loop 循环体：子节点 parent_id = Loop.id（无 branch 字段）
 */

import {
  AppWindow,
  XCircle,
  Globe,
  FileText,
  Volume2,
  Music,
  Keyboard,
  Power,
  RotateCcw,
  Lock,
  Moon,
  LogOut,
  Trash2,
  BatteryCharging,
  Bell,
  MessageSquare,
  GitBranch,
  Repeat,
  Variable,
  Code,
  type LucideIcon,
} from "lucide-react";

import type { ActionTypeKind } from "@/lib/tauri";

// ============================================================
// 类别定义
// ============================================================

export type NodeCategory =
  | "app"
  | "media"
  | "system"
  | "notification"
  | "control"
  | "lua";

export interface CategoryMeta {
  /** 类别标识 */
  id: NodeCategory;
  /** 中文显示名（镜像 ActionCategory::display_name） */
  label: string;
  /** Tailwind 主题色 class（边框/图标） */
  color: string;
}

export const NODE_CATEGORIES: CategoryMeta[] = [
  { id: "app", label: "应用与文件", color: "text-blue-500" },
  { id: "media", label: "媒体与输入", color: "text-purple-500" },
  { id: "system", label: "系统与电源", color: "text-orange-500" },
  { id: "notification", label: "通知", color: "text-green-500" },
  { id: "control", label: "控制流", color: "text-red-500" },
  { id: "lua", label: "Lua 脚本", color: "text-cyan-500" },
];

// ============================================================
// 端口定义
// ============================================================

export interface NodePort {
  /** 端口唯一标识（React Flow handle id） */
  id: string;
  /** 端口位置 */
  position: "top" | "bottom" | "left" | "right";
  /** 端口显示名（用于 IfElse 的 then/else 标签） */
  label?: string;
}

// ============================================================
// 节点元数据
// ============================================================

export interface NodeMeta {
  /** 动作类型 kind 标签 */
  kind: ActionTypeKind;
  /** 中文显示名（镜像 ActionType::display_name） */
  label: string;
  /** 所属类别 */
  category: NodeCategory;
  /** 图标 */
  icon: LucideIcon;
  /** 默认参数（创建节点时初始化） */
  defaultParams: Record<string, unknown>;
  /** 输入端口列表 */
  inputs: NodePort[];
  /** 输出端口列表 */
  outputs: NodePort[];
  /** 参数摘要渲染器：从 params 提取一句话摘要显示在节点卡片上 */
  summarize: (params: Record<string, unknown>) => string;
}

// ============================================================
// 参数摘要工具
// ============================================================

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? String(v) : "");
const bool = (v: unknown) => (typeof v === "boolean" ? v : false);

/** 截断长字符串 */
const truncate = (s: string, max = 28) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

// ============================================================
// 20 种节点元数据
// ============================================================

const singleInput: NodePort[] = [{ id: "in", position: "top" }];
const singleOutput: NodePort[] = [{ id: "out", position: "bottom" }];

export const NODE_REGISTRY: NodeMeta[] = [
  // ===== 应用与文件 =====
  {
    kind: "LaunchProgram",
    label: "启动程序",
    category: "app",
    icon: AppWindow,
    defaultParams: { path: "", args: "", working_dir: "", run_as_admin: false },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.path) || "未设置路径"),
  },
  {
    kind: "KillProcess",
    label: "关闭进程",
    category: "app",
    icon: XCircle,
    defaultParams: { target: "", force: true, timeout_ms: 0 },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.target) || "未设置进程"),
  },
  {
    kind: "OpenUrl",
    label: "打开网页",
    category: "app",
    icon: Globe,
    defaultParams: { url: "", new_window: false },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.url) || "未设置 URL"),
  },
  {
    kind: "OpenFile",
    label: "打开文件",
    category: "app",
    icon: FileText,
    defaultParams: { path: "", open_with: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.path) || "未设置路径"),
  },

  // ===== 媒体与输入 =====
  {
    kind: "SetVolume",
    label: "调节音量",
    category: "media",
    icon: Volume2,
    defaultParams: { volume: null, mute: false },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) =>
      bool(p.mute)
        ? "静音"
        : p.volume !== null && p.volume !== undefined
          ? `音量 ${num(p.volume)}`
          : "未设置",
  },
  {
    kind: "PlaySound",
    label: "播放声音",
    category: "media",
    icon: Music,
    defaultParams: { source: "", volume: null, loop: false },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.source) || "未设置音源"),
  },
  {
    kind: "SimulateKey",
    label: "模拟按键",
    category: "media",
    icon: Keyboard,
    defaultParams: { keys: "", repeat: 1 },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const k = str(p.keys);
      const r = typeof p.repeat === "number" ? p.repeat : 1;
      return k ? (r > 1 ? `${k} ×${r}` : k) : "未设置按键";
    },
  },

  // ===== 系统与电源 =====
  {
    kind: "Shutdown",
    label: "关机",
    category: "system",
    icon: Power,
    defaultParams: { delay_secs: 0, force: false, message: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const d = typeof p.delay_secs === "number" ? p.delay_secs : 0;
      return d > 0 ? `${d}秒后` : "立即";
    },
  },
  {
    kind: "Reboot",
    label: "重启",
    category: "system",
    icon: RotateCcw,
    defaultParams: { delay_secs: 0, force: false, message: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const d = typeof p.delay_secs === "number" ? p.delay_secs : 0;
      return d > 0 ? `${d}秒后` : "立即";
    },
  },
  {
    kind: "LockScreen",
    label: "锁屏",
    category: "system",
    icon: Lock,
    defaultParams: { delay_secs: 0, force: false, message: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: () => "锁定屏幕",
  },
  {
    kind: "Hibernate",
    label: "休眠",
    category: "system",
    icon: Moon,
    defaultParams: { delay_secs: 0, force: false, message: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: () => "进入休眠",
  },
  {
    kind: "Logoff",
    label: "注销",
    category: "system",
    icon: LogOut,
    defaultParams: { delay_secs: 0, force: false, message: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: () => "注销当前用户",
  },
  {
    kind: "CleanTempFiles",
    label: "清理临时文件",
    category: "system",
    icon: Trash2,
    defaultParams: {
      dirs: null,
      pattern: "*.*",
      recursive: false,
      min_age_minutes: 0,
    },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const r = bool(p.recursive) ? "递归" : "当前目录";
      return `${r} · ${str(p.pattern) || "*.*"}`;
    },
  },
  {
    kind: "SwitchPowerPlan",
    label: "切换电源计划",
    category: "system",
    icon: BatteryCharging,
    defaultParams: { plan_guid: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const g = str(p.plan_guid);
      return g ? truncate(g, 20) : "未设置 GUID";
    },
  },

  // ===== 通知 =====
  {
    kind: "ShowToast",
    label: "Toast 通知",
    category: "notification",
    icon: Bell,
    defaultParams: { title: "", body: "", icon: "" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.title) || "未设置标题"),
  },
  {
    kind: "ShowInAppNotification",
    label: "应用内通知",
    category: "notification",
    icon: MessageSquare,
    defaultParams: { title: "", body: "", level: "info" },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.title) || "未设置标题"),
  },

  // ===== 控制流 =====
  {
    kind: "IfElse",
    label: "条件分支",
    category: "control",
    icon: GitBranch,
    defaultParams: { condition: "" },
    inputs: singleInput,
    outputs: [
      { id: "then", position: "bottom", label: "then" },
      { id: "else", position: "bottom", label: "else" },
    ],
    summarize: (p) => truncate(str(p.condition) || "未设置条件"),
  },
  {
    kind: "Loop",
    label: "循环",
    category: "control",
    icon: Repeat,
    defaultParams: { count: null, var_name: "" },
    inputs: singleInput,
    outputs: [{ id: "body", position: "bottom", label: "body" }],
    summarize: (p) => {
      const c = p.count;
      const v = str(p.var_name);
      if (c === null || c === undefined) return v ? `无限 · ${v}` : "无限循环";
      return v ? `${num(c)}次 · ${v}` : `${num(c)}次`;
    },
  },
  {
    kind: "SetVariable",
    label: "变量赋值",
    category: "control",
    icon: Variable,
    defaultParams: { name: "", value: "", global: false },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => {
      const n = str(p.name);
      return n ? `${n} = ${truncate(str(p.value), 16)}` : "未设置变量";
    },
  },

  // ===== Lua 脚本 =====
  {
    kind: "LuaScript",
    label: "Lua 脚本",
    category: "lua",
    icon: Code,
    defaultParams: { script_id: "", args: {}, timeout_secs: null },
    inputs: singleInput,
    outputs: singleOutput,
    summarize: (p) => truncate(str(p.script_id) || "未选择脚本"),
  },
];

// ============================================================
// 查询工具
// ============================================================

const KIND_INDEX: Map<ActionTypeKind, NodeMeta> = new Map(
  NODE_REGISTRY.map((m) => [m.kind, m]),
);

/** 按 kind 查询节点元数据 */
export function getNodeMeta(kind: ActionTypeKind): NodeMeta | undefined {
  return KIND_INDEX.get(kind);
}

/** 按类别筛选节点 */
export function getNodesByCategory(category: NodeCategory): NodeMeta[] {
  return NODE_REGISTRY.filter((m) => m.category === category);
}
