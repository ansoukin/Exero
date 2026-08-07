import { useEffect, useState } from "react";
import {
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  executionCommands,
  flowCommands,
  type AutomationFlow,
  type ExecutionLog,
  type ExecutionStatus,
} from "@/lib/tauri";

type Filter = "all" | "success" | "failed";

/** 清空日志的时间范围选项 */
type ClearRange = "all" | "1h" | "24h" | "7d" | "30d";

const CLEAR_RANGES: { key: ClearRange; label: string }[] = [
  { key: "all", label: "全部记录" },
  { key: "1h", label: "最近 1 小时" },
  { key: "24h", label: "最近 24 小时" },
  { key: "7d", label: "最近 7 天" },
  { key: "30d", label: "最近 30 天" },
];

/** 根据 range 计算时间起点（RFC3339），all 返回 undefined（清空全部）。
 *  返回值为 now - range，SQL 会删除该时间点之后的记录（即最近时间段内的日志）。 */
function computeBefore(range: ClearRange): string | undefined {
  if (range === "all") return undefined;
  const now = Date.now();
  const ms =
    range === "1h"
      ? 3_600_000
      : range === "24h"
        ? 86_400_000
        : range === "7d"
          ? 7 * 86_400_000
          : 30 * 86_400_000;
  return new Date(now - ms).toISOString();
}

/**
 * 执行日志 Tab（SPEC 3.5 页面 3 第 2 Tab）
 *
 * 全部/成功/失败 三级筛选，显示最近执行记录与错误详情。
 * 点击单条日志展开查看错误详情与上下文。
 */
export function LogsTab() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [flows, setFlows] = useState<Map<string, AutomationFlow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 清空日志弹窗状态
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearRange, setClearRange] = useState<ClearRange>("all");
  const [clearing, setClearing] = useState(false);

  /** 确认清空：按所选时间范围调用后端，返回删除条数 */
  async function handleConfirmClear() {
    setClearing(true);
    setError(null);
    try {
      const before = computeBefore(clearRange);
      await executionCommands.clearLogs(before);
      setExpandedId(null);
      setClearDialogOpen(false);
      await loadLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearing(false);
    }
  }

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const [logsData, flowsData] = await Promise.all([
        executionCommands.listLogs({ limit: 200 }),
        flowCommands.list(),
      ]);
      setLogs(logsData);
      setFlows(new Map(flowsData.map((f) => [f.id, f])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "success") return log.status === "Success";
    if (filter === "failed") return log.status === "Failed";
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b py-2">
        <div className="flex gap-1">
          {(["all", "success", "failed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f === "all" ? "全部" : f === "success" ? "成功" : "失败"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadLogs}
            className="gap-1 transition-transform duration-200 active:scale-95"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-500",
                loading && "animate-spin",
              )}
            />
            <span className="transition-colors duration-200">刷新</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            disabled={logs.length === 0}
            className="gap-1 text-destructive transition-transform duration-200 hover:text-destructive active:scale-95 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
            <span className="transition-colors duration-200">清空</span>
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">加载失败：{error}</span>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            重试
          </Button>
        </div>
      )}

      {/* 日志列表 */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto scrollbar-fluent">
        {loading ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex w-full max-w-xs flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <History className="mb-3 h-12 w-12 animate-pulse opacity-30" />
            <p className="text-sm font-medium transition-colors duration-300">
              暂无执行记录
            </p>
            <p className="mt-1 text-xs transition-colors duration-300">
              执行指令后此处显示结果
            </p>
          </div>
        ) : (
          <ul className="w-full divide-y">
            {filtered.map((log) => {
              const { Icon, className } = getStatusVisual(log.status);
              const flow = flows.get(log.flow_id);
              const expanded = expandedId === log.id;
              const hasDetail = !!log.error || !!log.context;
              return (
                <li key={log.id} className="px-2">
                  <button
                    onClick={() =>
                      hasDetail && setExpandedId(expanded ? null : log.id)
                    }
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-accent/50"
                  >
                    {hasDetail ? (
                      expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", className)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {flow?.name || `指令 ${log.flow_id.slice(0, 8)}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateTime(log.started_at)}
                        {log.duration_ms != null && ` · ${log.duration_ms}ms`}
                      </p>
                    </div>
                    <span className={cn("text-xs font-medium", className)}>
                      {statusLabel(log.status)}
                    </span>
                  </button>
                  {/* 展开详情 */}
                  {expanded && hasDetail && (
                    <div className="ml-9 mb-2 space-y-1 rounded-md bg-muted/50 p-2 text-xs">
                      {log.error && (
                        <div>
                          <p className="font-medium text-destructive">错误：</p>
                          <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-destructive">
                            {log.error}
                          </pre>
                        </div>
                      )}
                      {log.context && (
                        <div>
                          <p className="font-medium text-muted-foreground">上下文：</p>
                          <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-muted-foreground">
                            {log.context}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 清空日志确认弹窗 */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              清空执行日志
            </DialogTitle>
            <DialogDescription>
              选择要清除的记录范围，该操作不可撤销。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            {CLEAR_RANGES.map((item) => {
              const active = clearRange === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setClearRange(item.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-input hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      active
                        ? "border-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(false)}
              disabled={clearing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmClear}
              disabled={clearing}
              className="gap-1"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 根据执行状态返回图标与配色 */
function getStatusVisual(status: ExecutionStatus): {
  Icon: React.ComponentType<{ className?: string }>;
  className: string;
} {
  switch (status) {
    case "Success":
      return { Icon: CheckCircle2, className: "text-emerald-500" };
    case "Failed":
      return { Icon: XCircle, className: "text-destructive" };
    case "Running":
    case "Pending":
      return { Icon: Clock, className: "text-blue-500" };
    case "Skipped":
    default:
      return { Icon: Clock, className: "text-muted-foreground" };
  }
}

function statusLabel(status: ExecutionStatus): string {
  return {
    Pending: "待执行",
    Running: "执行中",
    Success: "成功",
    Failed: "失败",
    Skipped: "跳过",
  }[status];
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
