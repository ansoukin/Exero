/**
 * 日常模式右键菜单（Beta6 Phase 4）
 *
 * 触发块右键菜单，提供：
 * - 编辑快捷指令：跳转到 QuickActions 页并选中 flow 进入编辑器
 * - 删除快捷指令：删除整个 flow（含触发器和动作），需二次确认
 *
 * 样式与 CourseActionMenu 一致（浮动定位 + ESC/click-outside 关闭）。
 */

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TriggerBlock } from "./dailyTypes";

export interface DailyActionMenuPosition {
  x: number;
  y: number;
}

interface DailyActionMenuProps {
  position: DailyActionMenuPosition | null;
  block: TriggerBlock | null;
  onClose: () => void;
  /** 编辑快捷指令（跳转 QuickActions 并选中 flow） */
  onEdit?: (block: TriggerBlock) => void;
  /** 删除快捷指令（删除整个 flow） */
  onDelete?: (block: TriggerBlock) => void;
}

export function DailyActionMenu({
  position,
  block,
  onClose,
  onEdit,
  onDelete,
}: DailyActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<DailyActionMenuPosition | null>(null);

  // 根据视口边界调整菜单位置
  useEffect(() => {
    if (!position) {
      setAdjustedPos(null);
      return;
    }
    requestAnimationFrame(() => {
      if (!menuRef.current) {
        setAdjustedPos(position);
        return;
      }
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let { x, y } = position;
      if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
      if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
      setAdjustedPos({ x, y });
    });
  }, [position]);

  // ESC 关闭
  useEffect(() => {
    if (!position) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [position, onClose]);

  // click-outside 关闭
  useEffect(() => {
    if (!position) return;
    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleContextMenu(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [position, onClose]);

  if (!position || !block) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{
        left: (adjustedPos ?? position).x,
        top: (adjustedPos ?? position).y,
      }}
    >
      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        {block.flowName}
      </div>
      <div className="h-px bg-muted" />

      {onEdit && (
        <button
          role="menuitem"
          onClick={() => { onEdit(block); onClose(); }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Pencil className="h-4 w-4" />
          编辑快捷指令
        </button>
      )}

      {onDelete && (
        <button
          role="menuitem"
          onClick={() => { onDelete(block); onClose(); }}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
            "text-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <Trash2 className="h-4 w-4" />
          删除快捷指令
        </button>
      )}
    </div>
  );
}
