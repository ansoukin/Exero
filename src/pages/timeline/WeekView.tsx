import { useMemo } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course, ScheduleOverride, ClassPeriod } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { CourseBlock } from "./CourseBlock";
import {
  WEEKDAY_SHORT,
  getWeekday,
  isToday,
  weekDates,
  resolveDayCourses,
  type DisplayCourse,
} from "./utils";

// ============================================================
// 常量
// ============================================================

/** 网格行高（每个节次格的高度，px） */
const ROW_HEIGHT = 64;
/** 表头高度 */
const HEADER_HEIGHT = 40;
/** 课程块最小高度 */
const MIN_BLOCK_HEIGHT = 28;

// ============================================================
// 主组件
// ============================================================

interface WeekViewProps {
  semesterId: string;
  semesterStart: string;
  courses: Course[];
  periods: ClassPeriod[];
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  /** 点击某天 -> 钻取日视图 */
  onDayClick?: (date: string) => void;
}

/**
 * 周视图（SPEC V2 修订：网格视图，非时间轴）
 *
 * 形态：7 天 × 节次网格（传统课表形态）
 * - 行=节次，列=周一到周日
 * - 每格显示该节次该天的课程（格点模式课程）
 * - 自由模式课程（无 period_index）显示在底部"自由时段"区
 * - 点击格点钻取到日视图（该日时间轴）
 * - 不支持拖拽改时间（拖拽编辑集中在日视图）
 *
 * 变更说明：原 V2 周视图为 7 列时间轴，存在 collision 鬼畜 bug
 * 且信息密度过高。修订为网格视图，专精信息总览。
 */
