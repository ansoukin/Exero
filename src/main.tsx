import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
