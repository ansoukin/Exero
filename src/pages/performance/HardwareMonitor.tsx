/**
 * 硬件监控面板（SPEC 3.6 页面 4）
 *
 * 展示 CPU 使用率（总体 + 各核心）/ 内存（已用/可用/总量）/ 温度（占位待 LHB 集成）。
 * 数据由父组件 Performance.tsx 统一轮询，通过 props 传入。
 */

import { Cpu, MemoryStick, Thermometer, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HardwareStatus } from "@/lib/tauri";

interface HardwareMonitorProps {
  hardware: HardwareStatus | null;
  loading: boolean;
  error: string | null;
}

/** 字节格式化为 GB */
function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb.toFixed(1);
}

/** 根据使用率返回颜色 */
function usageColor(usage: number): string {
  if (usage >= 80) return "bg-red-500";
  if (usage >= 50) return "bg-amber-500";
  return "bg-emerald-500";
}

/** 根据使用率返回文字颜色 */
function usageText(usage: number): string {
  if (usage >= 80) return "text-red-500";
  if (usage >= 50) return "text-amber-500";
  return "text-emerald-500";
}

/** 进度条 */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-500", className)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function HardwareMonitor({ hardware, loading, error }: HardwareMonitorProps) {
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

  const memUsagePercent = hardware.memory.total_bytes > 0
    ? (hardware.memory.used_bytes / hardware.memory.total_bytes) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* CPU + 内存 双卡片 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* CPU 卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-primary" />
              CPU
            </CardTitle>
            <CardDescription className="truncate text-xs">
              {hardware.cpu.name || "未知型号"} · {hardware.cpu.core_count} 核心
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 总体使用率 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">总体使用率</span>
                <span className={cn("font-mono font-semibold", usageText(hardware.cpu.overall_usage))}>
                  {hardware.cpu.overall_usage.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={hardware.cpu.overall_usage}
                className={usageColor(hardware.cpu.overall_usage)}
              />
            </div>
            {/* 各核心使用率（紧凑网格） */}
            {hardware.cpu.core_usages.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground">各核心</div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                  {hardware.cpu.core_usages.map((usage, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-center text-[9px] text-muted-foreground">
                        {i + 1}
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", usageColor(usage))}
                          style={{ width: `${Math.min(100, usage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 内存卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MemoryStick className="h-4 w-4 text-primary" />
              内存
            </CardTitle>
            <CardDescription className="text-xs">
              已用 {formatBytes(hardware.memory.used_bytes)} GB / 共{" "}
              {formatBytes(hardware.memory.total_bytes)} GB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">使用率</span>
                <span className={cn("font-mono font-semibold", usageText(memUsagePercent))}>
                  {memUsagePercent.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={memUsagePercent}
                className={usageColor(memUsagePercent)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-muted/50 py-1.5">
                <div className="text-muted-foreground">已用</div>
                <div className="font-mono font-semibold">
                  {formatBytes(hardware.memory.used_bytes)}
                </div>
              </div>
              <div className="rounded-md bg-muted/50 py-1.5">
                <div className="text-muted-foreground">可用</div>
                <div className="font-mono font-semibold">
                  {formatBytes(hardware.memory.available_bytes)}
                </div>
              </div>
              <div className="rounded-md bg-muted/50 py-1.5">
                <div className="text-muted-foreground">总量</div>
                <div className="font-mono font-semibold">
                  {formatBytes(hardware.memory.total_bytes)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 温度卡片（Phase 4 占位，待 LHB 集成） */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Thermometer className="h-4 w-4 text-primary" />
            温度监控
          </CardTitle>
          <CardDescription className="text-xs">
            待集成 LibreHardwareMonitorLib（未来版本）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {hardware.temperatures.map((temp) => (
              <div
                key={temp.component}
                className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-center"
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {temp.component}
                </div>
                <div className="mt-1 font-mono text-sm text-muted-foreground/60">
                  — °C
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
