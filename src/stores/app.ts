import { create } from "zustand";

/**
 * 应用页面标识
 *
 * 对应 SPEC 3.3 侧边栏导航：
 * 首页 / 时间轴 / 快捷指令 / 扩展市场 / 性能优化 / 设置
 *
 * Beta3：扩展市场从快捷指令 Tab 独立为侧边栏主页面
 */
export type PageId =
  | "home"
  | "timeline"
  | "quick-actions"
  | "extensions"
  | "performance"
  | "settings"
  | "changelog";

/**
 * 动态页面 id 前缀
 *
 * 扩展包注册的侧边栏入口使用 `pack:{pack_id}` 格式，
 * 如 `pack:base-pack`、`pack:my-extension`。
 */
export const PACK_PAGE_PREFIX = "pack:";

/** 构造扩展包详情页 id */
export function packPageId(packId: string): string {
  return `${PACK_PAGE_PREFIX}${packId}`;
}

/** 判断页面 id 是否为扩展包详情页 */
export function isPackPage(page: string): boolean {
  return page.startsWith(PACK_PAGE_PREFIX);
}

/** 从页面 id 提取扩展包 id */
export function extractPackId(page: string): string | null {
  if (!isPackPage(page)) return null;
  return page.slice(PACK_PAGE_PREFIX.length);
}

/**
 * 动态侧边栏入口（扩展包注册）
 */
export interface DynamicNavEntry {
  /** 页面 id（pack:{pack_id}） */
  pageId: string;
  /** 显示名 */
  label: string;
  /** 图标名称（lucide-react 图标名） */
  iconName: string;
  /** 所属扩展包 id */
  packId: string;
}

interface AppState {
  /** 当前激活的页面（内置 PageId 或动态 pack:{id}） */
  currentPage: string;
  /** 侧边栏是否折叠（SPEC 3.3：可折叠） */
  sidebarCollapsed: boolean;
  /** 动态侧边栏入口（扩展包注册，启动时从后端拉取） */
  dynamicNavEntries: DynamicNavEntry[];
  /** 扩展包侧边栏入口排序（pack_id 数组，持久化到 settings extension_pack.sidebar_order） */
  sidebarOrder: string[];
  /** 扩展包变更版本号（安装/卸载后递增，触发 Sidebar 等组件重新拉取） */
  packVersion: number;

  /** 切换页面 */
  setPage: (page: string) => void;
  /** 切换侧边栏折叠状态 */
  toggleSidebar: () => void;
  /** 设置侧边栏折叠状态 */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** 设置动态侧边栏入口（扩展包注册） */
  setDynamicNavEntries: (entries: DynamicNavEntry[]) => void;
  /** 设置侧边栏入口排序（拖拽排序后调用） */
  setSidebarOrder: (order: string[]) => void;
  /** 递增扩展包变更版本号（安装/卸载后调用，触发依赖组件刷新） */
  bumpPackVersion: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "home",
  sidebarCollapsed: true,
  dynamicNavEntries: [],
  sidebarOrder: [],
  packVersion: 0,

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),
  setDynamicNavEntries: (entries) =>
    set({ dynamicNavEntries: entries }),
  setSidebarOrder: (order) => set({ sidebarOrder: order }),
  bumpPackVersion: () =>
    set((state) => ({ packVersion: state.packVersion + 1 })),
}));
