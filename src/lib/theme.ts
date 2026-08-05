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
