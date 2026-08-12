import { useState } from "react";
import { Trash2, Settings2, PanelRightClose, PanelRightOpen } from "lucide-react";

import { cn } from "@/lib/utils";
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
  /** 面板是否折叠 */
  collapsed: boolean;
  /** 切换折叠/展开 */
  onToggleCollapse: () => void;
}

/**
 * 属性面板（右栏，SPEC 3.5 可视化编辑器三栏布局之三）
 *
 * SPEC 308 行：单击选中节点 → 右侧属性面板自动展示该节点表单（实时编辑）。
 * 表单内容根据节点类型动态渲染（ActionFormRegistry 注册 20 种专属表单）。
 *
 * Beta6：折叠/展开 width 过渡动画（200ms，与侧边栏一致），头部按钮统一。
 */
export function PropertyPanel({
  selectedNode,
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
  const FormCmp = data ? ActionFormRegistry[data.kind] : null;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-l bg-card transition-[width] duration-200 ease-in-out",
        collapsed ? "w-10" : "w-72",
      )}
    >
      {/* 头部：折叠时仅居中切换按钮；展开时选中节点显示图标+标签+删除按钮 */}
      <div
        className={cn(
          "flex items-center border-b",
          collapsed ? "justify-center px-0 py-2" : "gap-2 px-4 py-3",
        )}
      >
        {!collapsed && data && (
          <>
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
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onToggleCollapse}
          title={collapsed ? "展开属性面板" : "折叠属性面板"}
        >
          {collapsed ? (
            <PanelRightOpen className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 展开内容：选中节点显示表单，未选中显示空状态 */}
      {!collapsed && (
        data ? (
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
                  onChange={(e) =>
                    onNoteChange(id, e.target.value || null)
                  }
                  placeholder="可选..."
                  className="min-h-[60px] text-xs"
                />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState />
        )
      )}
    </aside>
  );
}

/** 空状态：未选中节点 */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
      <Settings2 className="mb-2 h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">未选中节点</p>
      <p className="mt-1 text-xs">单击画布节点查看并编辑属性</p>
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
