/**
 * 日常模式年视图（Beta6 Phase 4）
 *
 * 3×4 12 月方格 + 触发密度热力图（粗略信息）。
 * - 每月格显示月份名 + 该月触发总数 + 密度色深背景
 * - 当前月份格特殊标记
 * - 点击月格钻取月视图
 *
 * 密度计算：遍历该月所有天数累加触发块数量，映射到 0-4 五级色深。
 * 性能：全年 365 天 cron-parser 解析，毫秒级可接受。
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTimelineStore } from "@/stores/timeline";
import type { TriggerBlock } from "./dailyTypes";
import { MONTH_LABELS, toIsoDate } from "./utils";

/** 密度色深样式（按等级映射背景色透明度，与校园 YearView 一致） */
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

interface DailyYearViewProps {
  /** 基于已加载数据解析指定日期的触发块 */
  getBlocksForDate: (date: string) => TriggerBlock[];
  /** 点击月格 → 钻取月视图 */
  onMonthClick?: (year: number, month: number) => void;
}

export function DailyYearView({
  getBlocksForDate,
  onMonthClick,
}: DailyYearViewProps) {
  const currentYear = useTimelineStore((s) => s.currentYear);
  const setCurrentYear = useTimelineStore((s) => s.setCurrentYear);
  const setCurrentMonth = useTimelineStore((s) => s.setCurrentMonth);
  const setView = useTimelineStore((s) => s.setView);

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

  /** 点击月格 → 钻取月视图 */
  function handleMonthClick(month: number) {
    setCurrentYear(viewYear);
    setCurrentMonth(month);
    onMonthClick?.(viewYear, month);
    setView("month");
  }

  // 各月触发总数（遍历当月所有天数累加）
  const monthCounts = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) =>
      computeMonthTriggerCount(viewYear, m, getBlocksForDate)
    );
  }, [viewYear, getBlocksForDate]);

  // 最大月触发数（密度映射基准）
  const maxCount = Math.max(1, ...monthCounts);

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
        {monthCounts.map((count, month) => {
          const level = mapDensityLevel(count, maxCount);
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
                "border-border",
                isCurrentMonth && "ring-2 ring-primary"
              )}
            >
              {/* 月份名 */}
              <span className="text-sm font-semibold">
                {MONTH_LABELS[month]}
              </span>

              {/* 触发数 */}
              <span className="mt-1 text-xs opacity-80">
                {count > 0 ? `${count} 次` : "无触发"}
              </span>

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
 * 计算指定月份的触发总数
 *
 * 遍历该月所有天数，累加每天的触发块数量。
 *
 * @param year 年
 * @param month 月（0-based）
 * @param getBlocksForDate 解析函数
 * @returns 该月触发总数
 */
function computeMonthTriggerCount(
  year: number,
  month: number,
  getBlocksForDate: (date: string) => TriggerBlock[]
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toIsoDate(new Date(year, month, day));
    total += getBlocksForDate(date).length;
  }
  return total;
}

/**
 * 将触发数映射到密度等级（0-4）
 *
 * @param count 该月触发数
 * @param maxCount 全年最大月触发数（基准）
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
