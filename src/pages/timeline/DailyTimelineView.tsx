/**
 * 日常模式日视图（Beta6 Phase 4）
 *
 * 纵向时间轴 7:00-22:00 + 只读触发块按 HH:mm 定位。
 * - 每小时 56px（与校园模式 DayView 一致）
 * - 触发块显示快捷指令名称 + 触发时间
 * - 右键触发块弹出操作菜单（编辑/删除 flow）
 * - 无拖拽编辑（只读模式）
 */

import { useMemo } from "react";
import { Clock, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TriggerBlock } from "./dailyTypes";
import {
  DAILY_START_MIN,
  DAILY_END_MIN,
  DAILY_HOUR_HEIGHT,
  DAILY_TOTAL_HEIGHT,
  blockTopPx,
} from "./dailyTypes";

/** 默认色板（与 CourseBlock 一致，flow.color 为空时按名称 hash 分配） */
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

interface DailyTimelineViewProps {
  /** 触发块列表（已按时间排序） */
  blocks: TriggerBlock[];
  /** 加载中 */
  loading?: boolean;
  /** 右键触发块（弹出操作菜单） */
  onBlockContextMenu?: (block: TriggerBlock, pos: { x: number; y: number }) => void;
}

/**
 * 日常模式日视图
 *
 * 纵向时间轴，每小时一格，左侧显示小时标签。
 * 触发块按 time 字段定位，高度固定（不反映时长，仅标记触发点）。
 */
export function DailyTimelineView({
  blocks,
  loading,
  onBlockContextMenu,
}: DailyTimelineViewProps) {
  // 生成小时刻度（7:00, 8:00, ..., 22:00）
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = DAILY_START_MIN / 60; h <= DAILY_END_MIN / 60; h++) {
      list.push(h);
    }
    return list;
  }, []);

  return (
    <div className="relative flex-1 overflow-y-auto scrollbar-fluent">
      {/*
        单滚动容器：左侧刻度 + 时间轴块在同一滚动区域内，垂直同步。
        内容总高 = 顶部 buffer(20) + 时间轴(840) + 底部 buffer(40) = 900px。
        buffer 确保首块(7:00)和末块(22:00)完整可见且可滚动到。
      */}
      <div
        className="relative"
        style={{ height: DAILY_TOTAL_HEIGHT + 60 }}
      >
        {/*
          左侧小时刻度列：absolute 定位，宽度 48px，背景层。
          刻度文字垂直对齐时间点，随容器滚动（因在滚动容器内）。
        */}
        <div className="absolute left-0 top-0 z-10 h-full w-12 border-r bg-card/30">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
              style={{ top: 20 + (h - DAILY_START_MIN / 60) * DAILY_HOUR_HEIGHT }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/*
          时间轴主体：左边距 48px 给刻度列让位。
          水平刻度线 + 触发块都在此层，absolute 定位。
        */}
        <div className="absolute left-12 right-2 top-0 bottom-0">
          {/* 水平刻度线（每小时一条） */}
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/40"
              style={{ top: 20 + (h - DAILY_START_MIN / 60) * DAILY_HOUR_HEIGHT }}
            />
          ))}

          {/* 加载状态 */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              加载触发时间...
            </div>
          )}

          {/* 空状态 */}
          {!loading && blocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Zap className="h-12 w-12 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">今日无定时触发</p>
                <p className="mt-1 text-xs">
                  创建含 Cron 触发器的快捷指令后，触发时间将显示在此
                </p>
              </div>
            </div>
          )}

          {/* 触发块 */}
          {blocks.map((block) => {
            const color = block.flowColor || hashColor(block.flowName);
            // 块顶部对齐时间点，加 20px buffer 避免首块贴边被遮挡
            const top = 20 + blockTopPx(block.minutes);

            return (
              <div
                key={block.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onBlockContextMenu?.(block, { x: e.clientX, y: e.clientY });
                }}
                className={cn(
                  "group absolute left-0 right-0 flex items-center gap-2 rounded-md border-l-4 px-3 py-2 transition-colors",
                  "bg-card/80 hover:bg-card cursor-default",
                  !block.enabled && "opacity-50"
                )}
                style={{
                  top,
                  height: 40,
                  borderLeftColor: color,
                }}
              >
                <Zap
                  className="h-4 w-4 shrink-0"
                  style={{ color }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {block.flowName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {block.time}
                  </span>
                </div>
                {!block.enabled && (
                  <span className="text-xs text-muted-foreground">已禁用</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
