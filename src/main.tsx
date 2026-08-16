import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { useThemeStore } from "@/stores/theme";
import { useOnboardingStore } from "@/stores/onboarding";
import { useOobeStore, type OobeStage } from "@/stores/oobe";
import { onboardingCommands, settingCommands } from "@/lib/tauri";
import "./index.css";

// 禁用 Edge WebView2 浏览器默认右键菜单
// 排除输入框/文本域/可编辑区域，保留复制/粘贴/剪切功能
// 不影响应用内自定义右键菜单（React onContextMenu 回调仍会正常触发）
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }
  e.preventDefault();
});

/**
 * 隐藏 boot-splash（淡出 300ms）
 *
 * B9 第三阶段任务1：#boot-splash 已改为纯主题背景色占位（老横幅开屏彻底移除），
 * 给 #boot-splash 添加 .leaving 类触发 CSS 淡出，动画结束后 display:none。
 */
function hideBootSplash() {
  const el = document.getElementById("boot-splash");
  if (!el) return;
  el.classList.add("leaving");
  el.addEventListener(
    "animationend",
    () => {
      el.style.display = "none";
    },
    { once: true },
  );
}

/**
 * 前端 ready 信号（Beta3 · SPEC 3.4 重做）
 *
 * 三条件 AND：
 * 1. React 挂载完成（ReactDOM.createRoot render）
 * 2. 主题初始化完成（useThemeStore.init，从后端加载主题配置并应用 DOM）
 * 3. onboarding 状态检测完成（读 onboarding 状态 + 同步 demoMode + 触发向导）
 *
 * 三步完成后隐藏 boot-splash，显示应用内容。
 */
/** OOBE 有效阶段集合（用于校验持久化的 onboarding_stage） */
const VALID_OOBE_STAGES: OobeStage[] = [
  "splash",
  "license",
  "scenario",
  "font",
  "post_restart",
  "quick_settings",
  "personalization",
  "scene_branch",
  "tour",
  "market",
];

async function bootstrap() {
  try {
    // 并行执行主题初始化 + onboarding 状态检测 + OOBE 阶段读取 + 应用模式读取
    const [, status, stageSetting, appModeSetting] = await Promise.all([
      useThemeStore.getState().init(),
      onboardingCommands.getStatus(),
      settingCommands.get("onboarding_stage"),
      settingCommands.get("app.mode"),
    ]);
    // 同步 demoMode 到 store（SPEC 11.2 演示模式标识）
    useOnboardingStore.getState().setDemoMode(status.demo_mode);

    // 同步应用模式到 oobe store（无论是否启动 OOBE，都需要供 Timeline 等页面读取）
    if (appModeSetting && (appModeSetting.value === "school" || appModeSetting.value === "daily")) {
      useOobeStore.setState({ appMode: appModeSetting.value as "school" | "daily" });
    }

    // OOBE：未完成引导时启动（包裹原课表向导）
    if (!status.onboarding_completed) {
      const savedStage = stageSetting?.value as OobeStage | null;
      const validStage =
        savedStage && VALID_OOBE_STAGES.includes(savedStage) ? savedStage : null;
      useOobeStore.getState().start(validStage);
    }
  } catch (e) {
    console.error("[bootstrap] 初始化失败，强制隐藏 boot-splash:", e);
  } finally {
    // 无论成功失败都隐藏 boot-splash（避免卡在启动画面）
    hideBootSplash();
  }
}

// 单窗口方案：main 窗口渲染主应用（splash 窗口已移除）
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// React 挂载后启动 ready 检测，完成后隐藏 boot-splash
bootstrap();
