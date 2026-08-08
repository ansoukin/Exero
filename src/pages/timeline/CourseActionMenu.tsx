import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Copy,
  CalendarClock,
  Trash2,
  CalendarX,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course } from "@/lib/tauri";

export interface CourseActionMenuPosition {
  /** 菜单显示的 x 坐标（视口坐标） */
  x: number;
  /** 菜单显示的 y 坐标（视口坐标） */
  y: number;
}

interface CourseActionMenuProps {
  /** 菜单定位（长按/右键触发时记录的坐标） */
  position: CourseActionMenuPosition | null;
  /** 目标课程 */
  course: Course | null;
  /** 关闭菜单 */
  onClose: () => void;
  /** 编辑课程 */
  onEdit?: (course: Course) => void;
  /** 复制到其他时间 */
  onDuplicate?: (course: Course) => void;
  /** 临时取消当天（二级菜单直接触发） */
  onCancelOccurrence?: (course: Course) => void;
  /** 临时换时间（二级菜单触发，打开对话框） */
  onMoveOccurrence?: (course: Course) => void;
  /** 删除课程（永久） */
  onDelete?: (course: Course) => void;
}

/**
 * 课程操作菜单（右键即时 / 触屏长按 500ms）
 *
 * 浮动定位到触发坐标，提供：
 * - 编辑（打开表单）
 * - 复制（创建副本到其他时间）
 * - 临时调整（hover 展开二级子菜单：取消当天 / 换时间）
 * - 删除（永久删除）
 *
 * 二级子菜单：hover "临时调整" 项时向右展开，
 * 避免弹窗二次交互，符合桌面右键菜单惯例。
 */
export function CourseActionMenu({
  position,
  course,
  onClose,
  onEdit,
  onDuplicate,
  onCancelOccurrence,
  onMoveOccurrence,
  onDelete,
}: CourseActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<CourseActionMenuPosition | null>(null);
  // 二级子菜单展开状态
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const submenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 根据视口边界调整菜单位置，避免溢出
  useEffect(() => {
    if (!position) {
      setAdjustedPos(null);
      setSubmenuOpen(false);
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
      // 右溢出（含子菜单宽度 ~160px）→ 向左偏移
      if (x + rect.width + 160 > vw - 8) x = Math.max(8, vw - rect.width - 8);
      if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
      setAdjustedPos({ x, y });
    });
  }, [position]);

  // ESC 关闭
  useEffect(() => {
    if (!position) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSubmenuOpen(false);
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [position, onClose]);

  // 清理子菜单定时器
  useEffect(() => {
    return () => {
      if (submenuTimer.current) clearTimeout(submenuTimer.current);
    };
  }, []);

  // click-outside 关闭（移除全屏 overlay，改用 document 事件监听）
  // 课程块 handleContextMenu 调用 nativeEvent.stopImmediatePropagation() 阻止
  // document 级 contextmenu 监听触发，使菜单直接更新到新位置而非关闭
  useEffect(() => {
    if (!position) return;

    function handlePointerDown(e: PointerEvent) {
      // 仅左键触发关闭，右键由 contextmenu 监听处理
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

  if (!position || !course) return null;

  const openSubmenu = () => {
    if (submenuTimer.current) clearTimeout(submenuTimer.current);
    setSubmenuOpen(true);
  };
  const closeSubmenu = () => {
    if (submenuTimer.current) clearTimeout(submenuTimer.current);
    submenuTimer.current = setTimeout(() => setSubmenuOpen(false), 200);
  };

  const hasOverride = onCancelOccurrence || onMoveOccurrence;

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
          {course.subject}
        </div>
        <div className="h-px bg-muted" />

        {/* 编辑 */}
        {onEdit && (
          <MenuItem icon={Pencil} label="编辑课程" onClick={() => { onEdit(course); onClose(); }} />
        )}

        {/* 复制 */}
        {onDuplicate && (
          <MenuItem icon={Copy} label="复制到..." onClick={() => { onDuplicate(course); onClose(); }} />
        )}

        {/* 临时调整（含二级子菜单） */}
        {hasOverride && (
          <div
            onMouseEnter={openSubmenu}
            onMouseLeave={closeSubmenu}
            className="relative"
          >
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <CalendarClock className="h-4 w-4" />
              <span className="flex-1 text-left">临时调整</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </button>

            {/* 二级子菜单 */}
            {submenuOpen && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[150px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                onMouseEnter={openSubmenu}
                onMouseLeave={closeSubmenu}
              >
                {onCancelOccurrence && (
                  <MenuItem
                    icon={CalendarX}
                    label="取消当天"
                    onClick={() => { onCancelOccurrence(course); onClose(); }}
                  />
                )}
                {onMoveOccurrence && (
                  <MenuItem
                    icon={ArrowRight}
                    label="换时间"
                    onClick={() => { onMoveOccurrence(course); onClose(); }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* 删除 */}
        {onDelete && (
          <MenuItem
            icon={Trash2}
            label="永久删除"
            danger
            onClick={() => { onDelete(course); onClose(); }}
          />
        )}
      </div>
  );
}

/** 菜单项（单级） */
function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        danger && "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
