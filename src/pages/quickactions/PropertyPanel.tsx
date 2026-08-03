import { useState } from "react";
import { Trash2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCategoryColor, getNodeMeta } from "@/lib/nodeCatalog";
import type { ActionNodeData } from "@/pages/quickactions/graphTransform";
import { ActionFormRegistry } from "@/pages/quickactions/forms";

interface PropertyPanelProps {
  /** 当前选中的节点数据（null 表示未选中） */
  selectedNode: { id: string; data: ActionNodeData } | null;
  /** 参数变更回调 */
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  /** 备注变更回调 */
  onNoteChange: (nodeId: string, note: string | null) => void;
  /** 容错策略变更回调 */
  onFaultStrategyChange: (nodeId: string, strategy: string | null) => void;
  /** 删除节点 */
  onDelete: (nodeId: string) => void;
}

/**
 * 属性面板（右栏，SPEC 3.5 可视化编辑器三栏布局之三）
 *
 * SPEC 308 行：单击选中节点 → 右侧属性面板自动展示该节点表单（实时编辑）。
 * 表单内容根据节点类型动态渲染（ActionFormRegistry 注册 20 种专属表单）。
 */
export function PropertyPanel({
  selectedNode,
  onParamsChange,
  onNoteChange,
  onFaultStrategyChange,
  onDelete,
}: PropertyPanelProps) {
  if (!selectedNode) {
    return <EmptyState />;
  }

  const { id, data } = selectedNode;
  const meta = getNodeMeta(data.kind);
  const Icon = meta?.icon;
  const FormCmp = ActionFormRegistry[data.kind];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-card">
      {/* 头部：节点类型信息 */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded ${meta ? getCategoryColor(meta.category) : ""}`}>
            <Icon className="h-4 w-4" />
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
      </div>

      {/* 表单内容（滚动区） */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        <div className="space-y-4 p-4">
          {/* 类型专属参数表单 */}
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
          <div className="space-y-2 border-t pt-3">
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
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-medium">备注</Label>
            <Textarea
              value={data.note ?? ""}
              onChange={(e) =>
                onNoteChange(id, e.target.value || null)
              }
              placeholder="可选..."
              className="min-h-[60px] text-xs"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** 空状态：未选中节点 */
function EmptyState() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-card">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
        <Settings2 className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">未选中节点</p>
        <p className="mt-1 text-xs">单击画布节点查看并编辑属性</p>
      </div>
    </aside>
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
