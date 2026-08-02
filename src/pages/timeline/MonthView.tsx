import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Course, ScheduleOverride, ClassPeriod } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import {
  MONTH_LABELS,
  WEEKDAY_SHORT_MON_FIRST,
  getWeekday,
  isToday,
  monthGrid,
  resolveDayCourses,
  toIsoDate,
  weekOfDate,
  type DisplayCourse,
} from "./utils";

// ============================================================
// 常量
// ============================================================

/** 月视图每格最多显示的课程条数（超出显示 "+N 节"） */
const MAX_COURSES_PER_CELL = 4;

/** 课程块默认色板（与 CourseBlock 一致，按科目名 hash 分配） */
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

// ============================================================
// 主组件
// ============================================================

interface MonthViewProps {
  semesterId: string;
  semesterStart: string;
  totalWeeks: number;
  courses: Course[];
  /** 节次定义（解析格点模式课程的时间段） */
  periods: ClassPeriod[];
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course, pos: { x: number; y: number }) => void;
  /** 点击某天 → 跳转周视图 */
  onDayClick?: (date: string) => void;
}

/**
 * 月视图（SPEC V2 3.5 页面 2）
 *
 * 形态：6×7 日历方格（行=周，列=周一到周日）
 * - 每格**直接列出**当天课程名+时间（如"8:00 数学"），信息直接可见不折叠
 * - 有临时调课的日期格角标显示小圆点提示
 * - 点击格点跳转到周视图（该日所在周）
 * - 高度不足时课程项自动截断，显示"+N 节"提示
 */
export function MonthView({
  semesterStart,
  totalWeeks,
  courses,
  periods,
  overrides,
  onDayClick,
}: MonthViewProps) {
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setView = useTimelineStore((s) => s.setView);
  const setCurrentWeek = useTimelineStore((s) => s.setCurrentWeek);

  // 月视图内部维护当前显示的年月（独立于周次导航）
  const initial = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const grid = useMemo(
    () => monthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToday() {
    const today = toIsoDate(new Date());
    const d = new Date(today + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  }

  /** 点击日期格 → 跳转周视图（SPEC V2：点击格点跳转到周视图） */
  function handleDayClick(date: string) {
    setSelectedDate(date);
    // 同步周次（若日期在学期内）
    const week = weekOfDate(date, semesterStart, totalWeeks);
    setCurrentWeek(week);
    onDayClick?.(date);
    setView("week");
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 月份导航 */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h2 className="text-lg font-semibold">
          {viewYear} 年 {MONTH_LABELS[viewMonth]}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToday} className="h-8">
            今天
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={prevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 星期表头（周一到周日） */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAY_SHORT_MON_FIRST.map((label, i) => (
          <div
            key={i}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6×7 日历网格 */}
      <div className="grid flex-1 grid-cols-7 overflow-auto scrollbar-fluent">
        {grid.map((date) => (
          <MonthDayCell
            key={date}
            date={date}
            viewMonth={viewMonth}
            semesterStart={semesterStart}
            totalWeeks={totalWeeks}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onClick={() => handleDayClick(date)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 日期格
// ============================================================

interface MonthDayCellProps {
  date: string;
  viewMonth: number;
  semesterStart: string;
  totalWeeks: number;
  courses: Course[];
  periods: ClassPeriod[];
  overrides: ScheduleOverride[];
  onClick: () => void;
}

function MonthDayCell({
  date,
  viewMonth,
  semesterStart,
  totalWeeks,
  courses,
  periods,
  overrides,
  onClick,
}: MonthDayCellProps) {
  const d = new Date(date + "T00:00:00");
  const isCurrentMonth = d.getMonth() === viewMonth;
  const today = isToday(date);
  const dayOfWeek = getWeekday(date);
  const week = weekOfDate(date, semesterStart, totalWeeks);
  const dayOverrides = overrides.filter((o) => o.date === date);
  const hasOverride = dayOverrides.length > 0;

  // 计算当天课程（SPEC V2：每格直接列课程名+时间）
  const dayCourses = useMemo(() => {
    return resolveDayCourses(
      courses,
      dayOverrides,
      periods,
      dayOfWeek,
      week
    ).filter((dc) => !dc.cancelled);
  }, [courses, dayOverrides, periods, dayOfWeek, week]);

  const visibleCourses = dayCourses.slice(0, MAX_COURSES_PER_CELL);
  const hiddenCount = dayCourses.length - visibleCourses.length;

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-h-[100px] cursor-pointer border-r border-b p-1 transition-colors hover:bg-accent/40",
        !isCurrentMonth && "bg-muted/20 opacity-50",
        today && "bg-primary/5 ring-1 ring-inset ring-primary/30"
      )}
    >
      {/* 日期数字 + 调课角标 */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
            today
              ? "bg-primary text-primary-foreground"
              : isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          {d.getDate()}
        </span>
        {/* 临时调课角标（SPEC V2：有临时调课的日期格角标显示小圆点提示） */}
        {hasOverride && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" title="有临时调课" />
        )}
      </div>

      {/* 课程列表（SPEC V2：每格直接列出当天课程名+时间） */}
      <div className="flex flex-col gap-0.5">
        {visibleCourses.map((dc) => (
          <CourseItem key={dc.course.id + (dc.isOverride ? "-ov" : "")} dc={dc} />
        ))}
        {/* 截断提示（SPEC V2：高度不足时显示"+N 节"） */}
        {hiddenCount > 0 && (
          <span className="px-1 text-[10px] text-muted-foreground">
            +{hiddenCount} 节
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 课程项（月视图紧凑显示）
// ============================================================

/** 月视图课程项：色点 + 开始时间 + 科目名 */
function CourseItem({ dc }: { dc: DisplayCourse }) {
  const color = dc.course.color || hashColor(dc.course.subject);
  return (
    <div
      className="flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-[10px]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="shrink-0 text-muted-foreground">
        {dc.startTime.slice(0, 5)}
      </span>
      <span className="truncate font-medium" style={{ color }}>
        {dc.course.subject}
      </span>
    </div>
  );
}
