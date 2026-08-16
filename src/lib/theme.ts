/**
 * 主题工具（Phase 6a · SPEC 3.2）
 *
 * 提供主题模式切换、主题色应用、系统主题监听等纯函数工具。
 * CSS 变量定义见 index.css（--win-* 8 色色板 + data-theme 映射）。
 */

import type { ThemeColor, ThemeMode } from "@/lib/tauri";

/** 8 色主题色板元数据（SPEC 3.2：Win11 色板） */
export interface ThemeColorMeta {
  key: ThemeColor;
  label: string;
  /** 预览用 hex（浅色模式色值，与 --win-* 浅色变量对齐） */
  preview: string;
}

/** 8 色主题色板列表（设置页色板渲染用） */
export const THEME_COLORS: ThemeColorMeta[] = [
  { key: "blue", label: "蓝", preview: "#0078D4" },
  { key: "green", label: "绿", preview: "#107C10" },
  { key: "orange", label: "橙", preview: "#D83B01" },
  { key: "purple", label: "紫", preview: "#5C2D91" },
  { key: "red", label: "红", preview: "#E81123" },
  { key: "cyan", label: "青", preview: "#0099BC" },
  { key: "pink", label: "粉", preview: "#E3008C" },
  { key: "yellow", label: "黄", preview: "#FFB900" },
];

/** 主题模式选项元数据 */
export const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "跟随系统" },
  { key: "light", label: "浅色" },
  { key: "dark", label: "深色" },
];

/**
 * 判断系统当前是否深色模式
 *
 * 通过 matchMedia 查询 prefers-color-scheme。
 * SSR 或不支持时返回 false。
 */
