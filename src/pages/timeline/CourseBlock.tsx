import { useRef } from "react";
import { MapPin, User, Zap, X, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course } from "@/lib/tauri";
import { useLongPress, type LongPressPosition } from "./useLongPress";
import { shouldHandleClick } from "./clickSuppression";
import { formatTimeRange } from "./utils";

/**
 * 课程块默认色板（当 course.color 为空时按科目名 hash 分配）
 *
 * 使用 Win11 色板的 HSL 变量，避免硬编码 hex 导致深浅模式不兼容。
 */
const DEFAULT_COLORS = [
  "hsl(206 100% 42%)",
  "hsl(122 78% 27%)",
  "hsl(14 97% 43%)",
  "hsl(265 53% 37%)",
  "hsl(352 86% 49%)",
  "hsl(187 100% 38%)",
  "hsl(322 100% 44%)",
  "hsl(45 100% 50%)",
];

/** 按字符串 hash 选择默认颜色 */
function hashColor(subjectName: string): string {
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = ((hash << 5) - hash + subjectName.charCodeAt(i)) | 0;
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

/** dnd-kit 监听器类型（onPointerDown 等事件处理器集合） */
type DndListeners = {
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  [key: string]: unknown;
};

interface CourseBlockProps {
  course: Course;
  /** 课程开始时间（已根据节次定义或自由模式解析） */
  startTime: string;
  /** 课程结束时间 */
  endTime: string;
  /** 是否已取消（临时调课 cancel） */
  cancelled?: boolean;
  /** 是否为临时新增课程 */
  isOverride?: boolean;
  /** 点击展开详情 */
  onClick?: (course: Course) => void;
  /** 长按/右键弹出操作菜单（触屏长按 500ms，鼠标右键即时） */
  onLongPress?: (course: Course, pos: LongPressPosition) => void;
  /** 拖拽 props 注入（由 dnd-kit 提供） */
  dragAttributes?: Record<string, unknown>;
  dragListeners?: DndListeners;
  isDragging?: boolean;
  /** dnd-kit ref 注入（用于可拖拽元素） */
  setNodeRef?: (el: HTMLElement | null) => void;
  /** 是否紧凑显示（月视图用） */
  compact?: boolean;
  /**
   * 尺寸模式（V2.1 响应式文字布局）
   * - "full"：完整显示（科目名+时间+地点+教师），高度 >= 64px
   * - "compact"：紧凑显示（科目名+时间，地点/教师缩小），高度 40-64px
   * - "mini"：迷你显示（仅科目名+时间，单行），高度 < 40px
   */
  sizeMode?: "full" | "compact" | "mini";
  /** @deprecated 已废弃，用 sizeMode 替代。向后兼容：small=true 等价于 sizeMode="mini" */
  small?: boolean;
  /** 是否为自由模式（显示 resize 手柄可调时长） */
  freeMode?: boolean;
  /** resize 手柄 ref 注入（自由模式调整时长） */
  setResizeHandleRef?: (el: HTMLElement | null) => void;
  /** resize 手柄监听器（dnd-kit 提供） */
  resizeListeners?: DndListeners;
  className?: string;
  /** 是否为拖拽预览模式（DragOverlay 用，纯展示不绑定任何事件） */
  preview?: boolean;
}

/**
 * 课程块组件（SPEC 3.5 页面 2：信息丰富型）
 *
 * 显示：科目名 + 时间 + 关联指令图标 + 颜色标识
 * 交互：
 * - 点击展开详情
 * - 鼠标右键即时弹出操作菜单
 * - 触屏长按 500ms 弹出操作菜单（SPEC 3.5：触屏无右键）
 * - 拖拽移动（dnd-kit，与长按/右键事件兼容）
 * - 自由模式：底部 resize 手柄可调整课程时长
 *
 * 事件合并说明：
 * dragListeners 与 longPress 都含 onPointerDown 等事件，
 * 不能用展开符（后者覆盖前者），必须手动合并依次调用。
 */
export function CourseBlock({
  course,
  startTime,
  endTime,
  cancelled = false,
  isOverride = false,
  onClick,
  onLongPress,
  dragAttributes,
  dragListeners,
  isDragging = false,
  setNodeRef,
  compact = false,
  sizeMode,
  small = false,
  freeMode = false,
  setResizeHandleRef,
  resizeListeners,
  className,
  preview = false,
}: CourseBlockProps) {
  const color = course.color || hashColor(course.subject);
  const longPress = useLongPress((pos) => onLongPress?.(course, pos), 500);

  // V2.1 响应式尺寸模式：优先用 sizeMode，向后兼容 small
  const resolvedSizeMode = sizeMode ?? (small ? "mini" : "full");

  // V2.2 双击触发编辑弹窗（从根源解决拖拽后误弹问题）
  // 拖拽/长按结束后的合成 click 只是"第一次点击"，不会触发编辑；
  // 用户必须在 300ms 内再次点击才会打开编辑弹窗
  const lastClickRef = useRef(0);
  const DOUBLE_CLICK_MS = 300;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 第一道防线：拖拽中 / 禁用窗口内的 click 直接拦截
    if (!shouldHandleClick()) return;
    // 第二道防线：双击检测
    const now = Date.now();
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      // 双击 → 触发编辑
      lastClickRef.current = 0;
      onClick?.(course);
    } else {
      // 第一次点击 → 仅记录时间，不触发
      lastClickRef.current = now;
    }
  };

  // 鼠标右键即时触发菜单（无需等待 500ms 长按）
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onLongPress) return;
    e.preventDefault();
    e.stopPropagation();
    onLongPress(course, { x: e.clientX, y: e.clientY });
  };

  // 合并 dragListeners + longPress 的 pointer 事件，避免展开符覆盖
  // preview 模式下不绑定任何事件（用于 DragOverlay 纯展示）
  const mergedPointerHandlers = preview
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          dragListeners?.onPointerDown?.(e);
          longPress.onPointerDown(e);
        },
        onPointerUp: (e: React.PointerEvent) => {
          dragListeners?.onPointerUp?.(e);
          longPress.onPointerUp(e);
        },
        onPointerLeave: (e: React.PointerEvent) => {
          dragListeners?.onPointerUp?.(e);
          longPress.onPointerLeave(e);
        },
        onPointerCancel: (e: React.PointerEvent) => {
          dragListeners?.onPointerCancel?.(e);
          longPress.onPointerCancel(e);
        },
      };

  // preview 模式下不绑定 dragAttributes/dragListeners（避免 DragOverlay 内重复 hook）
  const appliedDragAttributes = preview ? {} : dragAttributes ?? {};
  const appliedDragListeners = preview ? {} : dragListeners;

  if (compact) {
    // 月视图紧凑模式：仅显示色条 + 科目名
    return (
      <div
        ref={setNodeRef}
        {...appliedDragAttributes}
        {...appliedDragListeners}
        onContextMenu={preview ? undefined : handleContextMenu}
        onClick={preview ? undefined : handleClick}
        className={cn(
          "flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium",
          cancelled && "opacity-40 line-through",
          isDragging && "opacity-50",
          className
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          color: color,
        }}
        title={`${course.subject} ${startTime}-${endTime}`}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{course.subject}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...appliedDragAttributes}
      {...mergedPointerHandlers}
      onContextMenu={preview ? undefined : handleContextMenu}
      onClick={preview ? undefined : handleClick}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-md border-l-4 p-2 text-left transition-all duration-200",
        "hover:shadow-md hover:scale-[1.01]",
        cancelled && "opacity-40",
        isOverride && "ring-1 ring-dashed ring-primary/50",
        isDragging && "opacity-60 shadow-xl ring-2 ring-primary/50 scale-[1.02]",
        freeMode && "cursor-grab active:cursor-grabbing",
        preview && "shadow-2xl ring-2 ring-primary/60 scale-[1.03]",
        className
      )}
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, hsl(var(--card)))`,
      }}
      title={course.subject}
    >
      {/* 拖拽手柄（hover 时强化显示，提示可拖拽；preview 模式不显示） */}
      {appliedDragListeners && !cancelled && !isOverride && !preview && (
        <div
          className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-background/60 px-1 py-0.5 text-[9px] text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-80"
          title="拖动移动课程"
        >
          <GripVertical className="h-3 w-3" style={{ color }} />
        </div>
      )}

      {/* V2.1 响应式文字布局：根据 sizeMode 动态调整信息密度和字号 */}
      {resolvedSizeMode === "mini" ? (
        /* mini 模式：单行紧凑布局，仅科目名+时间 */
        <div className="flex h-full items-center gap-1.5 pl-2">
          <span
            className="truncate text-xs font-semibold leading-tight"
            style={{ color: color }}
          >
            {course.subject}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {startTime}
          </span>
        </div>
      ) : (
        /* full / compact 模式：多行布局 */
        <>
          {/* 顶部：科目名 + 关联指令图标 */}
          <div className="flex items-start justify-between gap-1 pl-3">
            <span
              className={cn(
                "font-semibold leading-tight transition-all duration-200",
                resolvedSizeMode === "compact" ? "text-xs" : "text-sm"
              )}
              style={{ color: color }}
            >
              {course.subject}
            </span>
            {course.flow_id && (
              <Zap
                className={cn(
                  "shrink-0 opacity-60 transition-all duration-200",
                  resolvedSizeMode === "compact" ? "h-3 w-3" : "h-3.5 w-3.5"
                )}
                style={{ color: color }}
              />
            )}
          </div>

          {/* 时间段 */}
          <span
            className={cn(
              "mt-0.5 text-muted-foreground transition-all duration-200",
              resolvedSizeMode === "compact" ? "text-[10px]" : "text-xs"
            )}
          >
            {formatTimeRange(startTime, endTime)}
          </span>

          {/* 底部：地点 + 教师（compact 模式缩小图标，full 模式完整显示） */}
          {resolvedSizeMode === "full" && (course.room || course.teacher) && (
            <div className="mt-auto flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
              {course.room && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {course.room}
                </span>
              )}
              {course.teacher && (
                <span className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3 shrink-0" />
                  {course.teacher}
                </span>
              )}
            </div>
          )}

          {/* compact 模式：地点/教师单行显示 */}
          {resolvedSizeMode === "compact" && (course.room || course.teacher) && (
            <div className="mt-auto flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground/80 animate-in fade-in duration-200">
              {course.room && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {course.room}
                </span>
              )}
              {course.teacher && (
                <span className="flex items-center gap-0.5 truncate">
                  <User className="h-2.5 w-2.5 shrink-0" />
                  {course.teacher}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* 自由模式：底部 resize 手柄（可拖拽调整时长） */}
      {freeMode && setResizeHandleRef && resizeListeners && !cancelled && (
        <div
          ref={setResizeHandleRef}
          {...resizeListeners}
          className="absolute bottom-0 left-0 right-0 flex h-2 cursor-ns-resize items-center justify-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            resizeListeners.onPointerDown?.(e);
          }}
        >
          <div className="h-0.5 w-6 rounded-full bg-muted-foreground/30 transition-colors duration-200 group-hover:bg-muted-foreground/60" />
        </div>
      )}

      {/* 取消标记 */}
      {cancelled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <X className="h-6 w-6 text-destructive" />
        </div>
      )}

      {/* 临时调课标记 */}
      {isOverride && (
        <span className="absolute right-1 top-1 rounded bg-primary/80 px-1 py-0.5 text-[10px] font-medium text-primary-foreground animate-in fade-in zoom-in-50 duration-200">
          临时
        </span>
      )}
    </div>
  );
}
