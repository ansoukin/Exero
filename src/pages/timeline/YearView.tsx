import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Course } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { MONTH_LABELS } from "./utils";

// ============================================================
// 常量
// ============================================================

/** 密度色深样式（按等级映射背景色透明度） */
const DENSITY_BG: Record<number, string> = {
  0: "bg-transparent",
  1: "bg-primary/10",
  2: "bg-primary/25",
  3: "bg-primary/45",
  4: "bg-primary/70",
};

/** 密度色深文字色（高密度用白字，低密度用主色） */
const DENSITY_TEXT: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-foreground",
  2: "text-foreground",
  3: "text-primary-foreground",
  4: "text-primary-foreground",
};

// ============================================================
// 主组件
// ============================================================

interface YearViewProps {
  /** 学期开始日期（ISO "2026-09-01"），用于高亮学期覆盖的月份 */
  semesterStart: string;
  /** 学期结束日期（ISO "2027-01-20"） */
  semesterEnd: string;
  /** 学期所有课程（计算每月课程密度） */
  courses: Course[];
  /** 点击月格 → 钻取到月视图 */
  onMonthClick?: (year: number, month: number) => void;
}

/**
 * 年视图（SPEC V2 3.5 页面 2）
 *
 * 形态：12 月方格（3×4 布局）+ 课程密度色深（热力图风格）
 * - 每月格显示月份名 + 该月课程总数 + 密度色深背景
 * - 当前学期对应的月份格有边框高亮
 * - 点击月格钻取到月视图（三级导航：年→月→周）
 * - 当前月份格有特殊标记
 *
 * 密度计算：按该月各星期几出现次数 × 对应课程数累加，
 * 再映射到 0-4 五级色深。
 */
export function YearView({
  semesterStart,
  semesterEnd,
  courses,
  onMonthClick,
}: YearViewProps) {
  const currentYear = useTimelineStore((s) => s.currentYear);
  const setCurrentYear = useTimelineStore((s) => s.setCurrentYear);
  const setCurrentMonth = useTimelineStore((s) => s.setCurrentMonth);
  const setView = useTimelineStore((s) => s.setView);

  // 年视图内部独立维护显示年份（允许浏览历史/未来年份）
  const [viewYear, setViewYear] = useState(currentYear);

  function prevYear() {
    setViewYear((y) => y - 1);
  }

  function nextYear() {
    setViewYear((y) => y + 1);
  }

  function goToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setCurrentYear(now.getFullYear());
  }

  /** 点击月格 → 钻取月视图（SPEC V2：三级钻取导航） */
  function handleMonthClick(month: number) {
    setCurrentYear(viewYear);
    setCurrentMonth(month);
    onMonthClick?.(viewYear, month);
    setView("month");
  }

  // 学期覆盖的月份集合（用于边框高亮）
  const semesterMonths = useMemo(() => {
    return getSemesterMonths(semesterStart, semesterEnd, viewYear);
  }, [semesterStart, semesterEnd, viewYear]);

  // 各月课程密度
  const monthDensities = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) =>
      computeMonthCourseCount(viewYear, m, courses)
    );
  }, [viewYear, courses]);

  // 最大课程数（用于密度映射基准）
  const maxCount = Math.max(1, ...monthDensities);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 年份导航 */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h2 className="text-lg font-semibold">{viewYear} 年</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToday} className="h-8">
            今年
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={prevYear}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={nextYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 12 月方格（3×4 布局） */}
      <div className="grid flex-1 grid-cols-4 gap-2 overflow-auto p-4 scrollbar-fluent">
        {monthDensities.map((count, month) => {
          const level = mapDensityLevel(count, maxCount);
          const isSemesterMonth = semesterMonths.has(month);
          const isCurrentMonth =
            viewYear === new Date().getFullYear() &&
            month === new Date().getMonth();

          return (
            <button
              key={month}
              onClick={() => handleMonthClick(month)}
              className={cn(
                "relative flex min-h-[110px] flex-col items-center justify-center rounded-lg border p-3 transition-all hover:scale-[1.02] hover:shadow-md",
                DENSITY_BG[level],
                DENSITY_TEXT[level],
                isSemesterMonth
                  ? "border-primary ring-1 ring-inset ring-primary/40"
                  : "border-border",
                isCurrentMonth && "ring-2 ring-primary"
              )}
            >
              {/* 月份名 */}
              <span className="text-sm font-semibold">
                {MONTH_LABELS[month]}
              </span>

              {/* 课程数 */}
              <span className="mt-1 text-xs opacity-80">
                {count > 0 ? `${count} 节` : "无课"}
              </span>

              {/* 学期标记 */}
              {isSemesterMonth && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}

              {/* 当前月标记 */}
              {isCurrentMonth && (
                <span className="absolute bottom-1.5 text-[10px] font-medium opacity-70">
                  今
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 密度计算工具函数
// ============================================================

/**
 * 计算指定月份的课程总数
 *
 * 算法：该月各星期几（0-6）出现次数 × 该星期几的常规课程数累加。
 * 简化处理：不考虑 week_pattern（all/odd/even）的精确过滤，
 * 按每周都上估算，密度仅供视觉参考。
 *
 * @param year 年
 * @param month 月（0-based）
 * @param courses 学期所有课程
 * @returns 该月预估课程总数
 */
function computeMonthCourseCount(
  year: number,
  month: number,
  courses: Course[]
): number {
  // 该月天数
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 统计该月各星期几出现次数（0=周日 ... 6=周六）
  const weekdayCounts = new Array(7).fill(0);
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(year, month, day).getDay();
    weekdayCounts[weekday]++;
  }

  // 按星期几分组课程数（courses.day_of_week 使用 0=周日 ... 6=周六）
  const coursesByWeekday = new Array(7).fill(0);
  for (const c of courses) {
    if (c.day_of_week >= 0 && c.day_of_week <= 6) {
      coursesByWeekday[c.day_of_week]++;
    }
  }

  // 累加：各星期几次数 × 该星期几课程数
  let total = 0;
  for (let w = 0; w < 7; w++) {
    total += weekdayCounts[w] * coursesByWeekday[w];
  }
  return total;
}

/**
 * 将课程数映射到密度等级（0-4）
 *
 * @param count 该月课程数
 * @param maxCount 全年最大月课程数（基准）
 * @returns 0-4 等级
 */
function mapDensityLevel(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  if (maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

/**
 * 获取学期覆盖的月份集合（指定年份内）
 *
 * @param semesterStart 学期开始 ISO 日期
 * @param semesterEnd 学期结束 ISO 日期
 * @param year 查询年份
 * @returns 该年份内属于学期的月份集合（Set<number>，0-based）
 */
function getSemesterMonths(
  semesterStart: string,
  semesterEnd: string,
  year: number
): Set<number> {
  const result = new Set<number>();
  const start = new Date(semesterStart + "T00:00:00");
  const end = new Date(semesterEnd + "T00:00:00");

  // 遍历该年 12 个月，判断月份是否与学期区间相交
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0); // 该月最后一天
    // 区间相交：monthStart <= end && monthEnd >= start
    if (monthStart <= end && monthEnd >= start) {
      result.add(m);
    }
  }
  return result;
}
