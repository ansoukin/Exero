import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import { Splash } from "@/components/Splash";
import { useThemeStore } from "@/stores/theme";
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

// 多窗口路由（Phase 6a · SPEC 3.4）
// splash 窗口渲染 Splash 组件，main 窗口渲染主应用
const windowLabel = getCurrentWindow().label;

if (windowLabel === "splash") {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Splash />
    </React.StrictMode>
  );
} else {
  // main 窗口：启动时初始化主题（SPEC 3.2），避免首帧闪烁
  useThemeStore.getState().init();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