export function WeekView({
  semesterStart,
  courses,
  periods,
  overrides,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  onDayClick,
}: WeekViewProps) {
  const currentWeek = useTimelineStore((s) => s.currentWeek);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setView = useTimelineStore((s) => s.setView);

  const dates = useMemo(
    () => weekDates(semesterStart, currentWeek),
    [semesterStart, currentWeek]
  );

  // 按日期预计算每天的展示课程
  const dayCoursesMap = useMemo(() => {
    const map = new Map<string, DisplayCourse[]>();
    for (const date of dates) {
      const dayOfWeek = getWeekday(date);
      const dayOverrides = overrides.filter((o) => o.date === date);
      const display = resolveDayCourses(
        courses,
        dayOverrides,
        periods,
        dayOfWeek,
        currentWeek
      );
      map.set(date, display);
    }
    return map;
  }, [dates, courses, overrides, periods, currentWeek]);

  /** 点击某天表头 -> 钻取日视图 */
  function handleDayHeaderClick(date: string) {
    setSelectedDate(date);
    setView("day");
    onDayClick?.(date);
  }

  /** 点击格点 -> 钻取日视图并预填节次 */
  function handleCellClick(date: string, dayOfWeek: number, periodIndex: number | null) {
    setSelectedDate(date);
    if (onCellClick) {
      onCellClick(dayOfWeek, periodIndex);
    } else {
      // 默认行为：钻取日视图
      setView("day");
    }
  }

  // 节次按 period_index 排序
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.period_index - b.period_index),
    [periods]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-fluent">
        <div className="min-w-[800px]">
          {/* 表头：周一到周日 */}
          <div
            className="sticky top-0 z-20 grid grid-cols-[56px_repeat(7,1fr)] border-b bg-card"
            style={{ height: HEADER_HEIGHT }}
          >
            <div className="border-r" />
            {dates.map((date, i) => {
              const weekday = getWeekday(date);
              const label = WEEKDAY_SHORT[weekday];
              const today = isToday(date);
              return (
                <button
                  key={`header-${i}-${date}`}
                  onClick={() => handleDayHeaderClick(date)}
                  className={cn(
                    "border-r px-2 py-2 text-center text-sm font-medium transition-colors hover:bg-accent",
                    today && "bg-primary/10 text-primary"
                  )}
                  title={`点击查看 ${date} 日视图`}
                >
                  <div>{label}</div>
                  <div
                    className={cn(
                      "text-xs",
                      today ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {parseInt(date.slice(8), 10)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 网格主体：行=节次 */}
          {sortedPeriods.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              当前学期未定义节次，无法显示网格视图。请先在设置中配置节次。
            </div>
          ) : (
            sortedPeriods.map((period) => (
              <div
                key={period.id}
                className="grid grid-cols-[56px_repeat(7,1fr)] border-b"
                style={{ height: ROW_HEIGHT }}
              >
                {/* 节次标签列 */}
                <div className="flex flex-col items-center justify-center border-r bg-muted/30 px-1 text-center">
                  <span className="text-xs font-medium">
                    {period.name || `第${period.period_index}节`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {period.start_time}
                  </span>
                </div>
                {/* 7 天列 */}
                {dates.map((date, dayIdx) => (
                  <WeekGridCell
                    key={`cell-${dayIdx}-${date}-${period.period_index}`}
                    date={date}
                    period={period}
                    dayCourses={dayCoursesMap.get(date) || []}
                    onCourseClick={onCourseClick}
                    onCourseLongPress={onCourseLongPress}
                    onCellClick={(dow) => handleCellClick(date, dow, period.period_index)}
                  />
                ))}
              </div>
            ))
          )}

          {/* 自由时段区：无 period_index 的课程 */}
          <FreeTimeSection
            dates={dates}
            dayCoursesMap={dayCoursesMap}
            onCourseClick={onCourseClick}
            onCourseLongPress={onCourseLongPress}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 网格单元格
// ============================================================

interface WeekGridCellProps {
  date: string;
  period: ClassPeriod;
  dayCourses: DisplayCourse[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
  onCellClick?: (dayOfWeek: number) => void;
}

function WeekGridCell({
  date,
  period,
  dayCourses,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
}: WeekGridCellProps) {
  const dayOfWeek = getWeekday(date);
  const today = isToday(date);

  // 筛选本节次的课程（period_index 匹配）
  const cellCourses = dayCourses.filter(
    (dc) => !dc.cancelled && dc.course.period_index === period.period_index
  );

  return (
    <div
      className={cn(
        "group/cell relative border-r p-0.5 transition-colors",
        today && "bg-primary/5",
        "hover:bg-accent/30"
      )}
    >
      {cellCourses.length > 0 ? (
        cellCourses.map((dc) => (
          <div
            key={dc.course.id + (dc.isOverride ? "-ov" : "")}
            className="h-full"
            style={{ minHeight: MIN_BLOCK_HEIGHT }}
          >
            <CourseBlock
              course={dc.course}
              startTime={dc.startTime}
              endTime={dc.endTime}
              small
              onClick={onCourseClick}
              onLongPress={onCourseLongPress}
            />
          </div>
        ))
      ) : (
        <button
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/cell:opacity-100"
          onClick={() => onCellClick?.(dayOfWeek)}
          title="点击新增课程"
        >
          <Plus className="h-3 w-3 text-muted-foreground/50" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// 自由时段区（无 period_index 的课程）
// ============================================================

interface FreeTimeSectionProps {
  dates: string[];
  dayCoursesMap: Map<string, DisplayCourse[]>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
}

function FreeTimeSection({
  dates,
  dayCoursesMap,
  onCourseClick,
  onCourseLongPress,
}: FreeTimeSectionProps) {
  // 检查是否有任何自由模式课程
  const hasFreeTimeCourses = dates.some((date) => {
    const dcs = dayCoursesMap.get(date) || [];
    return dcs.some(
      (dc) => !dc.cancelled && dc.course.period_index === null
    );
  });

  if (!hasFreeTimeCourses) return null;

  return (
    <div className="border-b">
      <div className="border-b bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        自由时段（非节次课程）
      </div>
      <div className="grid grid-cols-[56px_repeat(7,1fr)]">
        <div className="flex items-center justify-center border-r bg-muted/30 px-1 text-center text-[10px] text-muted-foreground">
          自由
        </div>
        {dates.map((date, i) => {
          const dcs = dayCoursesMap.get(date) || [];
          const freeCourses = dcs.filter(
            (dc) => !dc.cancelled && dc.course.period_index === null
          );
          return (
            <div
              key={`free-${i}-${date}`}
              className="min-h-[40px] space-y-0.5 border-r p-0.5"
            >
              {freeCourses.map((dc) => (
                <CourseBlock
                  key={dc.course.id}
                  course={dc.course}
                  startTime={dc.startTime}
                  endTime={dc.endTime}
                  compact
                  onClick={onCourseClick}
                  onLongPress={onCourseLongPress}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
