/**
 * 进程列表（SPEC 3.6 页面 4）
 *
 * Top 20 进程展示，支持按 CPU/内存排序切换。
 * 每行支持调整优先级（5 档 Select）和结束进程（确认弹窗防误杀）。
 *
 * 数据自管理轮询（3 秒一次），排序变化触发立即刷新。
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  performanceCommands,
  priorityLabel,
  ALL_PRIORITIES,
  type ProcessInfo,
  type ProcessPriority,
  type ProcessSortBy,
} from "@/lib/tauri";

/** 字节格式化为 MB/GB */
function formatMemory(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

/** CPU 使用率颜色 */
function cpuColor(usage: number): string {
  if (usage >= 50) return "text-red-500";
  if (usage >= 20) return "text-amber-500";
  return "text-emerald-500";
}

export function ProcessList() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProcessSortBy>("cpu");
  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);
  const [killing, setKilling] = useState(false);
  const [priorityLoading, setPriorityLoading] = useState<number | null>(null);

  const loadProcesses = useCallback(
    async (currentSort: ProcessSortBy) => {
      try {
        const data = await performanceCommands.listProcesses(currentSort, 20);
        setProcesses(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 初次加载 + 轮询（3 秒）
  useEffect(() => {
    setLoading(true);
    loadProcesses(sortBy);
    const timer = setInterval(() => loadProcesses(sortBy), 3000);
    return () => clearInterval(timer);
  }, [sortBy, loadProcesses]);

  // 排序切换立即刷新
  const handleSortChange = (value: ProcessSortBy) => {
    setSortBy(value);
    setLoading(true);
    loadProcesses(value);
  };

  // 调整优先级
  const handlePriorityChange = async (pid: number, priority: ProcessPriority) => {
    setPriorityLoading(pid);
    try {
      await performanceCommands.setProcessPriority(pid, priority);
      // 更新本地状态（避免等下次轮询）
      setProcesses((prev) =>
        prev.map((p) => (p.pid === pid ? { ...p, priority } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPriorityLoading(null);
    }
  };

  // 确认结束进程
  const handleConfirmKill = async () => {
    if (!killTarget) return;
    setKilling(true);
    try {
      await performanceCommands.killProcess(killTarget.pid);
      setProcesses((prev) => prev.filter((p) => p.pid !== killTarget.pid));
      setKillTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setKilling(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              进程列表（Top 20）
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* 排序维度切换 */}
              <Select
                value={sortBy}
                onValueChange={(v) => handleSortChange(v as ProcessSortBy)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu">按 CPU 排序</SelectItem>
                  <SelectItem value="memory">按内存排序</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setLoading(true);
                  loadProcesses(sortBy);
                }}
                title="刷新"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* 表头 */}
          <div className="grid grid-cols-[2fr_70px_70px_90px_120px_70px] gap-2 border-b bg-muted/40 px-4 py-2 text-[10px] font-medium uppercase text-muted-foreground">
            <span>进程名</span>
            <span className="text-right">PID</span>
            <span className="text-right">CPU%</span>
            <span className="text-right">内存</span>
            <span className="text-center">优先级</span>
            <span className="text-center">操作</span>
          </div>

          {/* 进程行 */}
          <div className="max-h-[420px] overflow-y-auto scrollbar-fluent">
            {loading && processes.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : processes.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                暂无进程数据
              </div>
            ) : (
              processes.map((proc) => (
                <div
                  key={proc.pid}
                  className="grid grid-cols-[2fr_70px_70px_90px_120px_70px] items-center gap-2 border-b px-4 py-2 text-xs transition-colors hover:bg-muted/40"
                >
                  {/* 进程名 */}
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={proc.name}>
                      {proc.name}
                    </div>
                    {proc.command && (
                      <div className="truncate text-[10px] text-muted-foreground" title={proc.command}>
                        {proc.command}
                      </div>
                    )}
                  </div>
                  {/* PID */}
                  <span className="text-right font-mono text-muted-foreground">
                    {proc.pid}
                  </span>
                  {/* CPU% */}
                  <span className={cn("text-right font-mono font-semibold", cpuColor(proc.cpu_usage))}>
                    {proc.cpu_usage.toFixed(1)}
                  </span>
                  {/* 内存 */}
                  <span className="text-right font-mono text-muted-foreground">
                    {formatMemory(proc.memory_bytes)}
                  </span>
                  {/* 优先级 Select */}
                  <div className="flex justify-center">
                    <Select
                      value={proc.priority}
                      onValueChange={(v) => handlePriorityChange(proc.pid, v as ProcessPriority)}
                      disabled={priorityLoading === proc.pid}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityLabel(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 结束按钮 */}
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setKillTarget(proc)}
                      title="结束进程"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 结束进程确认弹窗（防误杀） */}
      <Dialog open={!!killTarget} onOpenChange={(open) => !open && setKillTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              确认结束进程
            </DialogTitle>
            <DialogDescription>
              结束进程可能导致未保存的数据丢失。确定要结束以下进程吗？
            </DialogDescription>
          </DialogHeader>
          {killTarget && (
            <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm">
              <div className="font-medium">{killTarget.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                PID: {killTarget.pid} · CPU: {killTarget.cpu_usage.toFixed(1)}% · 内存:{" "}
                {formatMemory(killTarget.memory_bytes)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillTarget(null)} disabled={killing}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmKill} disabled={killing}>
              {killing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  结束中...
                </>
              ) : (
                "确认结束"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
