/**
 * 硬件监控面板（Beta9 · 任务3 重做）
 *
 * 参考 NexBox HardwarePage 的 StatCard 设计，精简为四卡片：
 * CPU / GPU / 内存 / 存储，每卡片含图标+标题+大数值+副数值+底部 recharts 折线趋势图。
 *
 * 历史数据：组件内部维护 60 点滚动窗口（约 2 分钟，2 秒轮询），
 * 每次 hardware props 更新时 push 一个采样点。
 */

import { useEffect, useState, type ComponentType } from "react";
import { Cpu, Monitor, MemoryStick, Database, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Sparkline, pushPoint } from "@/components/ui/Sparkline";
import type { HardwareStatus } from "@/lib/tauri";

interface HardwareMonitorProps {
  hardware: HardwareStatus | null;
  loading: boolean;
  error: string | null;
}

/** 历史数据状态 */
interface HistoryState {
  cpu: number[];
  gpu: number[];
  mem: number[];
  storage: number[];
}

/** 字节格式化为 GB */
function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb.toFixed(1);
}

/** 百分比格式化（null 显示"--"） */
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(0)}%`;
}

/** 四卡片配置色（参考 NexBox） */
const COLORS = {
  cpu: "#3b82f6",
  gpu: "#22c55e",
  memory: "#06b6d4",
  storage: "#a855f7",
};

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  /** 型号名（独立行小字，可截断，可选） */
  model?: string;
  color: string;
  history: number[];
  gradId: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

/** 统计卡片：图标+标题+型号+大数值+副数值+底部折线趋势图 */
function StatCard({ title, value, subValue, model, color, history, gradId, icon: Icon }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        {/* 型号名（Beta9 任务10：CPU/GPU 型号显示） */}
        {model && (
          <div
            className="mt-0.5 truncate text-xs text-muted-foreground/80"
            title={model}
          >
            {model}
          </div>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          <span className="text-xs text-muted-foreground">{subValue}</span>
        </div>
        <div className="mt-2">
          <Sparkline data={history} color={color} gradId={gradId} />
        </div>
      </CardContent>
    </Card>
  );
}

export function HardwareMonitor({ hardware, loading, error }: HardwareMonitorProps) {
  const [history, setHistory] = useState<HistoryState>({
    cpu: [],
    gpu: [],
    mem: [],
    storage: [],
  });

  // hardware 更新时追加历史采样点
  useEffect(() => {
    if (!hardware) return;
    const memPercent =
      hardware.memory.total_bytes > 0
        ? (hardware.memory.used_bytes / hardware.memory.total_bytes) * 100
        : 0;
    const storagePercent =
      hardware.storage.total_bytes > 0
        ? (hardware.storage.used_bytes / hardware.storage.total_bytes) * 100
        : 0;
    setHistory((prev) => ({
      cpu: pushPoint(prev.cpu, hardware.cpu.overall_usage),
      gpu: pushPoint(prev.gpu, hardware.gpu.usage ?? 0),
      mem: pushPoint(prev.mem, memPercent),
      storage: pushPoint(prev.storage, storagePercent),
    }));
  }, [hardware]);

  if (loading && !hardware) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载硬件数据中...
      </div>
    );
  }

  if (error && !hardware) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          硬件数据加载失败：{error}
        </CardContent>
      </Card>
    );
  }

  if (!hardware) return null;

  const memPercent =
    hardware.memory.total_bytes > 0
      ? (hardware.memory.used_bytes / hardware.memory.total_bytes) * 100
      : 0;
  const storagePercent =
    hardware.storage.total_bytes > 0
      ? (hardware.storage.used_bytes / hardware.storage.total_bytes) * 100
      : 0;

  // Beta9 任务10：LHM 是否就绪（GPU name 非空说明 LHM 读取成功）
  const lhmReady = !!hardware.gpu.name;
  // GPU 副数值：温度优先，其次显存，最后占位
  const gpuSubValue = hardware.gpu.temperature !== null
    ? `${hardware.gpu.temperature.toFixed(0)}°C`
    : hardware.gpu.used_memory_bytes !== null && hardware.gpu.total_memory_bytes !== null
      ? `${formatBytes(hardware.gpu.used_memory_bytes)} / ${formatBytes(hardware.gpu.total_memory_bytes)} GB`
      : lhmReady
        ? "--"
        : "LHM 未就绪";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="CPU"
          value={formatPercent(hardware.cpu.overall_usage)}
          subValue={`${hardware.cpu.core_count} 核心`}
          model={hardware.cpu.name || undefined}
          color={COLORS.cpu}
          history={history.cpu}
          gradId="grad-cpu"
          icon={Cpu}
        />
        <StatCard
          title="GPU"
          value={formatPercent(hardware.gpu.usage)}
          subValue={gpuSubValue}
          model={hardware.gpu.name || "未检测到 GPU"}
          color={COLORS.gpu}
          history={history.gpu}
          gradId="grad-gpu"
          icon={Monitor}
        />
        <StatCard
          title="内存"
          value={formatPercent(memPercent)}
          subValue={`${formatBytes(hardware.memory.used_bytes)} / ${formatBytes(hardware.memory.total_bytes)} GB`}
          color={COLORS.memory}
          history={history.mem}
          gradId="grad-mem"
          icon={MemoryStick}
        />
        <StatCard
          title="存储"
          value={formatPercent(storagePercent)}
          subValue={`${formatBytes(hardware.storage.used_bytes)} / ${formatBytes(hardware.storage.total_bytes)} GB`}
          color={COLORS.storage}
          history={history.storage}
          gradId="grad-storage"
          icon={Database}
        />
      </div>

      {/* GPU 占位提示（Beta9 任务10：LHM 资源缺失时显示根因 + 解决方案） */}
      {!lhmReady && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          <span className="font-medium">GPU 数据不可用：</span>
          LHM 子进程未启动。根因：<code className="mx-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono">NexBoxMonitor.exe</code>
          及依赖 DLL（共 12 个文件）被 <code className="mx-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono">.gitignore</code> 的
          <code className="mx-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono">*.exe / *.dll</code> 规则排除入库。
          请从 NexBox 项目 <code className="mx-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono">src-tauri/resources/monitor/</code>
          复制这些二进制资源到 Exero 同名目录后重启应用。
        </div>
      )}
    </div>
  );
}
