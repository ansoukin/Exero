import { useState } from "react";

import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Exero 应用根组件
 *
 * Phase 2：主窗口布局 + 5 页面骨架 + 首页 Dashboard
 * 后续 Phase 将在此基础上扩展路由、主题、系统集成等。
 *
 * Beta6：全局 ErrorBoundary 包裹 Layout，
 * 捕获懒加载 chunk 加载失败等渲染错误，提供重试/刷新按钮避免白屏。
 */
export default function App() {
  // retryKey 变化时，ErrorBoundary 内部子树以新 key 重新挂载，
  // 强制 React.lazy 重新尝试加载失败的 chunk。
  const [retryKey, setRetryKey] = useState(0);

  return (
    <ErrorBoundary key={retryKey} onRetry={() => setRetryKey((k) => k + 1)}>
      <Layout />
    </ErrorBoundary>
  );
}
