import { MapPin, User, Zap, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course } from "@/lib/tauri";
import { useLongPress, type LongPressPosition } from "./useLongPress";
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
  /** 点击展开详情/编辑 */
  onClick?: (course: Course) => void;
  /** 长按/右键弹出操作菜单（触屏长按 500ms，鼠标右键即时） */
  onLongPress?: (course: Course, pos: LongPressPosition) => void;
  /** 是否紧凑显示（月视图用） */
  compact?: boolean;
  /**
   * 尺寸模式（响应式文字布局）
   * - "full"：完整显示（科目名+时间+地点+教师），高度 >= 64px
   * - "compact"：紧凑显示（科目名+时间，地点/教师缩小），高度 40-64px
   * - "mini"：迷你显示（仅科目名+时间，单行），高度 < 40px
   */
  sizeMode?: "full" | "compact" | "mini";
  /** @deprecated 已废弃，用 sizeMode 替代。向后兼容：small=true 等价于 sizeMode="mini" */
  small?: boolean;
  className?: string;
}

/**
 * 课程块组件（纯展示 + 点击/右键交互）
 *
 * 显示：科目名 + 时间 + 关联指令图标 + 颜色标识
 * 交互：
 * - 点击打开编辑弹窗
 * - 鼠标右键即时弹出操作菜单
 * - 触屏长按 500ms 弹出操作菜单
 */
export function CourseBlock({
  course,
  startTime,
  endTime,
  cancelled = false,
  isOverride = false,
  onClick,
  onLongPress,
  compact = false,
  sizeMode,
  small = false,
  className,
}: CourseBlockProps) {
  const color = course.color || hashColor(course.subject);
  const longPress = useLongPress((pos) => onLongPress?.(course, pos), 500);

  const resolvedSizeMode = sizeMode ?? (small ? "mini" : "full");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(course);
  };

  // 鼠标右键即时触发菜单（无需等待 500ms 长按）
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onLongPress) return;
    e.preventDefault();
    e.stopPropagation();
    // 阻止原生事件冒泡到 document，使 CourseActionMenu 的 document 级
    // contextmenu 监听不触发（菜单直接更新到新位置而非关闭再重开）
    e.nativeEvent.stopImmediatePropagation();
    onLongPress(course, { x: e.clientX, y: e.clientY });
  };

  if (compact) {
    // 月视图紧凑模式：仅显示色条 + 科目名
    return (
      <div
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium",
          cancelled && "opacity-40 line-through",
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
      {...longPress}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-md border-l-4 p-2 text-left transition-all duration-200",
        "hover:shadow-md hover:scale-[1.01]",
        cancelled && "opacity-40",
        isOverride && "ring-1 ring-dashed ring-primary/50",
        className
      )}
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, hsl(var(--card)))`,
      }}
      title={course.subject}
    >
      {/* 响应式文字布局：根据 sizeMode 动态调整信息密度和字号 */}
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
