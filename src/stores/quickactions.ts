import { create } from "zustand";

/**
 * 快捷指令页面状态（Phase 4 可视化编辑器）
 *
 * 管理指令列表 Tab 与可视化编辑器之间的切换：
 * - list：指令列表视图（卡片网格）
 * - editor：可视化编辑器视图（React Flow 三栏布局）
 *
 * 进入编辑器：setEditingFlow(flowId)
 * 返回列表：clearEditing()
 */

type QuickActionsView = "list" | "editor";

interface QuickActionsState {
  /** 当前视图 */
  view: QuickActionsView;
  /** 正在编辑的 Flow ID（仅 editor 视图有效） */
  editingFlowId: string | null;

  /** 进入编辑器编辑指定 Flow */
  setEditingFlow: (flowId: string) => void;
  /** 返回指令列表 */
  clearEditing: () => void;
}

export const useQuickActionsStore = create<QuickActionsState>((set) => ({
  view: "list",
  editingFlowId: null,

  setEditingFlow: (flowId) =>
    set({ view: "editor", editingFlowId: flowId }),
  clearEditing: () => set({ view: "list", editingFlowId: null }),
}));
