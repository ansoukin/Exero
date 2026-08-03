import { useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Course, ScheduleOverride, ClassPeriod } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { CourseBlock } from "./CourseBlock";
import {
  TimelineDndContext,
  useDraggableCourse,
  useDroppableCell,
  useResizableCourse,
  useResizeState,
  useDragState,
  type DropTarget,
} from "./TimelineDndContext";
import {
  WEEKDAY_LABELS,
  getWeekday,
  isToday,
  weekDates,
  resolveDayCourses,
  timeToMinutes,
  type DisplayCourse,
} from "./utils";

// ============================================================
// 常量（SPEC V2 3.5 页面 2：日视图时间轴）
// ============================================================

/** 时间轴范围 7:00-22:00（15 小时） */
const START_MIN = 7 * 60;
const END_MIN = 22 * 60;
const TOTAL_MIN = END_MIN - START_MIN;
/** 每小时像素高度（SPEC V2：56px） */
const HOUR_HEIGHT = 56;
/** 时间轴总高度 */
const totalHeight = (TOTAL_MIN / 60) * HOUR_HEIGHT;
/** 课程块最小高度（px） */
const MIN_BLOCK_HEIGHT = 32;
/** 响应式尺寸阈值：高度 >= 64px 用 full 模式，40-64px 用 compact，< 40px 用 mini */
const FULL_MODE_THRESHOLD = 64;
const COMPACT_MODE_THRESHOLD = 40;

// ============================================================
// 主组件
// ============================================================

interface DayViewProps {
  semesterId: string;
  semesterStart: string;
  courses: Course[];
  periods: ClassPeriod[];
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  onMoveCourse?: (course: Course, target: DropTarget) => void | Promise<void>;
  onResizeCourse?: (
    course: Course,
    newEndTime: string
  ) => void | Promise<void>;
}

/**
 * 日视图（SPEC V2 修订：时间轴形态归日视图）
 *
 * 形态：纵向时间轴 7:00-22:00（15 小时）+ 单日列 + 节次虚线辅助线
 * - 每小时 56px，课程块按时间定位，高度反映时长跨度
 * - 节次虚线辅助线仅作参考，拖拽时靠近节次线自动吸附
 * - 整块竖向拖动改时间（同时更新 start_time + end_time）
 * - 底边 resize 手柄改时长（只更新 end_time）
 *
 * 拖拽视觉强调（三层反馈）：
 * 1. 原位虚影：被拖拽课程原位置变 dashed 半透明，标注"原位置"
 * 2. 实时预览块：按 5 分钟吸附 + 节次线对齐计算新位置，渲染完整 CourseBlock
 * 3. 浮动时间气泡：跟随光标显示新时间段（由 TimelineDndContext 提供）
 *
 * 替代原 WeekView 时间轴职责，消除 7 列时间轴 collision 鬼畜 bug。
 */
