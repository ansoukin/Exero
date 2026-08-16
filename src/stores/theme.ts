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
import { settingCommands, systemCommands, type Setting } from "@/lib/tauri";

interface ThemeState {
  /** 当前主题配置（启动时从后端加载，默认 system/blue/true） */
  config: ThemeConfig;
  /** 是否已从后端加载完成（防止首帧闪烁） */
  loaded: boolean;
  /** 取消系统主题监听函数（system 模式下激活） */
  unwatchSystem: (() => void) | null;
  /** 自定义主题色（hex 字符串，设置后覆盖预设色，null 表示用预设色） */
  customColor: string | null;
  /** 外观扩充选项（Beta9 任务17：密度/字体/图标风格/LiquidGlass/圆角） */
  appearance: AppearanceOptions;
  /** 平台信息（B9 第三阶段任务2：null = 加载中） */
  isWindows11: boolean | null;

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
  /**
   * Win10 圆角开关（B9 第三阶段任务2，带互斥）
   * 开圆角 → 自动关亚克力；关圆角不主动开亚克力（由亚克力开关独立控制）
   */
  setWindowRounded: (enabled: boolean) => Promise<void>;
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
  isWindows11: null,

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
      // 加载平台信息（B9 第三阶段任务2：Win10 圆角/亚克力互斥判断）
      let isWin11 = false;
      try {
        const platform = await systemCommands.getPlatformInfo();
        isWin11 = platform.is_windows_11;
      } catch {
        // 平台检测失败按 Win10 处理（保守：提供全部开关）
      }
      set({ isWindows11: isWin11 });
      // 加载外观扩充选项（Beta9 任务17 + 第三阶段任务2 圆角）
      try {
        const [density, fontFamily, fontSize, iconStyle, liquidGlass, windowRounded] =
          await Promise.all([
            settingCommands.get(APPEARANCE_KEYS.density),
            settingCommands.get(APPEARANCE_KEYS.fontFamily),
            settingCommands.get(APPEARANCE_KEYS.fontSize),
            settingCommands.get(APPEARANCE_KEYS.iconStyle),
            settingCommands.get(APPEARANCE_KEYS.liquidGlass),
            settingCommands.get(APPEARANCE_KEYS.windowRounded),
          ]);
        const opts: AppearanceOptions = {
          density: (density?.value as AppearanceOptions["density"]) || DEFAULT_APPEARANCE.density,
          fontFamily:
            (fontFamily?.value as AppearanceOptions["fontFamily"]) || DEFAULT_APPEARANCE.fontFamily,
          fontSize: (fontSize?.value as AppearanceOptions["fontSize"]) || DEFAULT_APPEARANCE.fontSize,
          iconStyle:
            (iconStyle?.value as AppearanceOptions["iconStyle"]) || DEFAULT_APPEARANCE.iconStyle,
          liquidGlass: liquidGlass ? liquidGlass.value === "true" : DEFAULT_APPEARANCE.liquidGlass,
          windowRounded: windowRounded
            ? windowRounded.value === "true"
            : DEFAULT_APPEARANCE.windowRounded,
        };
        // Win10 互斥归一（B9 第三阶段任务2）：升级后圆角与亚克力可能同时为开，
        // 按亚克力优先——关圆角并回写持久化，保证 UI 开关与实际状态一致
        if (!isWin11 && opts.windowRounded && config.acrylic_enabled) {
          opts.windowRounded = false;
          try {
            await settingCommands.set({
              key: APPEARANCE_KEYS.windowRounded,
              value: "false",
              value_type: "bool",
            });
          } catch {
            // 归一回写失败不阻塞启动，下次启动会再次归一
          }
        }
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
    const { config, appearance, isWindows11 } = get();
    const next: ThemeConfig = { ...config, acrylic_enabled };
    set({ config: next });
    try {
      await themeCommands.setConfig(next);
    } catch (e) {
      console.error("[theme] 保存 Acrylic 开关失败:", e);
    }
    // Win10 互斥（B9 第三阶段任务2）：开亚克力自动关圆角
    if (acrylic_enabled && isWindows11 === false && appearance.windowRounded) {
      await get().setAppearance({ windowRounded: false });
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
      windowRounded: APPEARANCE_KEYS.windowRounded,
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

  setWindowRounded: async (enabled) => {
    const { config, isWindows11 } = get();
    // Win11 圆角恒开（DWM 物理圆角），开关调用无效
    if (isWindows11 === true) return;
    await get().setAppearance({ windowRounded: enabled });
    // 互斥（B9 第三阶段任务2）：开圆角自动关亚克力
    if (enabled && config.acrylic_enabled) {
      await get().setAcrylicEnabled(false);
    }
  },
}));
