import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Loader2,
  PackageOpen,
  Store,
  History,
  AppWindow,
  Volume2,
  Power,
  Bell,
  GitBranch,
  Code,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PackIcon } from "@/components/PackIcon";
import {
  NODE_CATEGORIES,
  getCategoryColor,
  type NodeCategory,
  type NodeMeta,
} from "@/lib/nodeCatalog";
import {
  useActionCatalog,
  groupByCategory,
} from "@/lib/actionCatalog";
import { getRecentKinds } from "@/lib/recentNodes";
import { useAppStore } from "@/stores/app";
import { useQuickActionsStore } from "@/stores/quickactions";
import type { NodeKind } from "@/lib/nodeCatalog";

interface NodePaletteProps {
  /** 拖拽开始：携带节点类型到画布 */
  onDragStart: (kind: NodeKind, event: React.DragEvent) => void;
  /** 点击：直接在画布中央创建节点 */
  onClick: (kind: NodeKind) => void;
}

/** 类别图标映射（任务11：类别头彩色色标） */
const CATEGORY_ICONS: Record<NodeCategory, LucideIcon> = {
  app: AppWindow,
  media: Volume2,
  system: Power,
  notification: Bell,
  control: GitBranch,
  lua: Code,
};

/** 折叠状态持久化键（类别 id → true=已折叠） */
const COLLAPSE_KEY = "palette.collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveCollapsed(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
  } catch {
    // 忽略持久化失败
  }
}

/**
 * 节点库（左栏，SPEC 3.5 可视化编辑器三栏布局之一）
 *
 * B9 第三阶段任务11 重做：
 * - 最近使用置顶分组（localStorage，容量 5，高频动作零翻找）
 * - 类别手风琴折叠（Fluent NavView 风：类别头彩色图标 + 计数徽章 + 折叠箭头）
 * - 折叠状态记忆（localStorage）；搜索时自动展开全部
 * - 拖拽 / 点击创建 / 搜索 / 空状态引导（不变）
 */
