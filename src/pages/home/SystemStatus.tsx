import { useEffect, useState } from "react";
import { Cpu, MemoryStick, AlertCircle, Activity } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { performanceCommands, type HardwareStatus } from "@/lib/tauri";

/**
 * 系统状态卡片（SPEC 3.5 页面 1 模块 3）
 *
 * Phase 4：接入真实硬件监控数据（复用 performanceCommands.getHardwareStatus）。
 * 2 秒轮询，展示 CPU 总体使用率 + 内存使用率（首页简化版，详细数据见性能优化页）。
 */
export function SystemStatus() {
  const [hardware, setHardware] = useState<HardwareStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await performanceCommands.getHardwareStatus();
        if (!cancelled) {
          setHardware(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const timer = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const cpuUsage = hardware?.cpu.overall_usage ?? 0;
  const memUsed = hardware?.memory.used_bytes ?? 0;
  const memTotal = hardware?.memory.total_bytes ?? 0;
  const memUsage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            系统状态
          </CardTitle>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              hardware
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hardware
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-muted-foreground",
              )}
            />
            {hardware ? "实时" : "加载中"}
          </span>
        </div>
        <CardDescription className="text-xs">
          {hardware
            ? `${hardware.cpu.name || "CPU"} · ${hardware.cpu.core_count} 核心`
            : "正在采集硬件数据..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {/* CPU 使用率 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              CPU
            </span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                cpuUsage >= 80
                  ? "text-red-500"
                  : cpuUsage >= 50
                    ? "text-amber-500"
                    : "text-emerald-500",
              )}
            >
              {hardware ? `${cpuUsage.toFixed(1)}%` : "— %"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                cpuUsage >= 80
                  ? "bg-red-500"
                  : cpuUsage >= 50
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, cpuUsage)}%` }}
            />
          </div>
        </div>

        {/* 内存使用率 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" />
              内存
            </span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                memUsage >= 80
                  ? "text-red-500"
                  : memUsage >= 50
                    ? "text-amber-500"
                    : "text-emerald-500",
              )}
            >
              {hardware
                ? `${(memUsed / 1024 / 1024 / 1024).toFixed(1)} / ${(memTotal / 1024 / 1024 / 1024).toFixed(1)} GB`
                : "— / — GB"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                memUsage >= 80
                  ? "bg-red-500"
                  : memUsage >= 50
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, memUsage)}%` }}
            />
          </div>
        </div>

        {/* 错误提示（内联，不破坏卡片布局） */}
        {error && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">数据获取失败</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
