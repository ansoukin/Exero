/**
 * OOBE 阶段：快速设置（致敬 Windows 自定义设置）
 *
 * 4 项设置，持久化到 settings 表：
 * - 开机自启（general.autostart）
 * - 关闭主窗口行为（general.close_behavior）
 * - 更新检查频率（update.check_frequency）
 * - 静默更新（update.silent_update，Beta6 新增键，Phase 2 实现功能）
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useOobeStore } from "@/stores/oobe";
import { OobeShell } from "../OobeWizard";
import { settingCommands } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";

type CloseBehavior = "ask" | "minimize" | "exit";
type CheckFrequency = "startup" | "each-startup" | "daily" | "manual";

const CLOSE_BEHAVIORS: { key: CloseBehavior; label: string }[] = [
  { key: "minimize", label: "最小化到托盘" },
  { key: "exit", label: "退出应用" },
  { key: "ask", label: "每次询问" },
];

const CHECK_FREQUENCIES: { key: CheckFrequency; label: string }[] = [
  { key: "startup", label: "启动后后台检查" },
  { key: "each-startup", label: "每次启动检查" },
  { key: "daily", label: "每日检查" },
  { key: "manual", label: "仅手动检查" },
];

export function QuickSettingsStage() {
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);

  const [autostart, setAutostart] = useState(true);
  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>("minimize");
  const [checkFrequency, setCheckFrequency] = useState<CheckFrequency>("startup");
  const [silentUpdate, setSilentUpdate] = useState(true);

  // 初始化：从后端读取已保存的值（回退默认值）
  useEffect(() => {
    (async () => {
      try {
        const [auto, close, freq, silent] = await Promise.all([
          settingCommands.get("general.autostart"),
          settingCommands.get("general.close_behavior"),
          settingCommands.get("update.check_frequency"),
          settingCommands.get("update.silent_update"),
        ]);
        if (auto?.value === "false") setAutostart(false);
        if (close && ["ask", "minimize", "exit"].includes(close.value)) {
          setCloseBehavior(close.value as CloseBehavior);
        }
        if (
          freq &&
          ["startup", "each-startup", "daily", "manual"].includes(freq.value)
        ) {
          setCheckFrequency(freq.value as CheckFrequency);
        }
        if (silent?.value === "false") setSilentUpdate(false);
      } catch (e) {
        console.warn("[oobe] 读取快速设置失败:", e);
      }
    })();
  }, []);

  // 持久化所有设置
  const persistAll = async () => {
    await Promise.all([
      settingCommands.set({
        key: "general.autostart",
        value: String(autostart),
        value_type: "bool",
      }),
      settingCommands.set({
        key: "general.close_behavior",
        value: closeBehavior,
        value_type: "string",
      }),
      settingCommands.set({
        key: "update.check_frequency",
        value: checkFrequency,
        value_type: "string",
      }),
      settingCommands.set({
        key: "update.silent_update",
        value: String(silentUpdate),
        value_type: "bool",
      }),
    ]);
  };

  const handleNext = async () => {
    await persistAll();
    next();
  };

  return (
    <OobeShell
      stage="quick_settings"
      title="快速设置"
      subtitle="这些设置后续可在设置页修改"
      canNext
      onNext={handleNext}
      onBack={() => goTo("post_restart")}
    >
      {/* 开机自启 */}
      <SettingRow label="开机自启" description="系统启动时自动运行 Exero">
        <Switch checked={autostart} onCheckedChange={setAutostart} />
      </SettingRow>

      {/* 关闭行为 */}
      <SettingGroup label="关闭主窗口行为">
        <div className="flex flex-col gap-1">
          {CLOSE_BEHAVIORS.map((item) => (
            <RadioRow
              key={item.key}
              label={item.label}
              selected={closeBehavior === item.key}
              onClick={() => setCloseBehavior(item.key)}
            />
          ))}
        </div>
      </SettingGroup>

      {/* 更新检查频率 */}
      <SettingGroup label="更新检查频率">
        <div className="flex flex-col gap-1">
          {CHECK_FREQUENCIES.map((item) => (
            <RadioRow
              key={item.key}
              label={item.label}
              selected={checkFrequency === item.key}
              onClick={() => setCheckFrequency(item.key)}
            />
          ))}
        </div>
      </SettingGroup>

      {/* 静默更新 */}
      <SettingRow
        label="静默更新"
        description="静默自启时自动检查并安装更新，全程无需干预"
      >
        <Switch checked={silentUpdate} onCheckedChange={setSilentUpdate} />
      </SettingRow>
    </OobeShell>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/50 p-5">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SettingGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
      <p className="mb-3 text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function RadioRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
