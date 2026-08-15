/**
 * 迷你折线图（Beta9 · 任务18 抽取）
 *
 * 从 HardwareMonitor 内部 Sparkline 抽取为共享组件，
 * 供首页 SystemStatus 等位置复用。
 *
 * recharts AreaChart + 渐变填充，无坐标轴，专注趋势可视化。
 *
 * 同时导出历史采样窗口工具（pushPoint / HISTORY_LEN），
 * 供需要在轮询中维护滚动窗口的组件复用。
 */
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  /** 采样点数组（0-100 等数值） */
  data: number[];
  /** 折线颜色（hex 或 hsl） */
  color: string;
  /** 渐变 id（同一页面多实例需唯一） */
  gradId: string;
  /** 高度（px），默认 40 */
  height?: number;
}

export function Sparkline({ data, color, gradId, height = 40 }: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ height }} />;
  }
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 历史采样窗口长度（约 2 分钟，2 秒轮询 × 60 点） */
export const HISTORY_LEN = 60;

/** 追加采样点并保持窗口长度 */
export function pushPoint(arr: number[], value: number): number[] {
  const next = arr.length >= HISTORY_LEN ? arr.slice(1) : arr.slice();
  next.push(value);
  return next;
}

