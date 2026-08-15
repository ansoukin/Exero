/**
 * 任务工作流面板（Beta9 · 任务18 方案 C）
 *
 * 合并原 TodayTasks + QuickActionsPanel，消除内容重叠。
 *
 * 布局：已启用指令列表，每行 = 图标 + 名称 + 描述 + 已启用标签 + 运行按钮
 * 解决原"今日任务预览"和"快捷动作"都显示同一份已启用指令的问题。
 */
import { Zap, Loader2, Play, Loader, Workflow } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AutomationFlow } from "@/lib/tauri";
import { EASE_FLUENT } from "@/components/ui/motion";

interface WorkflowPanelProps {
  flows: AutomationFlow[];
  loading: boolean;
  /** 当前正在执行的 flow id */
  executingId: string | null;
  /** 执行指定 flow */
  onExecute: (flowId: string) => void;
}

export function WorkflowPanel({
  flows,
  loading,
  executingId,
  onExecute,
}: WorkflowPanelProps) {
  // 仅显示已启用指令，按名称排序
  const enabledFlows = flows
    .filter((f) => f.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className="liquid-glass flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          任务工作流
        </CardTitle>
        <CardDescription>已启用指令 · 一键运行</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : enabledFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Workflow className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">暂无已启用的指令</p>
            <p className="mt-1 text-xs">前往「快捷指令」页创建并启用指令</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {enabledFlows.map((flow, idx) => {
              const isExecuting = executingId === flow.id;
              return (
                <motion.li
                  key={flow.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: EASE_FLUENT,
                    delay: Math.min(idx * 0.03, 0.3),
                  }}
                  className="group flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:scale-105">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isExecuting}
                    onClick={() => onExecute(flow.id)}
                    className="h-8 w-8 shrink-0"
                    title={isExecuting ? "运行中" : "运行"}
                  >
                    {isExecuting ? (
                      <Loader className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Play className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