export function DayView({
  semesterStart,
  courses,
  periods,
  overrides,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  onMoveCourse,
  onResizeCourse,
}: DayViewProps) {
  const currentWeek = useTimelineStore((s) => s.currentWeek);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);

  // 日视图显示选中日期；未选中则默认今天所在周的第 1 天
  const dates = useMemo(
    () => weekDates(semesterStart, currentWeek),
    [semesterStart, currentWeek]
  );

  // 当前显示的日期：优先 selectedDate，若不在当前周内则取本周周一
  const currentDate = useMemo(() => {
    if (dates.includes(selectedDate)) return selectedDate;
    return dates[0];
  }, [dates, selectedDate]);

  const dayOfWeek = getWeekday(currentDate);
  const today = isToday(currentDate);

  // 计算当日展示课程
  const dayCourses = useMemo(() => {
    const dayOverrides = overrides.filter((o) => o.date === currentDate);
    return resolveDayCourses(
      courses,
      dayOverrides,
      periods,
      dayOfWeek,
      currentWeek
    );
  }, [courses, overrides, periods, dayOfWeek, currentWeek, currentDate]);

  // 日期导航
  function goPrevDay() {
    const idx = dates.indexOf(currentDate);
    if (idx > 0) {
      setSelectedDate(dates[idx - 1]);
    }
  }
  function goNextDay() {
    const idx = dates.indexOf(currentDate);
    if (idx < dates.length - 1) {
      setSelectedDate(dates[idx + 1]);
    }
  }

  // 无拖拽回调时渲染只读视图
  if (!onMoveCourse) {
    return (
      <DayTimeline
        currentDate={currentDate}
        dayOfWeek={dayOfWeek}
        today={today}
        periods={periods}
        dayCourses={dayCourses}
        onCourseClick={onCourseClick}
        onCourseLongPress={onCourseLongPress}
        onCellClick={onCellClick}
        onPrevDay={goPrevDay}
        onNextDay={goNextDay}
      />
    );
  }

  return (
    <TimelineDndContext
      onMoveCourse={onMoveCourse}
      onResizeCourse={onResizeCourse}
      freeHourHeight={HOUR_HEIGHT}
      periods={periods}
    >
      <DayTimeline
        currentDate={currentDate}
        dayOfWeek={dayOfWeek}
        today={today}
        periods={periods}
        dayCourses={dayCourses}
        onCourseClick={onCourseClick}
        onCourseLongPress={onCourseLongPress}
        onCellClick={onCellClick}
        onPrevDay={goPrevDay}
        onNextDay={goNextDay}
        enableDnd
      />
    </TimelineDndContext>
  );
}

// ============================================================
// 日视图主体（时间轴）
// ============================================================

interface DayTimelineProps {
  currentDate: string;
  dayOfWeek: number;
  today: boolean;
  periods: ClassPeriod[];
  dayCourses: DisplayCourse[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  enableDnd?: boolean;
}

function DayTimeline({
  currentDate,
  dayOfWeek,
  today,
  periods,
  dayCourses,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  onPrevDay,
  onNextDay,
  enableDnd = false,
}: DayTimelineProps) {
  const resizing = useResizeState();
  const dragState = useDragState();
  const currentWeek = useTimelineStore((s) => s.currentWeek);

  // 拖拽目标：整列（periodIndex=null 表示自由模式 drop）
  const target: DropTarget = {
    targetId: `day-${currentDate}`,
    dayOfWeek,
    periodIndex: null,
  };
  const { setDropNodeRef, isOver } = useDroppableCell(target);

  // 计算课程块布局（重叠时左右并排）
  const layout = useMemo(() => computeLayout(dayCourses), [dayCourses]);

  // ============================================================
  // 自由模式拖拽：原位虚影 + 预览块
  // ============================================================
  const draggingCourseId = dragState.payload?.course.id ?? null;
  const isFreeDragOver =
    dragState.freePreview !== null &&
    dragState.overTarget?.targetId === target.targetId;

  // 预览块布局：基于 freePreview 时间段
  const previewBlock = useMemo(() => {
    if (!isFreeDragOver || !dragState.freePreview) return null;
    const startMin = timeToMinutes(dragState.freePreview.startTime);
    const endMin = timeToMinutes(dragState.freePreview.endTime);
    const clampedStart = Math.max(startMin, START_MIN);
    const clampedEnd = Math.min(endMin, END_MIN);
    if (clampedEnd <= clampedStart) return null;
    return {
      top: ((clampedStart - START_MIN) / 60) * HOUR_HEIGHT,
      height: Math.max(
        ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT,
        MIN_BLOCK_HEIGHT
      ),
    };
  }, [isFreeDragOver, dragState.freePreview]);

  // 小时刻度线（7:00, 8:00, ..., 22:00）
  const hourMarks = Array.from({ length: TOTAL_MIN / 60 + 1 }, (_, i) => ({
    label: `${String(Math.floor((START_MIN + i * 60) / 60)).padStart(2, "0")}:00`,
    top: i * HOUR_HEIGHT,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 日期导航头 */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevDay}
            title="前一天"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center">
            <div
              className={cn(
                "text-lg font-semibold",
                today && "text-primary"
              )}
            >
              {WEEKDAY_LABELS[dayOfWeek]} · 第 {currentWeek} 周
            </div>
            <div className="text-xs text-muted-foreground">{currentDate}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNextDay}
            title="后一天"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 时间冲突提示横幅（V2.1：检测到课程时间重叠时显示） */}
      {layout.hasAnyConflict && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            检测到课程时间冲突：部分课程开始时间早于前一节课结束时间，请调整课程时间避免重叠
          </span>
        </div>
      )}

