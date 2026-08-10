/**
 * 日常模式周视图（Beta6 Phase 4）
 *
 * 基于当前选中日期所在周，7 列展示每天的触发块（粗略信息）。
 * - 表头：周几 + 日期，点击钻取日视图
 * - 每列：当天触发块列表（时间 + flow 名 + 色点）
 * - 今天高亮
 * - 右键触发块弹出操作菜单（与日视图一致）
 *
 * 不依赖学期概念，周首日为周一（与校园模式一致）。
 */

import { useMemo } from "react";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTimelineStore } from "@/stores/timeline";
import type { TriggerBlock } from "./dailyTypes";
import {
  WEEKDAY_SHORT,
  getWeekday,
  isToday,
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

/** 每列最多显示的触发块数（超出显示 "+N"） */
const MAX_BLOCKS_PER_DAY = 8;

interface DailyWeekViewProps {
  /** 基于已加载数据解析指定日期的触发块 */
  getBlocksForDate: (date: string) => TriggerBlock[];
  /** 右键触发块（弹出操作菜单） */
  onBlockContextMenu?: (block: TriggerBlock, pos: { x: number; y: number }) => void;
  /** 点击某天表头 → 钻取日视图 */
  onDayClick?: (date: string) => void;
}

/**
 * 计算指定 ISO 日期所在周（周一为首）的 7 天日期
 *
 * 不依赖学期开始日期，直接基于日期推算本周周一。
 */
function currentWeekDates(selectedDate: string): string[] {
  const d = new Date(selectedDate + "T00:00:00");
  const day = d.getDay(); // 0=周日 ... 6=周六
  // 回退到本周周一（周日 0 → -6 天，周一 1 → 0 天，周二 2 → -1 天...）
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offsetToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return toIsoDate(date);
  });
}

export function DailyWeekView({
  getBlocksForDate,
  onBlockContextMenu,
  onDayClick,
}: DailyWeekViewProps) {
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setView = useTimelineStore((s) => s.setView);

  const dates = useMemo(
    () => currentWeekDates(selectedDate),
    [selectedDate]
  );

  // 按日期预解析每天的触发块
  const dayBlocksMap = useMemo(() => {
    const map = new Map<string, TriggerBlock[]>();
    for (const date of dates) {
      map.set(date, getBlocksForDate(date));
    }
    return map;
  }, [dates, getBlocksForDate]);

  /** 点击表头 → 钻取日视图 */
  function handleDayHeaderClick(date: string) {
    setSelectedDate(date);
    setView("day");
    onDayClick?.(date);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-fluent">
        <div className="min-w-[700px]">
          {/* 表头：周一到周日 */}
          <div className="sticky top-0 z-20 grid grid-cols-7 border-b bg-card">
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

          {/* 主体：7 列触发块 */}
          <div className="grid grid-cols-7">
            {dates.map((date, dayIdx) => {
              const blocks = dayBlocksMap.get(date) || [];
              const today = isToday(date);
              const visible = blocks.slice(0, MAX_BLOCKS_PER_DAY);
              const hiddenCount = blocks.length - visible.length;

              return (
                <div
                  key={`col-${dayIdx}-${date}`}
                  className={cn(
                    "min-h-[200px] space-y-1 border-r border-b p-1.5",
                    today && "bg-primary/5"
                  )}
                >
                  {blocks.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground/50">
                      无
                    </div>
                  ) : (
                    <>
                      {visible.map((block) => {
                        const color = block.flowColor || hashColor(block.flowName);
                        return (
                          <div
                            key={block.id}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onBlockContextMenu?.(block, {
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-sm border-l-2 px-1.5 py-1 text-xs transition-colors hover:bg-accent/40",
                              !block.enabled && "opacity-50"
                            )}
                            style={{ borderLeftColor: color }}
                            title={`${block.time} ${block.flowName}`}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="shrink-0 text-muted-foreground">
                              {block.time}
                            </span>
                            <span
                              className="truncate font-medium"
                              style={{ color }}
                            >
                              {block.flowName}
                            </span>
                          </div>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <div className="px-1.5 text-[10px] text-muted-foreground">
                          +{hiddenCount} 项
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 空状态提示（整周无任何触发） */}
          {dates.every((d) => (dayBlocksMap.get(d) || []).length === 0) && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Zap className="h-10 w-10 opacity-30" />
              <p className="text-sm">本周无定时触发</p>
              <p className="text-xs">创建含 Cron 触发器的快捷指令后将显示在此</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
