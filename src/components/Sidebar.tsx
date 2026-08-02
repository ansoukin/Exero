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
 * - 顶部 Logo 区：占位 "D" 字母（未来正式版前替换为正式 Logo）
 * - 中部导航项：5 项（首页 / 时间轴 / 快捷指令 / 性能优化 / 设置）
 * - 底部控制区：仅折叠/展开按钮（主题切换在设置页）
 * - 可折叠，参考 1Panel 设计
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
      {/* 顶部 Logo 区 */}
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-0" : "px-6"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 font-semibold",
            collapsed && "gap-0"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            E
          </div>
          {!collapsed && (
            <span className="text-base tracking-tight">Exero</span>
          )}
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
