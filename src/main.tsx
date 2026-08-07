import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { useThemeStore } from "@/stores/theme";
import { useOnboardingStore } from "@/stores/onboarding";
import { onboardingCommands } from "@/lib/tauri";
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
 * 隐藏 boot-splash（上滑淡出 300ms）
 *
 * 单窗口方案（Beta3 · SPEC 3.4 重做）：
 * 给 #boot-splash 添加 .leaving 类触发 CSS 动画，动画结束后 display:none。
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
async function bootstrap() {
  try {
    // 并行执行主题初始化 + onboarding 状态检测
    const [, status] = await Promise.all([
      useThemeStore.getState().init(),
      onboardingCommands.getStatus(),
    ]);
    // 同步 demoMode 到 store（SPEC 11.2 演示模式标识）
    useOnboardingStore.getState().setDemoMode(status.demo_mode);
    // 首次启动检测：onboarding_completed=false 且 has_semesters=false 时弹向导
    if (!status.onboarding_completed && !status.has_semesters) {
      useOnboardingStore.getState().open(0);
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