      {/* 时间轴主体 */}
      <div className="flex flex-1 overflow-auto scrollbar-fluent">
        <div className="flex min-w-[480px] flex-1">
          {/* 左侧时间刻度列 */}
          <div
            className="relative w-14 shrink-0 border-r bg-muted/30"
            style={{ height: totalHeight }}
          >
            {hourMarks.map((m, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/50 px-1 text-[10px] text-muted-foreground"
                style={{ top: m.top }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* 单日列（drop 目标） */}
          <div
            ref={enableDnd ? setDropNodeRef : undefined}
            className={cn(
              "relative flex-1 border-r transition-colors duration-100",
              today && "bg-primary/5",
              isOver && "bg-primary/15 ring-2 ring-inset ring-primary/40"
            )}
            style={{ height: totalHeight }}
          >
            {/* drop 目标提示光带 */}
            {isOver && (
              <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-1 bg-primary" />
            )}

            {/* 小时刻度线（淡） */}
            {Array.from({ length: TOTAL_MIN / 60 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/30"
                style={{ top: (i + 1) * HOUR_HEIGHT }}
              />
            ))}

            {/* 节次虚线辅助线 */}
            {periods.map((p) => {
              const pStartMin = timeToMinutes(p.start_time);
              const pEndMin = timeToMinutes(p.end_time);
              if (pStartMin < START_MIN || pEndMin > END_MIN) return null;
              const top = ((pStartMin - START_MIN) / 60) * HOUR_HEIGHT;
              const height = ((pEndMin - pStartMin) / 60) * HOUR_HEIGHT;
              return (
                <div
                  key={p.id}
                  className="absolute left-0 right-0 border border-dashed border-border/40"
                  style={{ top, height }}
                >
                  <span className="absolute left-1 top-0 text-[9px] text-muted-foreground/60">
                    {p.name || `第${p.period_index}节`}
                  </span>
                </div>
              );
            })}

            {/* 课程块（V2.1：纯垂直排列，占满整列宽度，冲突课程显示警告） */}
            {layout.items.map((item) => {
              const isResizingThis = resizing?.course.id === item.dc.course.id;
              const liveHeight = isResizingThis
                ? Math.max(item.height + resizing!.deltaY, MIN_BLOCK_HEIGHT)
                : item.height;

              const isGhost =
                enableDnd &&
                draggingCourseId === item.dc.course.id &&
                isFreeDragOver;

              return (
                <div
                  key={item.dc.course.id + (item.dc.isOverride ? "-ov" : "")}
                  className={cn(
                    "group/blk absolute z-10 hover:z-50 transition-all duration-200",
                    isGhost && "z-0 opacity-40",
                    item.hasConflict && "ring-2 ring-destructive ring-offset-1"
                  )}
                  style={{
                    top: item.top,
                    height: liveHeight,
                    left: "2px",
                    right: "2px",
                  }}
                >
                  {isGhost ? (
                    <div className="relative h-full w-full rounded-md border-2 border-dashed border-primary/50 bg-primary/5">
                      <span className="absolute left-1 top-1 text-[9px] text-muted-foreground/60">
                        原位置
                      </span>
                    </div>
                  ) : (
                    <>
                      <DraggableDayCourse
                        course={item.dc.course}
                        startTime={item.dc.startTime}
                        endTime={item.dc.endTime}
                        sourceId={`course-${item.dc.course.id}-${currentDate}-day`}
                        enableDnd={
                          enableDnd && !item.dc.cancelled && !item.dc.isOverride
                        }
                        sizeMode={
                          liveHeight >= FULL_MODE_THRESHOLD
                            ? "full"
                            : liveHeight >= COMPACT_MODE_THRESHOLD
                              ? "compact"
                              : "mini"
                        }
                        onClick={onCourseClick}
                        onLongPress={onCourseLongPress}
                      />
                      {/* 时间冲突警告标记 */}
                      {item.hasConflict && (
                        <div className="absolute -right-1 -top-1 z-50 flex items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground shadow-lg">
                          <AlertCircle className="h-2.5 w-2.5" />
                          时间冲突
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* 自由模式拖拽落点视觉强调（V2.1：强化版四层反馈，明确"拖到了哪一刻"）
                * 1. 落点高亮线：3px 加粗实线 + 阴影发光 + 脉冲动画，横跨时间轴
                * 2. 双侧时间标签：左起始/右结束，大字号粗体，黑底白字高对比
                * 3. 实色预览块：课程主题色背景 + 科目名 + 时间段，清晰可读
                * 4. 时间刻度高亮：左侧时间轴对应刻度行高亮标记
                */}
            {previewBlock && dragState.payload && dragState.freePreview && (
              <>
                {/* 落点高亮线：加粗实线 + 发光 + 脉冲，横跨时间轴 */}
                <div
                  className="pointer-events-none absolute left-0 right-0 z-40"
                  style={{ top: previewBlock.top - 1 }}
                >
                  <div className="relative h-[3px] w-full bg-primary shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-pulse">
                    {/* 左侧时间标签（新起始时间）- 大字号黑底白字 */}
                    <div className="absolute -top-6 left-0 flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground shadow-xl ring-2 ring-primary-foreground/30">
                      <span className="h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
                      {dragState.freePreview.startTime}
                    </div>
                    {/* 右侧时间标签（新结束时间） */}
                    <div className="absolute -top-6 right-0 rounded-md bg-primary/90 px-2 py-1 text-xs font-bold text-primary-foreground shadow-xl ring-2 ring-primary-foreground/20">
                      → {dragState.freePreview.endTime}
                    </div>
                  </div>
                </div>

                {/* 实色预览块：课程主题色背景，清晰显示科目名+时间段 */}
                <div
                  className="pointer-events-none absolute z-30 overflow-hidden rounded-lg border-2 border-primary shadow-xl"
                  style={{
                    top: previewBlock.top,
                    height: previewBlock.height,
                    left: "2px",
                    right: "2px",
                    backgroundColor: dragState.payload.course.color
                      ? `color-mix(in srgb, ${dragState.payload.course.color} 25%, hsl(var(--card)))`
                      : "hsl(var(--primary) / 0.2)",
                    borderLeftColor: dragState.payload.course.color || "hsl(var(--primary))",
                    borderLeftWidth: "4px",
                  }}
                >
                  <div className="flex h-full flex-col justify-center px-3 py-1">
                    <span
                      className="text-sm font-bold leading-tight"
                      style={{ color: dragState.payload.course.color || "hsl(var(--primary))" }}
                    >
                      {dragState.payload.course.subject}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {dragState.freePreview.startTime} - {dragState.freePreview.endTime}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 已取消课程在底部标注 */}
            {dayCourses.some((dc) => dc.cancelled) && (
              <div className="absolute bottom-1 left-1 right-1 rounded border border-dashed border-destructive/30 bg-destructive/5 p-1">
                {dayCourses
                  .filter((dc) => dc.cancelled)
                  .map((dc) => (
                    <CourseBlock
                      key={dc.course.id}
                      course={dc.course}
                      startTime={dc.startTime}
                      endTime={dc.endTime}
                      cancelled
                      compact
                    />
                  ))}
              </div>
            )}

            {/* 点击空白新增（仅非拖拽模式） */}
            {!enableDnd && onCellClick && (
              <button
                className="absolute inset-0 opacity-0 hover:bg-accent/20"
                onClick={() => onCellClick(dayOfWeek, null)}
              >
                <Plus className="mx-auto mt-2 h-4 w-4 text-muted-foreground/30" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 课程块拖拽包裹器
// ============================================================

interface DraggableDayCourseProps {
  course: Course;
  startTime: string;
  endTime: string;
  sourceId: string;
  enableDnd: boolean;
  sizeMode?: "full" | "compact" | "mini";
  onClick?: (course: Course) => void;
  onLongPress?: (course: Course, pos: { x: number; y: number }) => void;
}

function DraggableDayCourse({
  course,
  startTime,
  endTime,
  sourceId,
  enableDnd,
  sizeMode = "full",
  onClick,
  onLongPress,
}: DraggableDayCourseProps) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const durationMin = Math.max(15, endMin - startMin);

  const { dragAttributes, dragListeners, setNodeRef, isDragging } =
    useDraggableCourse({
      course,
      sourceId,
      originalStartMin: startMin,
      durationMin,
      startTime,
      endTime,
    });
  const { setResizeHandleRef, resizeListeners } = useResizableCourse(course);

  if (!enableDnd) {
    return (
      <CourseBlock
        course={course}
        startTime={startTime}
        endTime={endTime}
        sizeMode={sizeMode}
        onClick={onClick}
        onLongPress={onLongPress}
      />
    );
  }

  return (
    <CourseBlock
      course={course}
      startTime={startTime}
      endTime={endTime}
      sizeMode={sizeMode}
      onClick={onClick}
      onLongPress={onLongPress}
      dragAttributes={dragAttributes as unknown as Record<string, unknown>}
      dragListeners={dragListeners}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      freeMode
      setResizeHandleRef={setResizeHandleRef}
      resizeListeners={resizeListeners}
    />
  );
}

// ============================================================
// 课程块布局算法（V2.1：纯垂直排列，禁止时间重叠）
// ============================================================

interface LayoutItemInternal {
  dc: DisplayCourse;
  clampedStart: number;
  clampedEnd: number;
  top: number;
  height: number;
}

interface LayoutItem {
  dc: DisplayCourse;
  top: number;
  height: number;
  /** 是否与前一节课时间冲突（开始时间 < 前一节结束时间） */
  hasConflict: boolean;
}

interface LayoutResult {
  items: LayoutItem[];
  /** 当日是否存在时间冲突 */
  hasAnyConflict: boolean;
}

/**
 * 计算课程块布局（V2.1 修订：纯垂直排列，禁止并排）
 *
 * 规则：
 * - 所有课程块占满整列宽度（不再并排分列）
 * - 按开始时间排序，下一节课开始时间必须 >= 上一节课结束时间
 * - 若检测到时间重叠（下一节开始 < 上一节结束），标记 hasConflict
 * - 冲突课程仍渲染（让用户看到问题），但显示冲突警告样式
 *
 * @returns 布局结果，含每个课程块位置和冲突标记
 */
function computeLayout(dayCourses: DisplayCourse[]): LayoutResult {
  const items: LayoutItemInternal[] = [];
  for (const dc of dayCourses) {
    if (dc.cancelled) continue;
    const dcStartMin = timeToMinutes(dc.startTime);
    const dcEndMin = timeToMinutes(dc.endTime);
    const clampedStart = Math.max(dcStartMin, START_MIN);
    const clampedEnd = Math.min(dcEndMin, END_MIN);
    if (clampedEnd <= clampedStart) continue;
    items.push({
      dc,
      clampedStart,
      clampedEnd,
      top: ((clampedStart - START_MIN) / 60) * HOUR_HEIGHT,
      height: Math.max(
        ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT,
        MIN_BLOCK_HEIGHT
      ),
    });
  }
  items.sort((a, b) => a.clampedStart - b.clampedStart);

  // 冲突检测：下一节课开始时间 < 上一节课结束时间
  let hasAnyConflict = false;
  const result: LayoutItem[] = items.map((it, i) => {
    let hasConflict = false;
    if (i > 0) {
      const prev = items[i - 1];
      if (it.clampedStart < prev.clampedEnd) {
        hasConflict = true;
        hasAnyConflict = true;
      }
    }
    return {
      dc: it.dc,
      top: it.top,
      height: it.height,
      hasConflict,
    };
  });

  return { items: result, hasAnyConflict };
}
