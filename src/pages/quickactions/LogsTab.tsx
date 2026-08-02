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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  executionCommands,
  flowCommands,
  type AutomationFlow,
  type ExecutionLog,
  type ExecutionStatus,
} from "@/lib/tauri";

type Filter = "all" | "success" | "failed";

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
        <Button variant="ghost" size="sm" onClick={loadLogs} className="gap-1">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          刷新
        </Button>
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
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <History className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">暂无执行记录</p>
            <p className="mt-1 text-xs">执行指令后此处显示结果</p>
          </div>
        ) : (
          <ul className="divide-y">
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
