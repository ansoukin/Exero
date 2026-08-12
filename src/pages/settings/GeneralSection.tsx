import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  RotateCcw,
  Loader2,
  AlertTriangle,
  FlaskConical,
  LogOut,
  GraduationCap,
  Calendar,
  RefreshCw,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { onboardingCommands, settingCommands, systemCommands, type Setting } from "@/lib/tauri";
import { useOnboardingStore } from "@/stores/onboarding";
import { useOobeStore, type AppMode } from "@/stores/oobe";
import { cn } from "@/lib/utils";
import { UrlAliasSection } from "./UrlAliasSection";
import { ImportExportSection } from "./ImportExportSection";

/**
 * 通用分区（Phase 6a/6b · SPEC 3.5 页面 5 分区 2 / SPEC 11.2 / SPEC 11.3 / SPEC 5.5）
 *
 * 包含：
 * - 应用模式（学校/日常，切换后重启生效）
 * - 开机自启（tauri-plugin-autostart）
 * - 静默自启（依赖开机自启）
 * - 关闭主窗口行为（ask / minimize / exit）
 * - 课表管理（重新初始化 / 退出演示模式，SPEC 11.2）
 * - URL 短域名别名（Phase 6b · SPEC 11.3）
 * - 导入导出（Phase 6b · SPEC 5.5）
 */

/** 关闭行为选项 */
const CLOSE_BEHAVIORS = [
  { key: "ask", label: "每次询问" },
  { key: "minimize", label: "最小化到托盘" },
  { key: "exit", label: "退出应用" },
] as const;

type CloseBehavior = (typeof CLOSE_BEHAVIORS)[number]["key"];

/** 应用模式选项（学校模式有课表，日常模式只有快捷指令+日历） */
const APP_MODES: { key: AppMode; label: string; desc: string; icon: typeof GraduationCap }[] = [
  {
    key: "school",
    label: "校园模式",
    desc: "包含课表、节次、课程管理，适合学生使用",
    icon: GraduationCap,
  },
  {
    key: "daily",
    label: "日常模式",
    desc: "只保留快捷指令和日历视图，更简洁",
    icon: Calendar,
  },
];