export function prefersDarkMode(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * 监听系统主题变化（mode === "system" 时使用）
 *
 * @returns 取消监听函数
 */
export function watchSystemTheme(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => callback();
  // addEventListener 在现代浏览器支持，旧 Safari 用 addListener
  if (mql.addEventListener) {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  // 兜底：旧 API（Safari < 14）
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

/**
 * 应用主题模式到 DOM
 *
 * 逻辑：
 * - light -> 移除 .dark class
 * - dark -> 添加 .dark class
 * - system -> 根据系统 prefers-color-scheme 决定
 *
 * @param mode 主题模式
 */
export function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement;
  const shouldUseDark = mode === "dark" || (mode === "system" && prefersDarkMode());
  root.classList.toggle("dark", shouldUseDark);
  applyFavicon(shouldUseDark);
}

/**
 * 应用 favicon（根据深浅主题切换）
 *
 * Tauri 窗口内嵌 WebView 通过 <link rel="icon"> 控制标签页/任务栏图标。
 * index.html 已用 media 属性处理系统级切换；本函数处理应用内主动切换。
 *
 * @param isDark 是否深色模式
 */
function applyFavicon(isDark: boolean): void {
  const href = isDark ? "/favicon-dark.ico" : "/favicon-light.ico";
  // 复用现有 link[rel=icon] 节点，避免节点堆积
  const links = document.querySelectorAll<HTMLLinkElement>("link[rel='icon']");
  if (links.length > 0) {
    links.forEach((link) => {
      link.href = href;
      link.removeAttribute("media");
    });
  } else {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/x-icon";
    link.href = href;
    document.head.appendChild(link);
  }
}

/**
 * 应用主题色到 DOM
 *
 * 通过 data-theme 属性触发 index.css 中的 [data-theme="..."] 规则，
 * 覆盖 --primary / --ring / --sidebar-accent 变量。
 *
 * @param color 主题色
 */
export function applyThemeColor(color: ThemeColor): void {
  document.documentElement.dataset.theme = color;
  // 清除自定义色覆盖（切回预设色时生效）
  clearCustomColor();
}

/**
 * 应用自定义主题色到 DOM（Beta9 任务9）
 *
 * 覆盖 --primary / --ring / --sidebar-accent 为用户选定的 hex 色值，
 * 优先级高于 data-theme 预设色。
 *
 * @param hex 自定义 hex 色值（如 "#FF6B35"）
 */
export function applyCustomColor(hex: string): void {
  const root = document.documentElement;
  const hsl = hexToHsl(hex);
  if (!hsl) return;
  root.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  root.style.setProperty("--sidebar-accent", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  // 标记当前为自定义色（清除 data-theme 避免冲突）
  root.dataset.theme = "custom";
}

/** 清除自定义色覆盖（切回预设色时调用） */
function clearCustomColor(): void {
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--sidebar-accent");
}

/** hex 转 HSL（用于 CSS 变量 hsl(h s% l%) 格式） */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let str = m[1];
  if (str.length === 3) str = str.split("").map((c) => c + c).join("");
  const r = parseInt(str.slice(0, 2), 16) / 255;
  const g = parseInt(str.slice(2, 4), 16) / 255;
  const b = parseInt(str.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
    case g: h = ((b - r) / d + 2); break;
    case b: h = ((r - g) / d + 4); break;
  }
  h /= 6;
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * 一次性应用完整主题配置
 */
export function applyTheme(config: {
  mode: ThemeMode;
  color: ThemeColor;
}): void {
  applyThemeColor(config.color);
  applyThemeMode(config.mode);
}

// ============================================================
// 外观扩充（Beta9 · 任务17：密度 / 字体 / 图标风格 / LiquidGlass）
// 持久化走 settings 表（theme.density 等），不进 Rust ThemeConfig
// ============================================================

/** 界面密度（控制页面容器间距：紧凑/标准/舒适） */
export type Density = "compact" | "standard" | "comfortable";
/** 字体族（system = Segoe UI 系统栈；mono = Cascadia/Consolas 等宽栈，Win10 自带 Consolas 兜底） */
export type FontFamily = "system" | "mono";
/** 字号缩放（小/标准/大，作用 html font-size，rem 单位全局跟随） */
export type FontSize = "small" | "standard" | "large";
/** 图标风格（lucide 默认；segoe = 侧边栏切换 Segoe 系统图标字体） */
export type IconStyle = "lucide" | "segoe";

/** 外观选项（Beta9 任务17 外观扩充 + 第三阶段任务2 圆角） */
export interface AppearanceOptions {
  density: Density;
  fontFamily: FontFamily;
  fontSize: FontSize;
  iconStyle: IconStyle;
  /** LiquidGlass 实验性玻璃效果（默认关，仅展示页生效） */
  liquidGlass: boolean;
  /**
   * 窗口圆角（B9 第三阶段任务2，仅 Win10 生效）
   * - Win11：恒视为 true（DWM 物理圆角，Windows 特性），此值被忽略
   * - Win10：与亚克力互斥——开圆角自动关亚克力，开亚克力自动关圆角
   */
  windowRounded: boolean;
}

/** 外观默认值 */
export const DEFAULT_APPEARANCE: AppearanceOptions = {
  density: "standard",
  fontFamily: "system",
  fontSize: "standard",
  iconStyle: "lucide",
  liquidGlass: false,
  windowRounded: true,
};

/** settings 表键名 */
export const APPEARANCE_KEYS = {
  density: "theme.density",
  fontFamily: "theme.font_family",
  fontSize: "theme.font_size",
  iconStyle: "theme.icon_style",
  liquidGlass: "theme.liquid_glass",
  windowRounded: "theme.window_rounded",
} as const;

/** html font-size 映射（rem 基准，Tailwind 间距/字号全局缩放） */
const FONT_SIZE_PX: Record<FontSize, string> = {
  small: "87.5%", // 14px
  standard: "100%", // 16px
  large: "112.5%", // 18px
};

/** 字体族 fallback 链（Win10 兼容：无 Segoe UI Variable 时落到 Segoe UI） */
export const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  system: `"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`,
  mono: `"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", "Microsoft YaHei UI", "Microsoft YaHei", monospace`,
};

/**
 * 应用外观选项到 DOM
 *
 * - density / liquidGlass：根 div data 属性（Layout 绑定，CSS 属性选择器消费）
 * - fontSize：html font-size（rem 全局缩放）
 * - fontFamily：body class（index.css 定义 .font-mono-app 覆盖）
 * - iconStyle：根 div data-icon-style（Sidebar 消费切换渲染）
 */
export function applyAppearance(opts: AppearanceOptions): void {
  const root = document.documentElement;
  const body = document.body;

  // 字号：rem 基准缩放
  root.style.fontSize = FONT_SIZE_PX[opts.fontSize];

  // 字体族：body class 切换
  body.classList.toggle("font-mono-app", opts.fontFamily === "mono");

  // 密度 / 图标风格 / LiquidGlass：根容器 data 属性由 Layout 绑定，
  // 此处同步到 html 上供 CSS 全局选择器兜底（如 print 等）
  root.dataset.density = opts.density;
  root.dataset.iconStyle = opts.iconStyle;
  root.dataset.liquidGlass = opts.liquidGlass ? "true" : "false";
}
