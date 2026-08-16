/**
 * 插件宿主 store（Beta9 · 任务6：插件持久运行）
 *
 * 类似 Chrome 扩展的后台保活机制：
 * - 插件 iframe 提升到 Layout 层级常驻（PluginHostLayer），不随页面切换卸载
 * - 切换到其他页面时 iframe 隐藏（display:none），音频播放/定时器继续运行
 * - 退出插件页面时按用户设置决定是否销毁：
 *   settings 表 `plugin.keep_alive.{pack_id}`（默认 true = 保持运行）
 * - 低内存场景用户可在 设置 → 插件 关闭保活或手动销毁
 */

import { create } from "zustand";

import { extensionPackCommands, settingCommands } from "@/lib/tauri";

/** 存活的插件实例（iframe 元数据，组件据此渲染） */
export interface PluginInstance {
  packId: string;
  /** 插件前端入口（相对路径，如 index.html） */
  entry: string;
  /** 显示名（标题栏用） */
  title: string;
  /** 版本号（标题栏用） */
  version: string;
  /** 是否隐藏宿主标题栏 */
  hideHeader: boolean;
}

/** keep_alive 设置键（settings 表） */
export const keepAliveKey = (packId: string) => `plugin.keep_alive.${packId}`;

/** 明暗偏好设置键（B9 第三阶段任务6） */
export const themePrefKey = (packId: string) => `plugin.theme.${packId}`;

/**
 * 插件明暗偏好：
 * - auto：跟随软件明暗（默认）
 * - light / dark：强制指定（覆盖应用主题）
 */
export type PluginThemePref = "auto" | "light" | "dark";

interface PluginHostState {
  /** 存活的插件（packId → 实例元数据） */
  plugins: Record<string, PluginInstance>;
  /** 当前展示中的插件页（对应侧边栏 pack:{id} 页面，null = 无） */
  activePackId: string | null;
  /** 插件明暗偏好（packId → auto/light/dark，默认 auto） */
  themePrefs: Record<string, PluginThemePref>;
  /** 加载插件 manifest 并注册到宿主（已在宿主中则仅置为活跃） */
  open: (packId: string) => Promise<void>;
  /** 置为当前展示的插件页 */
  setActive: (packId: string | null) => void;
  /** 强制销毁插件（卸载 iframe，停止一切活动） */
  close: (packId: string) => void;
  /** 读取用户 keep_alive 设置（默认 true） */
  shouldKeepAlive: (packId: string) => Promise<boolean>;
  /** 读取明暗偏好并写入 state（PluginFrame 订阅，变化即推送 iframe） */
  loadThemePref: (packId: string) => Promise<void>;
  /** 设置明暗偏好（持久化 settings + 更新 state） */
  setThemePref: (packId: string, pref: PluginThemePref) => Promise<void>;
}

export const usePluginHostStore = create<PluginHostState>((set, get) => ({
  plugins: {},
  activePackId: null,
  themePrefs: {},

  open: async (packId) => {
    // 已存活：仅置为活跃（保活核心路径，不重新加载 iframe）
    if (get().plugins[packId]) {
      set({ activePackId: packId });
      return;
    }
    try {
      const detail = await extensionPackCommands.getPackDetail(packId);
      if (!detail || detail.manifest.pack_type !== "plugin" || !detail.manifest.ui) {
        console.warn("[pluginHost] 插件不存在或缺少 ui 声明:", packId);
        return;
      }
      set((s) => ({
        plugins: {
          ...s.plugins,
          [packId]: {
            packId,
            entry: detail.manifest.ui!.entry,
            title: detail.manifest.name,
            version: detail.manifest.version,
            hideHeader: detail.manifest.hide_header ?? false,
          },
        },
        activePackId: packId,
      }));
      // 注册即加载明暗偏好（iframe 加载完成前就绪，首推不闪错色）
      void get().loadThemePref(packId);
    } catch (e) {
      console.warn("[pluginHost] 加载插件 manifest 失败:", packId, e);
    }
  },

  setActive: (packId) => set({ activePackId: packId }),

  close: (packId) =>
    set((s) => {
      if (!s.plugins[packId]) return s;
      const next = { ...s.plugins };
      delete next[packId];
      return {
        plugins: next,
        activePackId: s.activePackId === packId ? null : s.activePackId,
      };
    }),

  shouldKeepAlive: async (packId) => {
    try {
      const setting = await settingCommands.get(keepAliveKey(packId));
      // 默认 true（保持运行），仅显式 "false" 才销毁
      return setting ? setting.value !== "false" : true;
    } catch {
      return true;
    }
  },

  loadThemePref: async (packId) => {
    // 已有偏好（设置页改过）不覆盖
    if (get().themePrefs[packId]) return;
    try {
      const setting = await settingCommands.get(themePrefKey(packId));
      const value = setting?.value;
      const pref: PluginThemePref =
        value === "light" || value === "dark" ? value : "auto";
      set((s) => ({ themePrefs: { ...s.themePrefs, [packId]: pref } }));
    } catch {
      set((s) => ({ themePrefs: { ...s.themePrefs, [packId]: "auto" } }));
    }
  },

  setThemePref: async (packId, pref) => {
    // 先更新 state（iframe 立即收到新主题推送），再持久化
    set((s) => ({ themePrefs: { ...s.themePrefs, [packId]: pref } }));
    try {
      await settingCommands.set({
        key: themePrefKey(packId),
        value: pref,
        value_type: "string",
      });
    } catch (e) {
      console.warn("[pluginHost] 保存明暗偏好失败:", packId, e);
    }
  },
}));
