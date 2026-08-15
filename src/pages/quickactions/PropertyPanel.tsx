import { useState } from "react";
import type { Node } from "@xyflow/react";
import { Trash2, Clock, PanelRightClose, PanelRightOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PackIcon } from "@/components/PackIcon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionTypeKind } from "@/lib/tauri";
import { getCategoryColor, getNodeMeta, isTriggerKind } from "@/lib/nodeCatalog";
import type { ActionNodeData } from "@/pages/quickactions/graphTransform";
import { ActionFormRegistry } from "@/pages/quickactions/forms";
import { TriggerForm } from "@/pages/quickactions/forms/triggerForm";

interface PropertyPanelProps {
  /** 当前选中的节点数据（null 表示未选中） */
  selectedNode: { id: string; data: ActionNodeData } | null;
  /** 画布全部节点（用于未选中时查找触发器节点显示其配置） */
  nodes: Node<ActionNodeData>[];
  /** 参数变更回调 */
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  /** 备注变更回调 */
  onNoteChange: (nodeId: string, note: string | null) => void;
  /** 容错策略变更回调 */
  onFaultStrategyChange: (nodeId: string, strategy: string | null) => void;
  /** 删除节点 */
  onDelete: (nodeId: string) => void;
  /** 面板是否折叠 */
  collapsed: boolean;
  /** 切换折叠/展开 */
  onToggleCollapse: () => void;
}

/**
 * 属性面板（右栏，SPEC 3.5 可视化编辑器三栏布局之三）
 *
 * Beta9 · 任务1：触发器节点支持
 * - 选中触发器节点 → 显示触发器配置表单（TriggerForm）
 * - 未选中任何节点 → 默认显示第一个触发器节点的配置（常驻）
 * - 选中动作节点 → 显示动作专属表单 + 容错策略 + 备注（原有逻辑）
 *
 * Beta6：折叠/展开 width 过渡动画（200ms，与侧边栏一致），头部按钮统一。
 */
export function PropertyPanel({
  selectedNode,
  nodes,
  onParamsChange,
  onNoteChange,
  onFaultStrategyChange,
  onDelete,
  collapsed,
  onToggleCollapse,
}: PropertyPanelProps) {
  const id = selectedNode?.id ?? "";
  const data = selectedNode?.data ?? null;
  const meta = data ? getNodeMeta(data.kind) : null;
  const Icon = meta?.icon;
  const isTrigger = data ? isTriggerKind(data.kind) : false;
  const FormCmp =
    data && !isTrigger ? ActionFormRegistry[data.kind as ActionTypeKind] : null;

  // 未选中时：查找第一个触发器节点，常驻显示其配置
  const firstTrigger = !data
    ? nodes.find((n) => isTriggerKind(n.data.kind)) ?? null
    : null;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-l bg-card transition-[width] duration-200 ease-in-out",
        collapsed ? "w-12" : "w-72",
      )}
    >
      {/* 折叠态（Beta9 任务11）：隐藏全部面板内容，仅右侧垂直居中一个圆形单按钮，
       * 点击从右侧弹出面板；选中积木自动展开规则由 FlowEditor 控制（不变） */}
      {collapsed ? (
        <div className="flex flex-1 items-center justify-center py-2">
          <button
            onClick={onToggleCollapse}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent interactive"
            title="展开属性面板"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        </div>
      ) : (
      <>
      {/* 头部：展开时显示当前编辑对象 + 折叠按钮 */}
      <div
        className={cn(
          "flex items-center border-b gap-2 px-4 py-3",
        )}
      >
        {!collapsed && data && (
          <>
            {Icon && (
              <div className={`flex h-7 w-7 items-center justify-center rounded ${meta ? getCategoryColor(meta.category) : ""}`}>
                {typeof Icon === "string" ? (
                  <PackIcon spec={Icon} size={16} />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{data.label}</p>
              <p className="text-[10px] text-muted-foreground">{data.kind}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(id)}
              title="删除节点"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {!collapsed && !data && firstTrigger && (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">时间触发配置</p>
              <p className="text-[10px] text-muted-foreground">未选中节点时默认显示</p>
            </div>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onToggleCollapse}
          title="折叠属性面板"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* 展开内容 */}
      {!collapsed && (
        data ? (
          isTrigger ? (
            // 选中触发器节点：显示触发器配置表单
            <div className="flex-1 overflow-y-auto scrollbar-fluent">
              <div className="space-y-4 p-4">
                <TriggerForm
                  params={data.params}
                  onChange={(params) => onParamsChange(id, params)}
                />
              </div>
            </div>
          ) : (
            // 选中动作节点：显示动作专属表单 + 容错策略 + 备注
            <div className="flex-1 overflow-y-auto scrollbar-fluent">
              <div className="space-y-4 p-4">
                {FormCmp ? (
                  <FormCmp
                    params={data.params}
                    onChange={(params) => onParamsChange(id, params)}
                  />
                ) : (
                  <FallbackJsonForm
                    params={data.params}
                    onChange={(params) => onParamsChange(id, params)}
                  />
                )}

                {/* 公共字段：容错策略 */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium">容错策略</Label>
                  <Select
                    value={data.faultStrategy ?? "__inherit__"}
                    onValueChange={(v) =>
                      onFaultStrategyChange(id, v === "__inherit__" ? null : v)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__inherit__">继承 Flow 默认</SelectItem>
                      <SelectItem value="Continue">继续</SelectItem>
                      <SelectItem value="Stop">停止</SelectItem>
                      <SelectItem value="Rollback">回滚</SelectItem>
                      <SelectItem value="Notify">通知</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 公共字段：备注 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">备注</Label>
                  <Textarea
                    value={data.note ?? ""}
                    onChange={(e) => onNoteChange(id, e.target.value || null)}
                    placeholder="可选..."
                    className="min-h-[60px] text-xs"
                  />
                </div>
              </div>
            </div>
          )
        ) : firstTrigger ? (
          // 未选中节点：常驻显示第一个触发器节点的配置
          <div className="flex-1 overflow-y-auto scrollbar-fluent">
            <div className="space-y-4 p-4">
              <TriggerForm
                params={firstTrigger.data.params}
                onChange={(params) => onParamsChange(firstTrigger.id, params)}
              />
            </div>
          </div>
        ) : (
          <EmptyState />
        )
      )}
      </>
      )}
    </aside>
  );
}

/** 空状态：未选中节点且无触发器节点 */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
      <Clock className="mb-2 h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">从左侧拖入「时间触发」开始</p>
      <p className="mt-1 text-xs">触发器是动作链的起点，配置后到点自动执行</p>
    </div>
  );
}

/** 兜底 JSON 表单（未注册专属表单的节点类型使用） */
function FallbackJsonForm({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(JSON.stringify(params, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">参数（JSON）</Label>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setError(null);
            onChange(parsed);
          } catch (err) {
            setError(err instanceof Error ? err.message : "JSON 解析错误");
          }
        }}
        className="min-h-[120px] font-mono text-xs"
      />
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
