import { useEffect, useState } from "react";
import {
  Play,
  Loader2,
  Pencil,
  MoreVertical,
  Zap,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import * as Icons from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  flowCommands,
  triggerCommands,
  executionCommands,
  type AutomationFlow,
} from "@/lib/tauri";

interface FlowCardProps {
  flow: AutomationFlow;
  onEdit: (flowId: string) => void;
  onChanged: () => void;
}

/**
 * 指令卡片（SPEC 3.5 页面 3 指令列表 Tab）
 *
 * 卡片网格单元，展示图标 / 名称 / 触发器数 / 状态开关。
 * 点击卡片进入可视化编辑器；运行按钮一键执行。
 */
export function FlowCard({ flow, onEdit, onChanged }: FlowCardProps) {
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 加载触发器数量
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const triggers = await triggerCommands.list(flow.id);
        if (!cancelled) setTriggerCount(triggers.length);
      } catch {
        if (!cancelled) setTriggerCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flow.id]);

  // 图标解析：flow.icon 存储 lucide 图标名（如 "Zap"），未设置时回退 Zap
  const IconCmp =
    (flow.icon &&
      (Icons as unknown as Record<string, Icons.LucideIcon>)[flow.icon]) ||
    Zap;

  async function handleToggleEnabled() {
    try {
      if (flow.enabled) {
        await flowCommands.disable(flow.id);
      } else {
        await flowCommands.enable(flow.id);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExecute(e: React.MouseEvent) {
    e.stopPropagation();
    setExecuting(true);
    setError(null);
    try {
      await executionCommands.executeFlow(flow.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await flowCommands.delete(flow.id);
      setDeleteOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <Card
      onClick={() => onEdit(flow.id)}
      className={cn(
        "group relative flex cursor-pointer flex-col p-4 transition-all duration-200",
        "hover:border-primary/50 hover:shadow-md",
        flow.enabled ? "border-primary/30" : "opacity-70",
      )}
    >
      {/* 顶部：图标 + 名称 + 操作菜单 */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: flow.color
              ? `${flow.color}20`
              : "hsl(var(--primary) / 0.1)",
            color: flow.color || "hsl(var(--primary))",
          }}
        >
          <IconCmp className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{flow.name}</h3>
          {flow.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {flow.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(flow.id);
            }}
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 底部：触发器数 + 状态开关 + 运行按钮 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{triggerCount} 个触发器</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 状态开关（SPEC：卡片含状态开关） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEnabled();
            }}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
              flow.enabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
            title={flow.enabled ? "点击禁用" : "点击启用"}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                flow.enabled && "translate-x-4",
              )}
            />
          </button>
          <Button
            variant="outline"
            size="sm"
            disabled={executing || !flow.enabled}
            onClick={handleExecute}
            className="h-7 gap-1 px-2 text-xs"
          >
            {executing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            运行
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
    </Card>

    {/* 删除确认弹窗（防误删） */}
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            确认删除指令
          </DialogTitle>
          <DialogDescription>
            删除后不可恢复，指令的所有动作、触发器和执行记录将一并删除。确定要删除以下指令吗？
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <div className="font-medium">{flow.name}</div>
          {flow.description && (
            <div className="mt-1 text-xs text-muted-foreground">
              {flow.description}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              "确认删除"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * 新建指令卡片（占位符样式）
 */
export function NewFlowCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <MoreVertical className="mb-1 h-5 w-5 rotate-45" />
      <span className="text-sm font-medium">新建指令</span>
    </Card>
  );
}
