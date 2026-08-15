/**
 * 主题状态管理（Phase 6a · SPEC 3.2）
 *
 * Zustand store，负责：
 * - 持有当前主题配置（mode / color / acrylic_enabled）
 * - 启动时从后端加载并应用到 DOM
 * - 切换主题时同步后端持久化 + DOM 更新
 * - system 模式下监听系统主题变化自动切换
 */

import { create } from "zustand";

import type { ThemeColor, ThemeMode } from "@/lib/tauri";
import { themeCommands, type ThemeConfig } from "@/lib/tauri";
import {
  applyTheme,
  applyThemeColor,
  applyThemeMode,
  applyCustomColor,
  applyAppearance,
  watchSystemTheme,
  APPEARANCE_KEYS,
  DEFAULT_APPEARANCE,
  type AppearanceOptions,
} from "@/lib/theme";
import { settingCommands, type Setting } from "@/lib/tauri";

interface ThemeState {
  /** 当前主题配置（启动时从后端加载，默认 system/blue/true） */
  config: ThemeConfig;
  /** 是否已从后端加载完成（防止首帧闪烁） */
  loaded: boolean;
  /** 取消系统主题监听函数（system 模式下激活） */
  unwatchSystem: (() => void) | null;
  /** 自定义主题色（hex 字符串，设置后覆盖预设色，null 表示用预设色） */
  customColor: string | null;
  /** 外观扩充选项（Beta9 任务17：密度/字体/图标风格/LiquidGlass） */
  appearance: AppearanceOptions;

  /** 启动时初始化：从后端加载配置 + 应用到 DOM + 注册系统监听 */
  init: () => Promise<void>;
  /** 设置主题模式（立即应用 + 持久化） */
  setMode: (mode: ThemeMode) => Promise<void>;
  /** 设置主题色（立即应用 + 持久化，清除自定义色） */
  setColor: (color: ThemeColor) => Promise<void>;
  /** 设置 Acrylic 开关（持久化 + 后端应用窗口效果） */
  setAcrylicEnabled: (enabled: boolean) => Promise<void>;
  /** 设置自定义主题色（hex，持久化 + 应用到 DOM） */
  setCustomColor: (hex: string) => Promise<void>;
  /** 清除自定义色（切回预设色） */
  clearCustomColor: () => Promise<void>;
  /** 更新外观选项（立即应用 + 逐项持久化，Beta9 任务17） */
  setAppearance: (patch: Partial<AppearanceOptions>) => Promise<void>;
}

/** 默认主题配置（与后端 ThemeConfig::default() 一致） */
const DEFAULT_CONFIG: ThemeConfig = {
  mode: "system",
  color: "blue",
  acrylic_enabled: true,
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  unwatchSystem: null,
  customColor: null,
  appearance: DEFAULT_APPEARANCE,

  init: async () => {
    try {
      const config = await themeCommands.getConfig();
      // 应用主题色 + 模式
      applyTheme(config);
      // 加载自定义色（Beta9 任务9：设置后覆盖预设色）
      try {
        const customSetting = await settingCommands.get("theme.custom_color");
        if (customSetting?.value) {
          applyCustomColor(customSetting.value);
          set({ customColor: customSetting.value });
        }
      } catch {
        // 自定义色读取失败不影响主题加载
      }
      // 加载外观扩充选项（Beta9 任务17：密度/字体/图标风格/LiquidGlass）
      try {
        const [density, fontFamily, fontSize, iconStyle, liquidGlass] =
          await Promise.all([
            settingCommands.get(APPEARANCE_KEYS.density),
            settingCommands.get(APPEARANCE_KEYS.fontFamily),
            settingCommands.get(APPEARANCE_KEYS.fontSize),
            settingCommands.get(APPEARANCE_KEYS.iconStyle),
            settingCommands.get(APPEARANCE_KEYS.liquidGlass),
          ]);
        const opts: AppearanceOptions = {
          density: (density?.value as AppearanceOptions["density"]) || DEFAULT_APPEARANCE.density,
          fontFamily:
            (fontFamily?.value as AppearanceOptions["fontFamily"]) || DEFAULT_APPEARANCE.fontFamily,
          fontSize: (fontSize?.value as AppearanceOptions["fontSize"]) || DEFAULT_APPEARANCE.fontSize,
          iconStyle:
            (iconStyle?.value as AppearanceOptions["iconStyle"]) || DEFAULT_APPEARANCE.iconStyle,
          liquidGlass: liquidGlass ? liquidGlass.value === "true" : DEFAULT_APPEARANCE.liquidGlass,
        };
        applyAppearance(opts);
        set({ appearance: opts });
      } catch {
        // 外观选项读取失败不影响主题加载
      }
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
    const { config, customColor } = get();
    const next: ThemeConfig = { ...config, color };
    // 切回预设色时清除自定义色覆盖
    applyThemeColor(color);
    set({ config: next, customColor: null });
    try {
      await themeCommands.setConfig(next);
      // 清除自定义色持久化
      if (customColor) {
        const clearSetting: Setting = {
          key: "theme.custom_color",
          value: "",
          value_type: "string",
        };
        await settingCommands.set(clearSetting);
      }
    } catch (e) {
      console.error("[theme] 保存主题色失败:", e);
    }
  },

  setAcrylicEnabled: async (acrylic_enabled) => {
    const { config } = get();
    const next: ThemeConfig = { ...config, acrylic_enabled };
    set({ config: next });
    try {
      await themeCommands.setConfig(next);
    } catch (e) {
      console.error("[theme] 保存 Acrylic 开关失败:", e);
    }
  },

  setCustomColor: async (hex) => {
    applyCustomColor(hex);
    set({ customColor: hex });
    try {
      const setting: Setting = {
        key: "theme.custom_color",
        value: hex,
        value_type: "string",
      };
      await settingCommands.set(setting);
    } catch (e) {
      console.error("[theme] 保存自定义色失败:", e);
    }
  },

  clearCustomColor: async () => {
    const { config } = get();
    applyThemeColor(config.color);
    set({ customColor: null });
    try {
      const clearSetting: Setting = {
        key: "theme.custom_color",
        value: "",
        value_type: "string",
      };
      await settingCommands.set(clearSetting);
    } catch (e) {
      console.error("[theme] 清除自定义色失败:", e);
    }
  },

  setAppearance: async (patch) => {
    const next = { ...get().appearance, ...patch };
    applyAppearance(next);
    set({ appearance: next });
    // 逐项持久化（仅写 patch 涉及的键）
    const keyOf: Record<keyof AppearanceOptions, string> = {
      density: APPEARANCE_KEYS.density,
      fontFamily: APPEARANCE_KEYS.fontFamily,
      fontSize: APPEARANCE_KEYS.fontSize,
      iconStyle: APPEARANCE_KEYS.iconStyle,
      liquidGlass: APPEARANCE_KEYS.liquidGlass,
    };
    for (const [field, value] of Object.entries(patch)) {
      const key = keyOf[field as keyof AppearanceOptions];
      const setting: Setting = {
        key,
        value: String(value),
        value_type: "string",
      };
      try {
        await settingCommands.set(setting);
      } catch (e) {
        console.error(`[theme] 保存外观项 ${key} 失败:`, e);
      }
    }
  },
}));