export function NodePalette({ onDragStart, onClick }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const { catalog, loading } = useActionCatalog();
  const setPage = useAppStore((s) => s.setPage);
  const clearEditing = useQuickActionsStore((s) => s.clearEditing);
  // 折叠状态（默认全展开）
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 最近使用（挂载后读取 + catalog 变化时刷新映射）
  const [recentKinds, setRecentKinds] = useState<string[]>([]);

  useEffect(() => {
    setCollapsed(loadCollapsed());
    setRecentKinds(getRecentKinds());
    // FlowEditor 记录后派发 palette-recent-updated，实时刷新置顶分组
    const refresh = () => setRecentKinds(getRecentKinds());
    window.addEventListener("palette-recent-updated", refresh);
    return () => window.removeEventListener("palette-recent-updated", refresh);
  }, []);

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [category]: !prev[category] };
      saveCollapsed(next);
      return next;
    });
  };

  const filtered = query
    ? catalog.filter((m) =>
        m.label.toLowerCase().includes(query.toLowerCase()),
      )
    : catalog;

  const groups = useMemo(
    () => groupByCategory(filtered),
    [filtered],
  );

  // 全部展开 / 全部收缩（BUG 修复：全收缩时下方大面积空白 → 空状态 + 快捷操作）
  const allCollapsed =
    groups.length > 0 && groups.every(({ category }) => collapsed[category]);

  const setAllCollapsed = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const { category } of groups) next[category] = value;
    setCollapsed(next);
    saveCollapsed(next);
  };

  // 最近使用分组（仅非搜索模式且有记录时展示；映射回 catalog 元数据）
  const recentItems = useMemo(
    () =>
      query
        ? []
        : recentKinds
            .map((kind) => catalog.find((m) => m.kind === kind))
            .filter((m): m is NodeMeta => !!m),
    [query, recentKinds, catalog],
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      {/* 搜索框 */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索节点..."
            className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* 节点列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-xs">加载动作目录...</span>
          </div>
        ) : catalog.length === 0 ? (
          // 空状态：无扩展包，引导用户去扩展市场安装 base-pack
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                无可用动作
              </p>
              <p className="text-xs text-muted-foreground">
                尚未安装任何扩展包，请先安装 base-pack 基础动作包
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                clearEditing();
                setPage("extensions");
              }}
            >
              <Store className="h-3.5 w-3.5" />
              前往扩展市场
            </Button>
          </div>
        ) : query ? (
          // 搜索模式：扁平展示（忽略折叠状态）
          <div className="flex flex-col gap-1 p-2">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                无匹配节点
              </p>
            ) : (
              filtered.map((meta) => (
                <PaletteItem
                  key={meta.kind}
                  meta={meta}
                  onDragStart={onDragStart}
                  onClick={onClick}
                />
              ))
            )}
          </div>
        ) : (
          <>
            {/* 最近使用置顶（任务11） */}
            {recentItems.length > 0 && (
              <div className="border-b">
                <CategoryHeader
                  icon={<History className="h-3.5 w-3.5" />}
                  label="最近使用"
                  iconCls="text-primary"
                  count={recentItems.length}
                />
                <div className="flex flex-col gap-1 px-2 pb-2 pt-0.5">
                  {recentItems.map((meta) => (
                    <PaletteItem
                      key={`recent-${meta.kind}`}
                      meta={meta}
                      onDragStart={onDragStart}
                      onClick={onClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 类别手风琴分组（任务11） */}
            {groups.map(({ category, items }) => {
              const catMeta = NODE_CATEGORIES.find((c) => c.id === category);
              const CatIcon = CATEGORY_ICONS[category];
              const isCollapsed = !!collapsed[category];
              return (
                <div key={category} className="border-b last:border-0">
                  <CategoryHeader
                    icon={<CatIcon className="h-3.5 w-3.5" />}
                    label={catMeta?.label ?? category}
                    iconCls={catMeta?.color ?? ""}
                    count={items.length}
                    collapsed={isCollapsed}
                    onToggle={() => toggleCategory(category)}
                  />
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 px-2 pb-2 pt-0.5">
                          {items.map((meta) => (
                            <PaletteItem
                              key={meta.kind}
                              meta={meta}
                              onDragStart={onDragStart}
                              onClick={onClick}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* 全收缩空状态（BUG 修复：消除下方大面积空白的空洞感） */}
            {allCollapsed && (
              <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
                <ChevronsDownUp className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  已收缩 {groups.length} 个分类
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setAllCollapsed(false)}
                >
                  <ChevronsUpDown className="h-3 w-3" />
                  全部展开
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部快捷操作：全部展开 / 全部收缩 */}
      {catalog.length > 0 && !query && groups.length > 0 && (
        <div className="flex items-center justify-between border-t px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {catalog.length} 个节点
          </span>
          <button
            type="button"
            onClick={() => setAllCollapsed(!allCollapsed)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronsUpDown className="h-3 w-3" />
            {allCollapsed ? "全部展开" : "全部收缩"}
          </button>
        </div>
      )}

      {/* 底部提示 */}
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        {catalog.length > 0 ? "拖拽到画布或点击创建" : "安装扩展包后可用"}
      </div>
    </aside>
  );
}

/** 类别头（任务11：彩色图标 + 名称 + 计数徽章 + 折叠箭头） */
function CategoryHeader({
  icon,
  label,
  iconCls,
  count,
  collapsed,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  iconCls: string;
  count: number;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const clickable = !!onToggle;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!clickable}
      className={cn(
        "flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors",
        clickable && "hover:text-foreground",
      )}
    >
      <span className={cn("flex shrink-0 items-center", iconCls)}>{icon}</span>
      <span className="flex-1 truncate normal-case tracking-normal">
        {label}
      </span>
      {/* 计数徽章 */}
      <span className="rounded-full bg-muted px-1.5 text-[9px] font-medium leading-4 text-muted-foreground">
        {count}
      </span>
      {clickable && (
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
            !collapsed && "rotate-90",
          )}
        />
      )}
    </button>
  );
}

/** 节点库单元 */
function PaletteItem({
  meta,
  onDragStart,
  onClick,
}: {
  meta: NodeMeta;
  onDragStart: (kind: NodeKind, event: React.DragEvent) => void;
  onClick: (kind: NodeKind) => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      draggable
      onDragStart={(e) => onDragStart(meta.kind, e)}
      onClick={() => onClick(meta.kind)}
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-all",
        "hover:border-primary/30 hover:bg-accent hover:pl-2.5",
        "cursor-grab active:cursor-grabbing",
      )}
      title={`添加 ${meta.label} 节点`}
    >
      {typeof Icon === "string" ? (
        // Beta9 任务15：扩展包三源图标 spec（segoe:/图片 URL）
        <PackIcon spec={Icon} size={16} className={cn("shrink-0", getCategoryColor(meta.category))} />
      ) : (
        <Icon className={cn("h-4 w-4 shrink-0", getCategoryColor(meta.category))} />
      )}
      <span className="truncate">{meta.label}</span>
    </button>
  );
}
