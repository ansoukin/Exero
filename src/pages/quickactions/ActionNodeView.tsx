import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import { getCategoryColor, getNodeMeta } from "@/lib/nodeCatalog";
import type { ActionNodeData } from "@/pages/quickactions/graphTransform";

/**
 * 自定义节点组件（Phase 4 可视化编辑器）
 *
 * SPEC 3.5 可视化编辑器：
 * - 卡片式节点：图标 + 标题 + 参数摘要 + 输入/输出端口
 * - 贝塞尔曲线连线（React Flow 默认）
 * - 单击选中 → 右侧属性面板自动展示
 *
 * 端口布局：
 * - 输入端口：top（Handle id="in"）
 * - 输出端口：
 *   - 普通节点：bottom（Handle id="out"）
 *   - IfElse：bottom 两个（id="then" / id="else"，水平错开）
 *   - Loop：bottom（id="body"）
 */
function ActionNodeViewImpl({ data, selected }: NodeProps) {
  const nodeData = data as ActionNodeData;
  const meta = getNodeMeta(nodeData.kind);
  const Icon = meta?.icon;

  return (
    <div
      className={cn(
        "relative w-52 rounded-lg border bg-card shadow-sm transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      {/* 输入端口（top） */}
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground/60"
      />

      {/* 节点头部：图标 + 类别色 + 标题 */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {Icon && (
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded",
              meta ? getCategoryColor(meta.category) : "",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="truncate text-sm font-medium">{nodeData.label}</span>
      </div>

      {/* 参数摘要 */}
      <div className="px-3 py-2">
        <p className="truncate text-xs text-muted-foreground">
          {nodeData.summary || "未配置"}
        </p>
        {nodeData.note && (
          <p className="mt-1 truncate text-[10px] italic text-muted-foreground/70">
            备注：{nodeData.note}
          </p>
        )}
      </div>

      {/* 输出端口 */}
      {renderOutputHandles(nodeData.kind)}
    </div>
  );
}

/**
 * 根据节点类型渲染输出端口
 *
 * - 普通节点：单个 bottom 居中
 * - IfElse：bottom 两个（then 居左 / else 居右），带标签
 * - Loop：单个 bottom 居中，标签 "body"
 */
function renderOutputHandles(kind: ActionNodeData["kind"]) {
  if (kind === "IfElse") {
    return (
      <>
        <div className="absolute bottom-0 left-1/4 -translate-x-1/2">
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-emerald-600">
            then
          </span>
          <Handle
            id="then"
            type="source"
            position={Position.Bottom}
            className="!h-3 !w-3 !border-2 !border-background !bg-emerald-500"
          />
        </div>
        <div className="absolute bottom-0 right-1/4 translate-x-1/2">
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-rose-600">
            else
          </span>
          <Handle
            id="else"
            type="source"
            position={Position.Bottom}
            className="!h-3 !w-3 !border-2 !border-background !bg-rose-500"
          />
        </div>
      </>
    );
  }

  if (kind === "Loop") {
    return (
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-amber-600">
          body
        </span>
        <Handle
          id="body"
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-background !bg-amber-500"
        />
      </div>
    );
  }

  return (
    <Handle
      id="out"
      type="source"
      position={Position.Bottom}
      className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground/60"
    />
  );
}

export const ActionNodeView = memo(ActionNodeViewImpl);
