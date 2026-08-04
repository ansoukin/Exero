import { CalendarClock, Zap, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AutomationFlow } from "@/lib/tauri";

interface TodayTasksProps {
  flows: AutomationFlow[];
  loading: boolean;
}

/**
 * 今日任务预览（SPEC 3.5.1 模块 1）
 *
 * Phase 2：列出已启用的快捷指令作为今日任务预览。
 * Phase 3 时间轴实现后，将结合 Cron 触发器按时间排序展示今日具体触发时刻。
 */
export function TodayTasks({ flows, loading }: TodayTasksProps) {
  // 仅显示已启用的指令，按名称排序
  const enabledFlows = flows
    .filter((f) => f.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          今日任务预览
        </CardTitle>
        <CardDescription>
          已启用的快捷指令
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : enabledFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Zap className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">暂无已启用的指令</p>
            <p className="mt-1 text-xs">
              前往「快捷指令」页创建并启用指令
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {enabledFlows.map((flow) => (
              <li
                key={flow.id}
                className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {flow.name}
                  </span>
                  {flow.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {flow.description}
                    </span>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  已启用
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
