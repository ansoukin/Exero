import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Save, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  settingCommands,
  SettingKeys,
} from "@/lib/tauri";

/**
 * 自动化设置 Tab（SPEC 3.5 页面 3 第 3 Tab）
 *
 * 全局默认值（默认音量 / 重试策略 / 并发数限制 / 串行或并发模式 / 日志保留条数等）。
 * 单条指令可在编辑器中覆盖。
 */
export function AutomationSettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载所有设置
  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const all = await settingCommands.getAll();
      const map: Record<string, string> = {};
      for (const s of all) map[s.key] = s.value;
      setSettings(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  // 保存单条设置
  async function saveSetting(key: string, value: string, valueType: string) {
    setSaving(true);
    setError(null);
    try {
      await settingCommands.set({ key, value, value_type: valueType });
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-fluent">
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* 默认音量 */}
        <Section title="默认音量" description="SetVolume 动作未指定音量时使用此值">
          <NumberField
            value={settings[SettingKeys.automationDefaultVolume] ?? "50"}
            onSave={(v) =>
              saveSetting(SettingKeys.automationDefaultVolume, v, "number")
            }
            saving={saving}
            min={0}
            max={100}
          />
        </Section>

        {/* Lua 脚本超时 */}
        <Section title="Lua 脚本超时" description="Lua 脚本执行超时时间（秒）">
          <NumberField
            value={settings[SettingKeys.automationLuaTimeoutSecs] ?? "10"}
            onSave={(v) =>
              saveSetting(SettingKeys.automationLuaTimeoutSecs, v, "number")
            }
            saving={saving}
            min={1}
            max={300}
          />
        </Section>

        {/* 日志保留条数 */}
        <Section title="日志保留条数" description="超过此数量的旧日志将被自动清理">
          <NumberField
            value={settings[SettingKeys.automationLogRetention] ?? "100"}
            onSave={(v) =>
              saveSetting(SettingKeys.automationLogRetention, v, "number")
            }
            saving={saving}
            min={10}
            max={10000}
          />
        </Section>

        {/* 并发模式 */}
        <Section title="并发模式" description="多条指令同时触发时的执行策略">
          <SelectField
            value={settings[SettingKeys.automationConcurrencyMode] ?? "parallel"}
            options={[
              { value: "parallel", label: "并发（同时执行）" },
              { value: "serial", label: "串行（排队执行）" },
            ]}
            onSave={(v) =>
              saveSetting(SettingKeys.automationConcurrencyMode, v, "string")
            }
            saving={saving}
          />
        </Section>

        {/* 保存状态指示 */}
        {saved && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            已保存
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b pb-4 last:border-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberField({
  value,
  onSave,
  saving,
  min,
  max,
}: {
  value: string;
  onSave: (value: string) => void;
  saving: boolean;
  min?: number;
  max?: number;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={local}
        min={min}
        max={max}
        onChange={(e) => setLocal(e.target.value)}
        className="h-8 w-32 text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={saving || local === value}
        onClick={() => onSave(local)}
        className="h-8 gap-1"
      >
        <Save className="h-3 w-3" />
        保存
      </Button>
    </div>
  );
}

function SelectField({
  value,
  options,
  onSave,
  saving,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={local}
        onValueChange={(v) => {
          setLocal(v);
          onSave(v);
        }}
      >
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
