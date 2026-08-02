/**
 * 控制流类动作表单（3 种）
 *
 * - IfElse：条件分支（condition 表达式）
 * - Loop：循环（count + var_name）
 * - SetVariable：变量赋值（name + value + global）
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import {
  boolValue,
  numValue,
  strValue,
  updateField,
} from "@/pages/quickactions/forms/helpers";

// ============================================================
// IfElse：条件分支
// ============================================================
function IfElseForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">条件表达式 *</Label>
        <Input
          value={(params.condition as string) || ""}
          onChange={(e) => onChange(updateField(params, "condition", strValue(e)))}
          placeholder='{volume} > 50'
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
        <p className="font-medium">语法说明：</p>
        <ul className="mt-1 space-y-0.5">
          <li>变量用 {"{name}"} 引用</li>
          <li>支持运算符：&gt; &lt; &gt;= &lt;= == !=</li>
          <li>示例：{"{volume} > 50"} / {"{count} == 3"} / {"{mode} == \"silent\""}</li>
        </ul>
        <p className="mt-1.5 font-medium">分支连接：</p>
        <p className="mt-0.5">从节点底部 then / else 端口拖出连线到子节点</p>
      </div>
    </div>
  );
}

// ============================================================
// Loop：循环
// ============================================================
function LoopForm({ params, onChange }: ActionFormProps) {
  const mode = params.count === null || params.count === undefined ? "infinite" : "count";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">循环模式</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            if (v === "infinite") onChange({ ...params, count: null });
            else onChange({ ...params, count: params.count ?? 3 });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">指定次数</SelectItem>
            <SelectItem value="infinite">无限循环（需内部 break）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "count" && (
        <div className="space-y-1.5">
          <Label className="text-xs">循环次数</Label>
          <Input
            type="number"
            min={0}
            value={(params.count as number) ?? 3}
            onChange={(e) => onChange(updateField(params, "count", Math.max(0, numValue(e))))}
            className="h-8 text-xs"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">循环变量名（可选）</Label>
        <Input
          value={(params.var_name as string) || ""}
          onChange={(e) => onChange(updateField(params, "var_name", strValue(e)))}
          placeholder="i / index / counter"
          className="h-8 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          设置后可在循环体内用 {"{var_name}"} 引用当前迭代序号（0-based）
        </p>
      </div>
      <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
        <p className="font-medium">循环体连接：</p>
        <p className="mt-0.5">从节点底部 body 端口拖出连线到循环体内第一个子节点</p>
      </div>
    </div>
  );
}

// ============================================================
// SetVariable：变量赋值
// ============================================================
function SetVariableForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">变量名 *</Label>
        <Input
          value={(params.name as string) || ""}
          onChange={(e) => onChange(updateField(params, "name", strValue(e)))}
          placeholder="volume / mode / counter"
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">值 *</Label>
        <Input
          value={(params.value as string) || ""}
          onChange={(e) => onChange(updateField(params, "value", strValue(e)))}
          placeholder='50 / silent / {other_var}'
          className="h-8 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          支持 {"{other_var}"} 模板插值引用其他变量
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.global}
          onChange={(e) => onChange(updateField(params, "global", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        全局变量（默认局部，仅当前 Flow 内可见）
      </label>
    </div>
  );
}

// ============================================================
// 导出
// ============================================================
export const ControlFlowForms = {
  IfElse: IfElseForm,
  Loop: LoopForm,
  SetVariable: SetVariableForm,
};
