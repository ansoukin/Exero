import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Home,
  CalendarDays,
  Zap,
  Store,
  Gauge,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Boxes,
  Layers,
  Puzzle,
  Wrench,
  GripVertical,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useAppStore,
  type PageId,
  type DynamicNavEntry,
  packPageId,
} from "@/stores/app";
import { extensionPackCommands, settingCommands, type Setting } from "@/lib/tauri";

/** 侧边栏图标名称 -> 组件映射（扩展包入口用） */
const SIDEBAR_ICON_MAP: Record<string, LucideIcon> = {
  Package,
  Boxes,
  Layers,
  Puzzle,
  Wrench,
  Store,
  Home,
  CalendarDays,
  Zap,
  Gauge,
  Settings,
};

/** 按名称获取侧边栏图标，找不到用 Package 默认 */
function getSidebarIcon(name: string): LucideIcon {
  return SIDEBAR_ICON_MAP[name] ?? Package;
}

/** 内置导航项定义（SPEC 3.3：6 项导航，Beta3 扩展市场独立） */
interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "timeline", label: "时间轴", icon: CalendarDays },
  { id: "quick-actions", label: "快捷指令", icon: Zap },
  { id: "extensions", label: "扩展市场", icon: Store },
  { id: "performance", label: "性能优化", icon: Gauge },
  { id: "settings", label: "设置", icon: Settings },
];

/** settings 表中存储侧边栏排序的键 */
const SIDEBAR_ORDER_KEY = "extension_pack.sidebar_order";

/** 滚轮切换节流间隔（毫秒） */
const SIDEBAR_WHEEL_THROTTLE_MS = 250;

/**
 * 按 sidebarOrder 对动态入口排序
 *
 * 已在 order 列表中的按 order 顺序排列，未在列表中的追加到末尾（保持原顺序）。
 */
