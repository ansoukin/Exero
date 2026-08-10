/**
 * 全局错误边界（Beta6）
 *
 * 捕获 React 组件树渲染错误，特别是懒加载 chunk 加载失败
 * （dev 服务器重启、生产环境网络抖动、部署后旧 chunk 404 等），
 * 提供友好的错误提示 + 重试按钮，避免整页白屏。
 *
 * 懒加载失败检测：错误消息包含 "Failed to fetch dynamically imported module" 或
 * "Importing a module script failed" 时，重置 React.lazy 内部缓存后重试。
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 重试回调：父组件可递增 key 强制子树重新挂载 */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/** 判断是否为懒加载 chunk 加载失败 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] 捕获错误:", error, errorInfo);
  }

  /** 重试：重置错误状态，调用父组件 onRetry 递增 key 强制子树重新挂载 */
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  /** 硬重载页面（重试无效时的兜底） */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const isChunkError = error ? isChunkLoadError(error) : false;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold text-foreground">
            页面加载失败
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {isChunkError
              ? "页面资源加载失败，可能是开发服务器重启或网络异常。点击重试重新加载，或刷新页面。"
              : "页面渲染时发生错误，请尝试重试或刷新页面。"}
          </p>
          {error && (import.meta as any).env?.DEV && (
            <details className="mt-2 max-w-md text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                错误详情
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-muted-foreground">
                {error.message}
              </pre>
            </details>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={this.handleRetry}
            variant="default"
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
          <Button
            onClick={this.handleReload}
            variant="outline"
            size="sm"
          >
            刷新页面
          </Button>
        </div>
      </div>
    );
  }
}
