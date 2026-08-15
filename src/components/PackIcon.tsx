/**
 * 扩展包图标组件（Beta9 · 任务15：三源图标支持）
 *
 * manifest 的 sidebar.icon / action.icon 字段支持三种来源：
 * 1. lucide 图标名（如 "Music"）—— 默认，走内置映射表
 * 2. `segoe:XXXX`（十六进制码点，如 "segoe:E8B7"）—— Segoe Fluent Icons（Win11）
 *    / Segoe MDL2 Assets（Win10）系统图标字体，不依赖任何资源文件
 * 3. `img:相对路径`（如 "img:icons/logo.svg"）—— 扩展包目录内图片（SVG/PNG/ICO）
 *    动作图标由后端 get_action_catalog 重写为完整 plugin.localhost URL；
 *    侧边栏入口由前端用 packId 构造 URL
 *
 * 不引入 FontAwesome：lucide + Segoe 已覆盖常见需求，避免增加体积。
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
  Package,
  Boxes,
  Layers,
  Puzzle,
  Wrench,
  Store,
  Home,
  CalendarDays,
  Zap,
  Gauge,
  Settings,
  FolderOpen,
  FileAudio,
  Image,
  FileCode,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** lucide 图标名 → 组件完整映射（动作积木 + 侧边栏入口共用） */
export const PACK_ICON_MAP: Record<string, LucideIcon> = {
  // 动作积木图标（原 actionCatalog ICON_MAP）
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
  // 侧边栏入口图标（原 Sidebar SIDEBAR_ICON_MAP）
  Package,
  Boxes,
  Layers,
  Puzzle,
  Wrench,
  Store,
  Home,
  CalendarDays,
  Zap,
  Gauge,
  Settings,
  // 扩展包动作常用补充
  FolderOpen,
  FileAudio,
  Image,
  FileCode,
};

/** Segoe 系统图标字体 fallback 链：Win11 Fluent → Win10 MDL2 */
const SEGOE_FONT =
  '"Segoe Fluent Icons","Segoe MDL2 Assets"';

/**
 * 解析 segoe:XXXX 码点为字符
 * 非法输入返回 null（调用方 fallback 到默认图标）
 */
function parseSegoeChar(spec: string): string | null {
  const code = spec.slice("segoe:".length).trim();
  if (!/^[0-9a-fA-F]{1,5}$/.test(code)) return null;
  const cp = parseInt(code, 16);
  // 私有区 PUA（E000-F8FF）是 Segoe 图标标准区间，放行；其他区间也可能有效，只挡明显非法值
  if (cp <= 0 || cp > 0x10ffff) return null;
  return String.fromCodePoint(cp);
}

/**
 * 解析图标 spec 为图片 URL（img: 前缀场景）
 * - `http` 开头：后端已重写的完整 plugin.localhost URL，直接用
 * - `img:相对路径`：用 packId 构造 plugin.localhost URL（侧边栏入口场景）
 * 返回 null 表示非图片来源
 */
export function packIconImageUrl(
  spec: string,
  packId?: string,
): string | null {
  if (spec.startsWith("http://") || spec.startsWith("https://")) {
    return spec;
  }
  if (spec.startsWith("img:")) {
    const rel = spec.slice("img:".length).replace(/^\/+/, "");
    if (!rel || !packId) return null;
    return `http://plugin.localhost/${packId}/${rel}`;
  }
  return null;
}

/** PackIcon 组件 props */
export interface PackIconProps {
  /** manifest 中的 icon 字段原文 */
  spec: string;
  /** 扩展包 id（img: 相对路径场景构造 URL 用） */
  packId?: string;
  /** 尺寸（px），对应 lucide 的 size */
  size?: number;
  className?: string;
}

/**
 * 统一图标渲染组件
 *
 * 按 spec 三源协议渲染：segoe 字符 / 图片 / lucide 组件
 * lucide 查不到时 fallback 到 Package（与侧边栏默认一致）
 */
export function PackIcon({ spec, packId, size = 16, className }: PackIconProps) {
  // 来源 2：Segoe 系统图标字体
  if (spec.startsWith("segoe:")) {
    const char = parseSegoeChar(spec);
    if (char) {
      return (
        <span
          aria-hidden
          className={cn("inline-flex items-center justify-center leading-none", className)}
          style={{
            fontFamily: SEGOE_FONT,
            fontSize: `${Math.round(size * 1.1)}px`,
            width: size,
            height: size,
          }}
        >
          {char}
        </span>
      );
    }
  }

  // 来源 3：自定义图片
  const imgUrl = packIconImageUrl(spec, packId);
  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }

  // 来源 1（默认）：lucide 图标名
  const Icon = PACK_ICON_MAP[spec] ?? Package;
  return <Icon size={size} strokeWidth={2} className={className} />;
}

/** NodeIcon 组件 props */
export interface NodeIconProps {
  /** NodeMeta.icon（内置节点为 LucideIcon 组件，扩展包节点可能为 string spec） */
  icon: LucideIcon | string;
  size?: number;
  className?: string;
}

/**
 * 积木节点图标渲染（NodeMeta.icon 统一出口）
 *
 * NodeMeta.icon 类型已放宽为 LucideIcon | string：
 * - LucideIcon：内置 20 种动作 + 触发器，直接渲染
 * - string：扩展包三源 spec，委托 PackIcon
 */
export function NodeIcon({ icon, size = 16, className }: NodeIconProps) {
  if (typeof icon === "string") {
    return <PackIcon spec={icon} size={size} className={className} />;
  }
  const Icon = icon;
  return <Icon size={size} strokeWidth={2} className={className} />;
}
