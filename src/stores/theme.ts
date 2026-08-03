/**
 * 主题状态管理（Phase 6a · SPEC 3.2）
 *
 * Zustand store，负责：
 * - 持有当前主题配置（mode / color / mica_enabled）
 * - 启动时从后端加载并应用到 DOM
 * - 切换主题时同步后端持久化 + DOM 更新
 * - system 模式下监听系统主题变化自动切换
 */

import { create } from "zustand";

import type { ThemeColor, ThemeMode } from "@/lib/tauri";
import { themeCommands, type ThemeConfig } from "@/lib/tauri";
import {
  applyTheme,
  applyThemeMode,
  watchSystemTheme,
} from "@/lib/theme";

interface ThemeState {
  /** 当前主题配置（启动时从后端加载，默认 system/blue/false） */
  config: ThemeConfig;
  /** 是否已从后端加载完成（防止首帧闪烁） */
  loaded: boolean;
  /** 取消系统主题监听函数（system 模式下激活） */
  unwatchSystem: (() => void) | null;

  /** 启动时初始化：从后端加载配置 + 应用到 DOM + 注册系统监听 */
  init: () => Promise<void>;
  /** 设置主题模式（立即应用 + 持久化） */
  setMode: (mode: ThemeMode) => Promise<void>;
  /** 设置主题色（立即应用 + 持久化） */
  setColor: (color: ThemeColor) => Promise<void>;
  /** 设置 Mica 开关（持久化 + 后端应用窗口效果） */
  setMicaEnabled: (enabled: boolean) => Promise<void>;
}

/** 默认主题配置（与后端 ThemeConfig::default() 一致） */
const DEFAULT_CONFIG: ThemeConfig = {
  mode: "system",
  color: "blue",
  mica_enabled: false,
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  unwatchSystem: null,

  init: async () => {
    try {
      const config = await themeCommands.getConfig();
      // 应用主题色 + 模式
      applyTheme(config);
      // system 模式注册系统主题监听
      if (config.mode === "system") {
        const unwatch = watchSystemTheme(() => applyThemeMode("system"));
        set({ config, loaded: true, unwatchSystem: unwatch });
      } else {
        set({ config, loaded: true, unwatchSystem: null });
      }
    } catch (e) {
      console.error("[theme] 加载主题配置失败，使用默认配置:", e);
      applyTheme(DEFAULT_CONFIG);
      set({ config: DEFAULT_CONFIG, loaded: true, unwatchSystem: null });
    }
  },

  setMode: async (mode) => {
    const { config, unwatchSystem } = get();
    // 取消旧监听
    unwatchSystem?.();
    const next: ThemeConfig = { ...config, mode };
    // 应用到 DOM
    applyThemeMode(mode);
    // system 模式重新注册监听
    if (mode === "system") {
      const unwatch = watchSystemTheme(() => applyThemeMode("system"));
      set({ config: next, unwatchSystem: unwatch });
    } else {
      set({ config: next, unwatchSystem: null });
    }
    // 持久化到后端
    try {
      await themeCommands.setConfig(next);
    } catch (e) {
      console.error("[theme] 保存主题模式失败:", e);
    }
  },

  setColor: async (color) => {
    const { config } = get();
    const next: ThemeConfig = { ...config, color };
    applyTheme({ mode: config.mode, color });
    set({ config: next });
    try {
      await themeCommands.setConfig(next);
    } catch (e) {
      console.error("[theme] 保存主题色失败:", e);
    }
  },

  setMicaEnabled: async (mica_enabled) => {
    const { config } = get();
    const next: ThemeConfig = { ...config, mica_enabled };
    set({ config: next });
    try {
      await themeCommands.setConfig(next);
    } catch (e) {
      console.error("[theme] 保存 Mica 开关失败:", e);
    }
  },
}));