export function GeneralSection() {
  const [autostart, setAutostart] = useState(false);
  const [silentAutostart, setSilentAutostart] = useState(false);
  const [silentUpdate, setSilentUpdate] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>("ask");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // 应用模式（从 settings.app.mode 读取，切换后需重启生效）
  const [appMode, setAppMode] = useState<AppMode>("school");
  const [modeRestartOpen, setModeRestartOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);

  const demoMode = useOnboardingStore((s) => s.demoMode);
  const setDemoMode = useOnboardingStore((s) => s.setDemoMode);
  const openOnboarding = useOnboardingStore((s) => s.open);

  useEffect(() => {
    // 加载开机自启状态
    isEnabled()
      .then(setAutostart)
      .catch((e) => console.error("[general] 读取开机自启状态失败:", e));

    // 加载关闭行为设置
    settingCommands
      .get("general.close_behavior")
      .then((s) => {
        if (s && ["ask", "minimize", "exit"].includes(s.value)) {
          setCloseBehavior(s.value as CloseBehavior);
        }
      })
      .catch((e) => console.error("[general] 读取关闭行为失败:", e));

    // 加载静默自启设置
    settingCommands
      .get("general.silent_autostart")
      .then((s) => {
        if (s) setSilentAutostart(s.value === "true");
      })
      .catch((e) => console.error("[general] 读取静默自启设置失败:", e));

    // 加载静默更新设置（Beta6 Phase 4）
    settingCommands
      .get("update.silent_update")
      .then((s) => {
        if (s) setSilentUpdate(s.value === "true");
      })
      .catch((e) => console.error("[general] 读取静默更新设置失败:", e));

    // 加载应用模式（学校/日常）
    settingCommands
      .get("app.mode")
      .then((s) => {
        if (s && (s.value === "school" || s.value === "daily")) {
          setAppMode(s.value as AppMode);
        }
      })
      .catch((e) => console.error("[general] 读取应用模式失败:", e));
  }, []);

  /** 切换应用模式：先弹确认框，确认后保存并重启 */
  const handleModeChange = (mode: AppMode) => {
    if (mode === appMode) return;
    setPendingMode(mode);
    setModeRestartOpen(true);
  };

  /** 确认切换模式：保存设置并重启应用 */
  const handleConfirmModeSwitch = async () => {
    if (!pendingMode) return;
    try {
      await settingCommands.set({
        key: "app.mode",
        value: pendingMode,
        value_type: "string",
      });
      // 同步到 oobe store（下次启动会读取）
      useOobeStore.getState().setAppMode(pendingMode);
      // 重启应用使模式切换生效
      systemCommands.restartApp();
    } catch (e) {
      console.error("[general] 切换应用模式失败:", e);
      setModeRestartOpen(false);
      setPendingMode(null);
    }
  };

  const handleAutostartChange = async (enabled: boolean) => {
    setAutostart(enabled);
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
    } catch (e) {
      // 失败时回滚状态
      setAutostart(!enabled);
      console.error("[general] 切换开机自启失败:", e);
    }
  };

  const handleSilentAutostartChange = async (enabled: boolean) => {
    setSilentAutostart(enabled);
    try {
      await settingCommands.set({
        key: "general.silent_autostart",
        value: enabled.toString(),
        value_type: "bool",
      });
      // 开机自启已开启时重新注册，确保 --autostart 启动参数生效
      if (enabled && autostart) {
        await disable();
        await enable();
      }
    } catch (e) {
      setSilentAutostart(!enabled);
      console.error("[general] 保存静默自启设置失败:", e);
    }
  };

  /** 切换静默更新（Beta6 Phase 4） */
  const handleSilentUpdateChange = async (enabled: boolean) => {
    setSilentUpdate(enabled);
    try {
      await settingCommands.set({
        key: "update.silent_update",
        value: enabled.toString(),
        value_type: "bool",
      });
    } catch (e) {
      setSilentUpdate(!enabled);
      console.error("[general] 保存静默更新设置失败:", e);
    }
  };

  const handleCloseBehaviorChange = async (value: CloseBehavior) => {
    setCloseBehavior(value);
    const setting: Setting = {
      key: "general.close_behavior",
      value,
      value_type: "string",
    };
    try {
      await settingCommands.set(setting);
    } catch (e) {
      console.error("[general] 保存关闭行为失败:", e);
    }
  };

  // 二次确认弹窗文案根据 demoMode 调整（SPEC 11.2：退出演示模式 vs 重新初始化课表）
  const resetDialogTitle = demoMode
    ? "确认退出演示模式"
    : "确认重新初始化课表";
  const resetDialogDesc = demoMode
    ? "退出演示模式将清空所有示例课表数据（学期、节次、课程、调课、周模板），清除演示模式标记，并重新启动初始化向导。该操作不可撤销。"
    : "此操作将清空所有学期、节次、课程、调课与周模板数据，并重新启动初始化向导。该操作不可撤销。";
  const resetConfirmText = demoMode
    ? "确认退出并重新初始化"
    : "确认清空并重新初始化";

  return (
    <div className="flex flex-col gap-8">
      {/* 应用模式（学校/日常，切换后需重启生效） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">应用模式</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            选择使用场景，切换后需重启应用生效
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {APP_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = appMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => handleModeChange(mode.key)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-200",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-input hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mode.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 开机自启 */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">开机自启</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            系统启动时自动运行 Exero
          </p>
        </div>
        <Switch checked={autostart} onCheckedChange={handleAutostartChange} />
      </section>

      {/* 静默自启（依赖开机自启） */}
      <section className={cn(
        "flex items-center justify-between gap-4 transition-opacity",
        !autostart && "pointer-events-none opacity-50"
      )}>
        <div className="flex-1">
          <h3 className="text-base font-medium">静默自启</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            开机自启时隐藏到托盘，不显示主界面
          </p>
        </div>
        <Switch
          checked={silentAutostart}
          onCheckedChange={handleSilentAutostartChange}
          disabled={!autostart}
        />
      </section>

      {/* 静默更新（Beta6 Phase 4：自动下载安装推荐更新，不弹窗） */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">静默更新</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            检测到推荐更新时自动下载并安装，无需手动确认
          </p>
        </div>
        <Switch checked={silentUpdate} onCheckedChange={handleSilentUpdateChange} />
      </section>

      {/* 关闭主窗口行为 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">关闭主窗口行为</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            点击标题栏关闭按钮时的行为，可设置每次询问或直接执行
          </p>
        </div>
        <div className="flex gap-2">
          {CLOSE_BEHAVIORS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleCloseBehaviorChange(item.key)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                closeBehavior === item.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 课表管理（SPEC 11.2：演示模式出口 / 重新初始化入口） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">课表管理</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {demoMode
              ? "当前处于演示模式，可退出并重新配置课表"
              : "清空现有课表数据并重新启动初始化向导"}
          </p>
        </div>

        {/* 演示模式提示（SPEC 11.2，仅 demoMode=true 时显示） */}
        {demoMode && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span>当前为演示模式，课表数据为示例数据</span>
          </div>
        )}

        <div>
          <Button
            variant="outline"
            onClick={() => {
              setResetError(null);
              setResetConfirmOpen(true);
            }}
            className={cn(
              "gap-2",
              demoMode &&
                "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400"
            )}
          >
            {demoMode ? (
              <>
                <LogOut className="h-4 w-4" />
                退出演示模式
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                重新初始化课表
              </>
            )}
          </Button>
        </div>
      </section>

      {/* URL 短域名别名（Phase 6b · SPEC 11.3） */}
      <section className="flex flex-col gap-3 border-t pt-6">
        <UrlAliasSection />
      </section>

      {/* 导入导出（Phase 6b · SPEC 5.5） */}
      <section className="flex flex-col gap-3 border-t pt-6">
        <ImportExportSection />
      </section>

      {/* 二次确认弹窗（SPEC 11.2：手动触发重新初始化 / 退出演示模式） */}
      <Dialog open={resetConfirmOpen} onOpenChange={(o) => !resetting && setResetConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {resetDialogTitle}
            </DialogTitle>
            <DialogDescription>{resetDialogDesc}</DialogDescription>
          </DialogHeader>

          {resetError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {resetError}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResetConfirmOpen(false)}
              disabled={resetting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setResetting(true);
                setResetError(null);
                try {
                  await onboardingCommands.resetScheduleData();
                  // reset_schedule_data 已清除 demo_mode 标记，同步前端状态
                  setDemoMode(false);
                  setResetConfirmOpen(false);
                  // 重新触发向导（从欢迎页开始）
                  openOnboarding(0);
                } catch (e) {
                  setResetError(e instanceof Error ? e.message : String(e));
                } finally {
                  setResetting(false);
                }
              }}
              disabled={resetting}
              className="gap-2"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : demoMode ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {resetConfirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 模式切换重启确认弹窗 */}
      <Dialog open={modeRestartOpen} onOpenChange={setModeRestartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              切换到{pendingMode === "school" ? "校园模式" : "日常模式"}
            </DialogTitle>
            <DialogDescription>
              切换应用模式需要重启 Exero 才能生效。未保存的数据可能会丢失，请确认后再继续。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModeRestartOpen(false);
                setPendingMode(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleConfirmModeSwitch} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              保存并重启
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
