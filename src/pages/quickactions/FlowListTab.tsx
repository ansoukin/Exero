import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FlowCard, NewFlowCard } from "@/pages/quickactions/FlowCard";
import { FlowEditor } from "@/pages/quickactions/FlowEditor";
import {
  flowCommands,
  type AutomationFlow,
} from "@/lib/tauri";
import { useQuickActionsStore } from "@/stores/quickactions";

/**
 * 指令列表 Tab（SPEC 3.5 页面 3 第 1 Tab）
 *
 * 两种视图：
 * - list：卡片网格展示所有指令
 * - editor：可视化编辑器（点击卡片进入，返回回到列表）
 */
export function FlowListTab() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const view = useQuickActionsStore((s) => s.view);
  const editingFlowId = useQuickActionsStore((s) => s.editingFlowId);
  const setEditingFlow = useQuickActionsStore((s) => s.setEditingFlow);
  const clearEditing = useQuickActionsStore((s) => s.clearEditing);

  async function loadFlows() {
    setLoading(true);
    setError(null);
    try {
      const data = await flowCommands.list();
      setFlows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlows();
  }, []);

  // 编辑器视图：渲染独立的全屏编辑器
  if (view === "editor" && editingFlowId) {
    return <FlowEditor flowId={editingFlowId} onExit={clearEditing} />;
  }

  // 列表视图
  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-muted-foreground">
          共 {flows.length} 条指令
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          新建指令
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">加载失败：{error}</span>
          <Button variant="ghost" size="sm" onClick={loadFlows}>
            重试
          </Button>
        </div>
      )}

      {/* 卡片网格 */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : flows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Plus className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">还没有指令</p>
            <p className="mt-1 text-xs">点击"新建指令"创建第一条自动化流程</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {flows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onEdit={setEditingFlow}
                onChanged={loadFlows}
              />
            ))}
            <NewFlowCard onClick={handleCreate} />
          </div>
        )}
      </div>
    </div>
  );

  async function handleCreate() {
    try {
      const name = `新指令 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
      const flow = await flowCommands.create({ name });
      await loadFlows();
      // 创建后直接进入编辑器
      setEditingFlow(flow.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
}
