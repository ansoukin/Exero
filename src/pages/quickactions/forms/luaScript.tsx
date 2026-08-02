/**
 * Lua 脚本动作表单
 *
 * SPEC Phase 5 才集成 mlua 与脚本市场，Phase 4 阶段此表单仅提供基础字段编辑。
 * 用户可手动填入 script_id（Phase 5 上线后从市场选择）。
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import { numValue, strValue, updateField } from "@/pages/quickactions/forms/helpers";

function LuaScriptForm({ params, onChange }: ActionFormProps) {
  const argsText = (() => {
    try {
      return JSON.stringify(params.args ?? {}, null, 2);
    } catch {
      return "{}";
    }
  })();

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">脚本 ID *</Label>
        <Input
          value={(params.script_id as string) || ""}
          onChange={(e) => onChange(updateField(params, "script_id", strValue(e)))}
          placeholder="Phase 5 上线后从市场选择"
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">脚本参数（JSON）</Label>
        <Textarea
          value={argsText}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(updateField(params, "args", parsed));
            } catch {
              // 解析失败时不更新，允许用户继续编辑
            }
          }}
          className="min-h-[80px] text-xs font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">超时（秒，留空用默认 10 秒）</Label>
        <Input
          type="number"
          min={1}
          value={params.timeout_secs ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Math.max(1, numValue(e));
            onChange(updateField(params, "timeout_secs", v));
          }}
          placeholder="10"
          className="h-8 text-xs"
        />
      </div>
      <div className="rounded-md bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-400">
        <p className="font-medium">Phase 5 待实现</p>
        <p className="mt-0.5">Lua 脚本市场与执行引擎将在 Phase 5 集成</p>
      </div>
    </div>
  );
}

export { LuaScriptForm };
