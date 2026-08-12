/**
 * OOBE（开箱体验）引导系统状态机（Beta6 · SPEC 13.x）
 *
 * 参考 Windows 10/11 OOBE 流程，包裹现有课表初始化向导。
 * 阶段持久化到 settings.onboarding_stage，支持重启后恢复进度。
 *
 * 阶段流转：
 *   首次启动：splash → license → scenario → font → [提示重启]
 *   重启后：  post_restart → quick_settings → personalization → scene_branch
 *             学校：触发课表向导 → tour → market → done
 *             日常：tour → market → done
 *
 * 触发条件（main.tsx bootstrap）：
 *   - onboarding_completed=false 且 onboarding_stage 存在但非 done → 从该 stage 恢复
 *   - onboarding_completed=false 且 onboarding_stage 不存在 → 从 splash 开始
 */

import { create } from "zustand";

import { settingCommands } from "@/lib/tauri";

/** OOBE 阶段标识（持久化到 settings.onboarding_stage） */
export type OobeStage =
  | "splash" // 开屏动画（重启前）
  | "license" // MIT 许可证（重启前）
  | "scenario" // 使用场景选择（重启前）
  | "font" // 字体安装提示（重启前）
  | "post_restart" // 重启后入口：新/老用户分流
  | "quick_settings" // 快速设置
  | "personalization" // 个性化选择
  | "scene_branch" // 场景分流（学校触发课表向导）
  | "tour" // 功能导览
  | "market" // 扩展市场介绍
  | "done"; // 完成

/** 重启前阶段顺序（到达 font 后提示重启） */
const PRE_RESTART_STAGES: OobeStage[] = [
  "splash",
  "license",
  "scenario",
  "font",
];

/** 重启后阶段顺序（post_restart 为入口） */
const POST_RESTART_STAGES: OobeStage[] = [
  "post_restart",
  "quick_settings",
  "personalization",
  "scene_branch",
  "tour",
  "market",
  "done",
];

/** 完整阶段顺序（用于 next() 查找下一阶段，避免重启前/后序列断裂） */
const FULL_STAGE_ORDER: OobeStage[] = [...PRE_RESTART_STAGES, ...POST_RESTART_STAGES];

/** settings 表中存储 OOBE 阶段的键 */
const OOBE_STAGE_KEY = "onboarding_stage";
/** settings 表中存储应用模式的键 */
const APP_MODE_KEY = "app.mode";

/** 应用使用模式 */
export type AppMode = "school" | "daily";

interface OobeState {
  /** OOBE 是否激活（覆盖主界面） */
  isActive: boolean;
  /** 当前阶段 */
  stage: OobeStage;
  /** 使用模式（学校/日常，scenario 阶段确定） */
  appMode: AppMode;

  /** 启动 OOBE：读 settings.onboarding_stage 决定从哪开始，并读取已保存的 app.mode */
  start: (savedStage: OobeStage | null) => void;
  /** 进入下一阶段（自动持久化） */
  next: () => void;
  /** 跳转到指定阶段（自动持久化，返回 Promise 供调用方等待持久化完成） */
  goTo: (stage: OobeStage) => Promise<void>;
  /** 设置使用模式（scenario 阶段调用，持久化到 settings.app.mode） */
  setAppMode: (mode: AppMode) => Promise<void>;
  /** 完成 OOBE：标记 onboarding_completed=true，关闭覆盖层 */
  complete: () => Promise<void>;
}

export const useOobeStore = create<OobeState>((set, get) => ({
  isActive: false,
  stage: "splash",
  appMode: "school",

  start: (savedStage) => {
    // 有保存的阶段 → 从该阶段恢复；否则从 splash 开始
    const stage = savedStage ?? "splash";
    set({ isActive: true, stage });
    // 异步读取已保存的 app.mode（设置页切换模式后重启恢复时使用）
    settingCommands
      .get(APP_MODE_KEY)
      .then((s) => {
        if (s && (s.value === "school" || s.value === "daily")) {
          set({ appMode: s.value as AppMode });
        }
      })
      .catch((e) => console.warn("[oobe] 读取 app.mode 失败:", e));
  },

  next: () => {
    const { stage } = get();
    // 用完整阶段顺序查找，避免重启前/后序列断裂导致 font→post_restart 跳转失败
    const idx = FULL_STAGE_ORDER.indexOf(stage);
    if (idx === -1) return;
    const nextStage = FULL_STAGE_ORDER[idx + 1];
    if (!nextStage) return;
    get().goTo(nextStage);
  },

  goTo: async (stage) => {
    set({ stage });
    // 持久化到 settings（done 不持久化，完成时由 complete 处理）
    if (stage !== "done") {
      try {
        await settingCommands.set({
          key: OOBE_STAGE_KEY,
          value: stage,
          value_type: "string",
        });
      } catch (e) {
        console.warn("[oobe] 持久化阶段失败:", e);
      }
    }
  },

  setAppMode: async (mode) => {
    set({ appMode: mode });
    try {
      await settingCommands.set({
        key: APP_MODE_KEY,
        value: mode,
        value_type: "string",
      });
    } catch (e) {
      console.warn("[oobe] 持久化 app.mode 失败:", e);
    }
  },

  complete: async () => {
    try {
      // 标记完成 + 清除阶段
      await Promise.all([
        settingCommands.set({
          key: "onboarding_completed",
          value: "true",
          value_type: "bool",
        }),
        settingCommands.set({
          key: OOBE_STAGE_KEY,
          value: "done",
          value_type: "string",
        }),
      ]);
    } catch (e) {
      console.warn("[oobe] 标记完成失败:", e);
    }
    set({ isActive: false, stage: "done" });
  },
}));
