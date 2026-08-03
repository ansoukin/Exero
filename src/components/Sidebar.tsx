import {
  Home,
  CalendarDays,
  Zap,
  Gauge,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type PageId } from "@/stores/app";

/** 侧边栏导航项定义（SPEC 3.3：5 项导航） */
interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "timeline", label: "时间轴", icon: CalendarDays },
  { id: "quick-actions", label: "快捷指令", icon: Zap },
  { id: "performance", label: "性能优化", icon: Gauge },
  { id: "settings", label: "设置", icon: Settings },
];

/**
 * 侧边栏组件
 *
 * SPEC 3.3：
 * - 顶部 Logo 区：高 48px，纯 Logo + 应用名（可拖拽）
 * - 中部导航项：5 项
 * - 底部：折叠/展开按钮
 * 窗口三按钮在主内容区顶部右上角（Windows 习惯），不在 Sidebar 内。
 *
 * SPEC 3.1：触控目标 ≥ 48px，200ms 动画过渡
 */
export function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setPage = useAppStore((s) => s.setPage);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-[hsl(var(--sidebar))] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* 顶部 Logo 区（纯 Logo + 应用名）
          系统标题栏模式下无需 data-tauri-drag-region */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-b",
          collapsed ? "justify-center px-0" : "px-3"
        )}
      >
        <div className={cn("flex items-center gap-2 font-semibold", collapsed && "mx-auto")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            E
          </div>
          {!collapsed && <span className="text-sm tracking-tight">Exero</span>}
        </div>
      </div>

      {/* 中部导航项 */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex h-12 items-center rounded-md text-sm font-medium transition-colors duration-200",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* 底部折叠/展开按钮 */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("h-12 w-full", collapsed && "px-0")}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span className="ml-2">折叠</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