function sortEntriesByOrder(
  entries: DynamicNavEntry[],
  order: string[],
): DynamicNavEntry[] {
  if (order.length === 0) return entries;
  return [...entries].sort((a, b) => {
    const idxA = order.indexOf(a.packId);
    const idxB = order.indexOf(b.packId);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

/**
 * 侧边栏组件
 *
 * SPEC 3.3：
 * - 顶部 Logo 区：高 48px，纯 Logo + 应用名（可拖拽）
 * - 中部导航项：5 项内置 + 扩展包动态入口
 * - 底部：折叠/展开按钮
 *
 * Beta3 扩展包架构：
 * - 启动时从后端拉取扩展包注册的侧边栏入口
 * - 动态入口追加到内置导航项之后，用分隔线区分
 * - 点击动态入口跳转到扩展包详情页（pack:{id}）
 * - 展开模式下支持拖拽排序（仅动态入口之间），持久化到 settings
 */
export function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setPage = useAppStore((s) => s.setPage);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const dynamicNavEntries = useAppStore((s) => s.dynamicNavEntries);
  const setDynamicNavEntries = useAppStore((s) => s.setDynamicNavEntries);
  const sidebarOrder = useAppStore((s) => s.sidebarOrder);
  const setSidebarOrder = useAppStore((s) => s.setSidebarOrder);
  const packVersion = useAppStore((s) => s.packVersion);

  // 拖拽传感器：距离约束 5px，区分点击与拖拽
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // 启动时拉取扩展包侧边栏入口 + 排序
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [entries, orderSetting] = await Promise.all([
          extensionPackCommands.getSidebarEntries(),
          settingCommands.get(SIDEBAR_ORDER_KEY),
        ]);
        if (!mounted) return;

        const navEntries: DynamicNavEntry[] = entries.map((e) => ({
          pageId: packPageId(e.pack_id),
          label: e.sidebar.label,
          iconName: e.sidebar.icon,
          packId: e.pack_id,
        }));
        setDynamicNavEntries(navEntries);

        // 解析已保存的排序
        if (orderSetting) {
          try {
            const order: string[] = JSON.parse(orderSetting.value);
            if (Array.isArray(order)) {
              setSidebarOrder(order);
            }
          } catch {
            // 排序数据损坏，忽略使用默认顺序
          }
        }
      } catch (e) {
        // 拉取失败不影响应用运行，侧边栏仅显示内置导航
        console.warn("[Sidebar] 拉取扩展包入口失败:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setDynamicNavEntries, setSidebarOrder, packVersion]);

  /** 排序后的动态入口 */
  const sortedEntries = useMemo(
    () => sortEntriesByOrder(dynamicNavEntries, sidebarOrder),
    [dynamicNavEntries, sidebarOrder],
  );

  /** 拖拽结束：重新排序并持久化 */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedEntries.findIndex((e) => e.packId === active.id);
      const newIndex = sortedEntries.findIndex((e) => e.packId === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(
        sortedEntries.map((e) => e.packId),
        oldIndex,
        newIndex,
      );
      setSidebarOrder(newOrder);

      // 持久化到 settings
      try {
        const setting: Setting = {
          key: SIDEBAR_ORDER_KEY,
          value: JSON.stringify(newOrder),
          value_type: "json",
        };
        await settingCommands.set(setting);
      } catch (e) {
        console.warn("[Sidebar] 持久化侧边栏排序失败:", e);
      }
    },
    [sortedEntries, setSidebarOrder],
  );

  // ============================================================
  // 竖向无限滚动切换（Beta3 优化 · 类手机无限翻页）
  // - 鼠标悬停导航区 + 垂直滚轮 → 切换上一个/下一个导航项
  // - 无限循环：最后一个 → 第一个，第一个 → 最后一个
  // - 节流 250ms，避免一次滚动跳过多个
  // - 合并内置导航 + 扩展包动态入口为完整可切换列表
  // ============================================================

  const navRef = useRef<HTMLElement>(null);
  const lastWheelTimeRef = useRef(0);

  /** 完整可切换页面列表：内置导航 + 动态入口（顺序与显示一致）
   *  类型为 string[]：内置页 id 是 PageId 联合子集，动态页 id 是 `pack:xxx` 字符串，
   *  store 的 currentPage 也是 string，统一用 string 与 store 一致。 */
  const switchablePages = useMemo<string[]>(() => {
    const builtin = NAV_ITEMS.map((i) => i.id);
    const dynamic = sortedEntries.map((e) => e.pageId);
    return [...builtin, ...dynamic];
  }, [sortedEntries]);

  /** 切换到指定索引的页面（无限循环） */
  const switchToIndex = useCallback(
    (index: number) => {
      const len = switchablePages.length;
      if (len === 0) return;
      // 无限循环取模（支持负数：-1 → len-1）
      const safeIndex = ((index % len) + len) % len;
      setPage(switchablePages[safeIndex]);
    },
    [switchablePages, setPage],
  );

  /** 鼠标滚轮 → 切换页面（无限循环，带节流） */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTimeRef.current < SIDEBAR_WHEEL_THROTTLE_MS) return;
      lastWheelTimeRef.current = now;

      const currentIndex = switchablePages.indexOf(currentPage);
      // deltaY > 0：下滚 → 下一个；deltaY < 0：上滚 → 上一个
      const nextIndex =
        e.deltaY > 0 ? currentIndex + 1 : currentIndex - 1;
      switchToIndex(nextIndex);
    };

    nav.addEventListener("wheel", handleWheel, { passive: false });
    return () => nav.removeEventListener("wheel", handleWheel);
  }, [currentPage, switchablePages, switchToIndex]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-[hsl(var(--sidebar))] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* 顶部 EXERO 标识区（可拖拽窗口 · 与 TitleBar 等高对齐） */}
      <div
        data-tauri-drag-region
        className={cn(
          "flex h-12 shrink-0 items-center border-b",
          collapsed ? "justify-center px-0" : "gap-2 px-4",
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-sm font-bold leading-none">E</span>
        </div>
        {!collapsed && (
          <span className="text-base font-bold tracking-tight">EXERO</span>
        )}
      </div>

      {/* 中部导航项（鼠标悬停滚动滚轮可无限循环切换页面） */}
      <nav
        ref={navRef}
        className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-fluent p-2"
        title="鼠标悬停后滚动滚轮切换页面"
      >
        {/* 内置导航（固定顺序，不可拖拽） */}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "interactive flex h-12 items-center rounded-md text-sm font-medium",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </button>
          );
        })}

        {/* 扩展包动态入口（展开模式下支持拖拽排序） */}
        {sortedEntries.length > 0 && (
          <>
            <div className="my-1 border-t" />
            {collapsed ? (
              // 折叠模式：不渲染拖拽，仅显示图标按钮
              sortedEntries.map((entry) => (
                <SidebarButton
                  key={entry.pageId}
                  entry={entry}
                  active={currentPage === entry.pageId}
                  collapsed
                  onClick={() => setPage(entry.pageId)}
                />
              ))
            ) : (
              // 展开模式：可拖拽排序
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedEntries.map((e) => e.packId)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedEntries.map((entry) => (
                    <SortableSidebarButton
                      key={entry.pageId}
                      entry={entry}
                      active={currentPage === entry.pageId}
                      onClick={() => setPage(entry.pageId)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
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

/** 普通侧边栏按钮（折叠模式 / 内置导航用） */
interface SidebarButtonProps {
  entry: DynamicNavEntry;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function SidebarButton({ entry, active, collapsed, onClick }: SidebarButtonProps) {
  const Icon = getSidebarIcon(entry.iconName);
  return (
    <button
      onClick={onClick}
      title={collapsed ? entry.label : undefined}
      className={cn(
        "interactive flex h-12 items-center rounded-md text-sm font-medium",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-primary/10 text-primary"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="ml-3">{entry.label}</span>}
    </button>
  );
}

/** 可拖拽排序的侧边栏按钮 */
interface SortableSidebarButtonProps {
  entry: DynamicNavEntry;
  active: boolean;
  onClick: () => void;
}

function SortableSidebarButton({
  entry,
  active,
  onClick,
}: SortableSidebarButtonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.packId });

  const Icon = getSidebarIcon(entry.iconName);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={cn(
        "group flex h-12 items-center rounded-md text-sm font-medium transition-shadow",
        isDragging && "shadow-md ring-1 ring-primary/20",
        active
          ? "bg-primary/10 text-primary"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {/* 拖拽手柄（hover 时显示） */}
      <button
        {...attributes}
        {...listeners}
        className="flex h-12 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/0 opacity-0 transition-opacity group-hover:text-muted-foreground/50 group-hover:opacity-100 active:cursor-grabbing"
        title="拖拽排序"
        aria-label="拖拽排序"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* 主按钮（点击切换页面） */}
      <button
        onClick={onClick}
        className="interactive flex h-12 flex-1 items-center pr-3"
        title={entry.label}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="ml-3">{entry.label}</span>
      </button>
    </div>
  );
}
