/**
 * Lua 脚本动作表单
 *
 * Phase 5 升级：
 * - script_id 从已安装脚本列表选择（Select）
 * - 根据脚本 manifest 的 params_schema 动态生成参数表单
 * - 超时保留可配置
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { numValue, strValue, updateField } from "@/pages/quickactions/forms/helpers";
import {
  luaCommands,
  type InstalledScript,
  type ScriptParam,
} from "@/lib/tauri";

function LuaScriptForm({ params, onChange }: ActionFormProps) {
  const [installed, setInstalled] = useState<InstalledScript[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载已安装脚本列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await luaCommands.listInstalled();
        if (!cancelled) setInstalled(data);
      } catch (e) {
        console.error("加载已安装脚本失败", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scriptId = (params.script_id as string) || "";

  // 当前选中脚本的 manifest
  const selectedScript = useMemo(
    () => installed.find((s) => s.script_id === scriptId) ?? null,
    [installed, scriptId],
  );

  // 选中脚本变化时，按 params_schema 初始化 args（补缺失字段的默认值）
  useEffect(() => {
    if (!selectedScript) return;
    const currentArgs = (params.args as Record<string, unknown>) ?? {};
    const needsInit = selectedScript.params_schema.some(
      (p) => currentArgs[p.name] === undefined,
    );
    if (needsInit) {
      const newArgs: Record<string, unknown> = {};
      for (const p of selectedScript.params_schema) {
        newArgs[p.name] = currentArgs[p.name] ?? p.default;
      }
      onChange(updateField(params, "args", newArgs));
    }
    // 仅在 scriptId 或 selectedScript 变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, selectedScript]);

  /** 更新单个 arg 字段 */
  function updateArg(name: string, value: unknown) {
    const args = (params.args as Record<string, unknown>) ?? {};
    onChange(updateField(params, "args", { ...args, [name]: value }));
  }

  return (
    <div className="space-y-3">
      {/* 脚本选择 */}
      <div className="space-y-1.5">
        <Label className="text-xs">脚本 *</Label>
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            加载已安装脚本...
          </div>
        ) : installed.length === 0 ? (
          <div className="rounded-md bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-400">
            尚未安装任何脚本，请到"Lua 脚本市场"Tab 安装
          </div>
        ) : (
          <Select
            value={scriptId || "__none__"}
            onValueChange={(v) =>
              onChange(updateField(params, "script_id", v === "__none__" ? "" : v))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择已安装脚本" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">（未选择）</SelectItem>
              {installed.map((s) => (
                <SelectItem key={s.script_id} value={s.script_id}>
                  {s.name} (v{s.version})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 脚本信息（选中后显示） */}
      {selectedScript && (
        <div className="rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">
          <p>
            {selectedScript.description || "（无描述）"}
          </p>
          {selectedScript.permissions.length > 0 && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              需宽松沙箱：{selectedScript.permissions.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* 动态参数表单（根据 manifest params_schema 生成） */}
      {selectedScript && selectedScript.params_schema.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">脚本参数</Label>
          {selectedScript.params_schema.map((param) => (
            <ParamField
              key={param.name}
              param={param}
              value={(params.args as Record<string, unknown>)?.[param.name]}
              onChange={(v) => updateArg(param.name, v)}
            />
          ))}
        </div>
      )}

      {/* 超时 */}
      <div className="space-y-1.5">
        <Label className="text-xs">超时（秒，留空用默认 10 秒）</Label>
        <Input
          type="number"
          min={1}
          value={typeof params.timeout_secs === "number" ? params.timeout_secs : ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Math.max(1, numValue(e));
            onChange(updateField(params, "timeout_secs", v));
          }}
          placeholder="10"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

/** 单个参数字段（根据 type 渲染不同控件） */
function ParamField({
  param,
  value,
  onChange,
}: {
  param: ScriptParam;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <Label className="text-xs">
      {param.label}
      {param.required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );

  if (param.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`param-${param.name}`}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-input"
        />
        {label}
      </div>
    );
  }

  if (param.type === "select") {
    return (
      <div className="space-y-1">
        {label}
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择..." />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (param.type === "number") {
    return (
      <div className="space-y-1">
        {label}
        <Input
          type="number"
          value={value === undefined || value === null ? "" : Number(value)}
          onChange={(e) => {
            const v = e.target.value === "" ? null : numValue(e);
            onChange(v);
          }}
          className="h-8 text-xs"
        />
      </div>
    );
  }

  // 默认 string
  return (
    <div className="space-y-1">
      {label}
      <Input
        value={String(value ?? "")}
        onChange={(e) => onChange(strValue(e))}
        className="h-8 text-xs"
      />
    </div>
  );
}

export { LuaScriptForm };
