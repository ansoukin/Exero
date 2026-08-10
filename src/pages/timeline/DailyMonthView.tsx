/**
 * 日常模式月视图（Beta6 Phase 4）
 *
 * 6×7 日历网格（周一为首），每格显示当天触发块的色点 + 总数（粗略信息）。
 * - 每格：日期数字 + 前几个触发块的小色点 + "+N" 提示
 * - 点击格点钻取周视图
 * - 月份导航（上/下月、今天）
 *
 * 不依赖学期概念，仅基于 selectedDate 推算显示月份。
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTimelineStore } from "@/stores/timeline";
import type { TriggerBlock } from "./dailyTypes";
import {
  MONTH_LABELS,
  WEEKDAY_SHORT_MON_FIRST,
  isToday,
  monthGrid,
  toIsoDate,
} from "./utils";

/** 默认色板（与 DailyTimelineView/CourseBlock 一致） */
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
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

/** 每格最多显示的色点数（超出显示 "+N"） */
const MAX_DOTS_PER_CELL = 4;

interface DailyMonthViewProps {
  /** 基于已加载数据解析指定日期的触发块 */
  getBlocksForDate: (date: string) => TriggerBlock[];
  /** 点击某天 → 钻取周视图 */
  onDayClick?: (date: string) => void;
}

export function DailyMonthView({
  getBlocksForDate,
  onDayClick,
}: DailyMonthViewProps) {
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setView = useTimelineStore((s) => s.setView);

  // 月视图内部维护当前显示的年月
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

  // 预解析网格中每天的触发块（仅计算长度和色点，粗略信息）
  const dayBlocksMap = useMemo(() => {
    const map = new Map<string, TriggerBlock[]>();
    for (const date of grid) {
      map.set(date, getBlocksForDate(date));
    }
    return map;
  }, [grid, getBlocksForDate]);

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

  /** 点击日期格 → 钻取周视图 */
  function handleDayClick(date: string) {
    setSelectedDate(date);
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
        {grid.map((date) => {
          const d = new Date(date + "T00:00:00");
          const isCurrentMonth = d.getMonth() === viewMonth;
          const today = isToday(date);
          const blocks = dayBlocksMap.get(date) || [];
          const visibleDots = blocks.slice(0, MAX_DOTS_PER_CELL);
          const hiddenCount = blocks.length - visibleDots.length;

          return (
            <div
              key={date}
              onClick={() => handleDayClick(date)}
              className={cn(
                "min-h-[100px] cursor-pointer border-r border-b p-1 transition-colors hover:bg-accent/40",
                !isCurrentMonth && "bg-muted/20 opacity-50",
                today && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              {/* 日期数字 */}
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
                {blocks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {blocks.length}
                  </span>
                )}
              </div>

              {/* 色点列表（粗略信息） */}
              <div className="flex flex-wrap gap-0.5">
                {visibleDots.map((block) => {
                  const color = block.flowColor || hashColor(block.flowName);
                  return (
                    <span
                      key={block.id}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                      title={`${block.time} ${block.flowName}`}
                    />
                  );
                })}
                {hiddenCount > 0 && (
                  <span className="text-[9px] leading-none text-muted-foreground">
                    +{hiddenCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
