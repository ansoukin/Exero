/**
 * 托盘菜单窗口入口（Beta9 · 任务4）
 *
 * 独立的 React 挂载点，加载 TrayMenuPage。
 * 与主窗口 main 隔离，避免加载主应用的全部 JS。
 */

import React from "react";
import ReactDOM from "react-dom/client";

import { TrayMenuPage } from "@/pages/TrayMenuPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TrayMenuPage />
  </React.StrictMode>,
);
