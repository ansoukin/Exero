import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import { getCategoryBarColor, getCategoryColor, getNodeMeta } from "@/lib/nodeCatalog";
import { PackIcon } from "@/components/PackIcon";
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
        "group relative w-52 rounded-lg border bg-card shadow-sm transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40 hover:shadow-md",
      )}
    >
      {/* 类别色竖条（Beta9 任务13：左侧 3px 类别标识，一眼区分节点类型）
       * 注：不能用 overflow-hidden 裁剪，否则端口（Handle）突出卡片的半圆被裁掉 */}
      <div
        className={cn(
          "absolute bottom-0 left-0 top-0 w-[3px] rounded-l-lg",
          meta ? getCategoryBarColor(meta.category) : "bg-border",
        )}
      />

      {/* 输入端口（top，hover 放大增强连接反馈） */}
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground/60 transition-transform duration-150 hover:scale-125"
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
            {typeof Icon === "string" ? (
              <PackIcon spec={Icon} size={14} />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
          </div>
        )}
        <span className="truncate text-sm font-medium">{nodeData.label}</span>
      </div>

      {/* 参数摘要（分支节点底部预留胶囊标签条空间 pb-8） */}
      <div className={cn("px-3 pt-2", isBranchNode(nodeData.kind) ? "pb-8" : "pb-2")}>
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

/** 是否分支类节点（底部带胶囊标签条，需额外下内边距） */
function isBranchNode(kind: ActionNodeData["kind"]): boolean {
  return kind === "IfElse" || kind === "Loop";
}

/**
 * 分支端口（B9 第三阶段任务3：内嵌胶囊标签）
 *
 * 彩色胶囊标签嵌在卡片内部底边（中文：满足/否则/循环体/触发），
 * 端口圆点保持卡片底边边缘不动——连线布局与执行引擎零影响。
 */
function BranchPort({
  id,
  label,
  chipColor,
  handleColor,
  side,
}: {
  id: string;
  label: string;
  chipColor: string;
  handleColor: string;
  side: "left" | "center" | "right";
}) {
  const sideCls =
    side === "left"
      ? "left-1/4 -translate-x-1/2"
      : side === "right"
        ? "right-1/4 translate-x-1/2"
        : "left-1/2 -translate-x-1/2";
  return (
    <div className={`absolute bottom-0 ${sideCls}`}>
      <span
        className={`absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none text-white shadow-sm ${chipColor}`}
      >
        {label}
      </span>
      <Handle
        id={id}
        type="source"
        position={Position.Bottom}
        className={`!h-3 !w-3 !border-2 !border-background transition-transform duration-150 hover:scale-125 ${handleColor}`}
      />
    </div>
  );
}

/**
 * 根据节点类型渲染输出端口
 *
 * - 普通节点：单个 bottom 居中
 * - IfElse：bottom 两个（then 满足居左 / else 否则居右），胶囊标签嵌卡片内
 * - Loop：单个 bottom 居中，胶囊标签 "循环体"
 */
function renderOutputHandles(kind: ActionNodeData["kind"]) {
  if (kind === "IfElse") {
    return (
      <>
        <BranchPort id="then" label="满足" chipColor="bg-emerald-500" handleColor="!bg-emerald-500" side="left" />
        <BranchPort id="else" label="否则" chipColor="bg-rose-500" handleColor="!bg-rose-500" side="right" />
      </>
    );
  }

  if (kind === "Loop") {
    return (
      <BranchPort id="body" label="循环体" chipColor="bg-amber-500" handleColor="!bg-amber-500" side="center" />
    );
  }

  return (
    <Handle
      id="out"
      type="source"
      position={Position.Bottom}
      className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground/60 transition-transform duration-150 hover:scale-125"
    />
  );
}

export const ActionNodeView = memo(ActionNodeViewImpl);

/**
 * 触发器节点视图（Beta9 · 任务1）
 *
 * 触发器节点是动作链的视觉起点，无输入端口，单输出端口 triggered。
 * 视觉与动作节点区分：primary 色边框 + primary/5 头部背景。
 */
function TriggerNodeViewImpl({ data, selected }: NodeProps) {
  const nodeData = data as ActionNodeData;
  const meta = getNodeMeta(nodeData.kind);
  const Icon = meta?.icon;

  return (
    <div
      className={cn(
        "group relative w-52 rounded-lg border bg-card shadow-sm transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-primary/40 hover:border-primary/60 hover:shadow-md",
      )}
    >
      {/* 节点头部：图标 + 标题（触发器用 primary 色调强调） */}
      <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-2">
        {Icon && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-primary">
            {typeof Icon === "string" ? (
              <PackIcon spec={Icon} size={14} />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
          </div>
        )}
        <span className="truncate text-sm font-medium">{nodeData.label}</span>
      </div>

      {/* 参数摘要（底部预留胶囊标签条空间） */}
      <div className="px-3 pt-2 pb-8">
        <p className="truncate text-xs text-muted-foreground">
          {nodeData.summary || "未配置"}
        </p>
      </div>

      {/* 输出端口 triggered（无输入端口，触发器是起点；胶囊标签"触发"） */}
      <BranchPort
        id="triggered"
        label="触发"
        chipColor="bg-primary"
        handleColor="!bg-primary"
        side="center"
      />
    </div>
  );
}

export const TriggerNodeView = memo(TriggerNodeViewImpl);
