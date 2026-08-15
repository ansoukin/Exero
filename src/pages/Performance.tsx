/**
 * 性能优化页面（SPEC 3.6 页面 4）
 *
 * Phase 4 实现：
 * - 硬件监控（CPU/内存/温度占位待 LHB 集成）
 * - 进程列表 Top 20（按 CPU/内存排序）
 * - 进程优化操作（优先级调整 + 结束进程确认弹窗）
 * - 一键优化（结束黑名单 + 降级高 CPU + 清理内存）
 *
 * 硬件状态由本组件统一轮询（2 秒一次），传给 HardwareMonitor 展示。
 * ProcessList 自管理轮询（3 秒一次），OptimizePanel 由用户触发。
 */

import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import { HardwareMonitor } from "@/pages/performance/HardwareMonitor";
import { ProcessList } from "@/pages/performance/ProcessList";
import { OptimizePanel } from "@/pages/performance/OptimizePanel";
import {
  performanceCommands,
  type HardwareStatus,
} from "@/lib/tauri";

export default function PerformancePage() {
  const [hardware, setHardware] = useState<HardwareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHardware = useCallback(async () => {
    try {
      const data = await performanceCommands.getHardwareStatus();
      setHardware(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // 硬件状态轮询：2 秒一次
  // 注意 sysinfo 首次 refresh 后 CPU 使用率为 0，第二次起才准确，前端首次轮询可能显示 0%
  useEffect(() => {
    loadHardware();
    const timer = setInterval(loadHardware, 2000);
    return () => clearInterval(timer);
  }, [loadHardware]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 scrollbar-fluent">
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <Gauge className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">性能优化</h1>
      </div>

      {/* 硬件监控（上方四卡片 · Beta9 任务3） */}
      <HardwareMonitor hardware={hardware} loading={loading} error={error} />

      {/* 一键优化 */}
      <OptimizePanel />

      {/* 进程列表 */}
      <ProcessList />
    </div>
  );
}
