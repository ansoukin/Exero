import { useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NODE_CATEGORIES,
  NODE_REGISTRY,
  getNodesByCategory,
  type NodeMeta,
} from "@/lib/nodeCatalog";
import type { ActionTypeKind } from "@/lib/tauri";

interface NodePaletteProps {
  /** 拖拽开始：携带节点类型到画布 */
  onDragStart: (kind: ActionTypeKind, event: React.DragEvent) => void;
  /** 点击：直接在画布中央创建节点 */
  onClick: (kind: ActionTypeKind) => void;
}

/**
 * 节点库（左栏，SPEC 3.5 可视化编辑器三栏布局之一）
 *
 * 6 类节点分组展示，支持：
 * - 拖拽到画布（onDragStart）
 * - 点击直接创建（onClick，作为拖拽的兜底交互）
 * - 搜索过滤
 */
export function NodePalette({ onDragStart, onClick }: NodePaletteProps) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? NODE_REGISTRY.filter((m) =>
        m.label.toLowerCase().includes(query.toLowerCase()),
      )
    : NODE_REGISTRY;

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

      {/* 节点列表（按类别分组） */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        {query ? (
          // 搜索模式：扁平展示
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
          // 默认模式：按类别分组
          NODE_CATEGORIES.map((category) => {
            const items = getNodesByCategory(category.id);
            if (items.length === 0) return null;
            return (
              <div key={category.id} className="border-b last:border-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category.label}
                </div>
                <div className="flex flex-col gap-1 p-2 pt-0">
                  {items.map((meta) => (
                    <PaletteItem
                      key={meta.kind}
                      meta={meta}
                      onDragStart={onDragStart}
                      onClick={onClick}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部提示 */}
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        拖拽到画布或点击创建
      </div>
    </aside>
  );
}

/** 节点库单元 */
function PaletteItem({
  meta,
  onDragStart,
  onClick,
}: {
  meta: NodeMeta;
  onDragStart: (kind: ActionTypeKind, event: React.DragEvent) => void;
  onClick: (kind: ActionTypeKind) => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      draggable
      onDragStart={(e) => onDragStart(meta.kind, e)}
      onClick={() => onClick(meta.kind)}
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors",
        "hover:border-primary/30 hover:bg-accent",
        "cursor-grab active:cursor-grabbing",
      )}
      title={`添加 ${meta.label} 节点`}
    >
      <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
      <span className="truncate">{meta.label}</span>
    </button>
  );
}
