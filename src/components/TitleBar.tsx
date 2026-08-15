import { useEffect, useState } from "react";
import { Minus, Square, X, Copy, FlaskConical } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/stores/onboarding";

/**
 * 主内容区顶部标题栏（Phase 6a · SPEC 3.3 / 11.2）
 *
 * decorations:false 下提供窗口拖拽 + Windows 三按钮（右上角）。
 * - 高度 48px（与 Sidebar Logo 区等高，视觉对齐）
 * - 按钮触控目标 48×48px（SPEC 3.1：≥ 48px，适配 UHD 触屏，无键盘环境）
 * - 演示模式时左侧显示"演示模式"标识（SPEC 11.2）
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const demoMode = useOnboardingStore((s) => s.demoMode);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    const unlisten = appWindow.onResized(async () => {
      try {
        setMaximized(await appWindow.isMaximized());
      } catch {
        // 忽略查询失败
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-between surface-titlebar select-none"
    >
      {/* 左侧：演示模式标识（SPEC 11.2，仅 demo_mode=true 时显示） */}
      <div data-tauri-drag-region="false" className="flex items-center pl-3">
        {demoMode && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <FlaskConical className="h-3 w-3" />
            演示模式
          </span>
        )}
      </div>

      {/* 右侧：Windows 三按钮（右上角，Windows 习惯） */}
      <div data-tauri-drag-region="false" className="flex items-center">
        <TitleBarButton onClick={handleMinimize} title="最小化">
          <Minus className="h-4 w-4" />
        </TitleBarButton>
        <TitleBarButton onClick={handleToggleMaximize} title={maximized ? "还原" : "最大化"}>
          {maximized ? (
            <Copy className="h-3.5 w-3.5 rotate-90" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </TitleBarButton>
        <TitleBarButton onClick={handleClose} title="关闭" variant="close">
          <X className="h-4 w-4" />
        </TitleBarButton>
      </div>
    </div>
  );
}

/** 标题栏按钮 */
interface TitleBarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: "default" | "close";
}

function TitleBarButton({ children, onClick, title, variant = "default" }: TitleBarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        // SPEC 3.1：触控目标 ≥ 48px（h-12 w-12 = 48×48px）
        "flex h-12 w-12 items-center justify-center transition-colors duration-200",
        variant === "close"
          ? "hover:bg-destructive hover:text-destructive-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}
