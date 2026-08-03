/**
 * 更新分区（Phase 6b · SPEC 3.5 页面 5 分区 3 / SPEC 第七章）
 *
 * 包含：
 * - 自动更新开关
 * - 更新检查频率（启动后后台 / 每次启动 / 每日定时 / 仅手动）
 * - 渠道（仅 Stable，Beta 待定）
 * - 强制更新说明（force-update.json）
 * - 手动检查按钮 + 检查结果展示
 */

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpCircle,
  ShieldAlert,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  settingCommands,
  updateCommands,
  type Setting,
  type UpdateStatus,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

/** 更新检查频率选项 */
const CHECK_FREQUENCIES = [
  { key: "startup", label: "启动后后台" },
  { key: "each-startup", label: "每次启动" },
  { key: "daily", label: "每日定时" },
  { key: "manual", label: "仅手动" },
] as const;

type CheckFrequency = (typeof CHECK_FREQUENCIES)[number]["key"];

/** 格式化 ISO 8601 时间为本地可读格式 */
function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function UpdateSection() {
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [checkFrequency, setCheckFrequency] = useState<CheckFrequency>("startup");
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // 加载设置
  useEffect(() => {
    settingCommands
      .get("update.auto_update")
      .then((s) => {
        if (s) setAutoUpdate(s.value === "true");
      })
      .catch((e) => console.error("[updates] 读取自动更新设置失败:", e));

    settingCommands
      .get("update.check_frequency")
      .then((s) => {
        if (s && ["startup", "each-startup", "daily", "manual"].includes(s.value)) {
          setCheckFrequency(s.value as CheckFrequency);
        }
      })
      .catch((e) => console.error("[updates] 读取检查频率失败:", e));

    // 加载最近检查状态
    settingCommands
      .get("update.last_status")
      .then((s) => {
        if (s) {
          try {
            setStatus(JSON.parse(s.value) as UpdateStatus);
          } catch {
            // ignore parse error
          }
        }
      })
      .catch((e) => console.error("[updates] 读取上次检查状态失败:", e));
  }, []);

  const handleAutoUpdateChange = async (enabled: boolean) => {
    setAutoUpdate(enabled);
    const setting: Setting = {
      key: "update.auto_update",
      value: enabled.toString(),
      value_type: "bool",
    };
    try {
      await settingCommands.set(setting);
    } catch (e) {
      setAutoUpdate(!enabled);
      console.error("[updates] 保存自动更新设置失败:", e);
    }
  };

  const handleFrequencyChange = async (value: CheckFrequency) => {
    setCheckFrequency(value);
    const setting: Setting = {
      key: "update.check_frequency",
      value,
      value_type: "string",
    };
    try {
      await settingCommands.set(setting);
    } catch (e) {
      console.error("[updates] 保存检查频率失败:", e);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await updateCommands.checkForUpdates();
      setStatus(result);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  // 强制更新提示（最高优先级）
  if (status?.force_update_required) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="text-base font-medium text-destructive">
              必须更新才能继续使用
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              当前版本 {status.current_version} 低于最低要求版本{" "}
              {status.force_update_minimum}，请立即更新。
            </p>
            {status.release_url && (
              <a
                href={status.release_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                前往下载最新版本
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 自动更新 */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">自动更新</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            检测到新版本时自动下载并安装（需要管理员权限）
          </p>
        </div>
        <Switch checked={autoUpdate} onCheckedChange={handleAutoUpdateChange} />
      </section>

      {/* 更新检查频率 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">更新检查频率</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            选择自动检查更新的时机，"仅手动"将完全依赖下方按钮
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHECK_FREQUENCIES.map((item) => (
            <button
              key={item.key}
              onClick={() => handleFrequencyChange(item.key)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                checkFrequency === item.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 更新渠道 */}
      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-base font-medium">更新渠道</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            仅支持 Stable 渠道（GitHub Release latest），Beta 渠道为待定项
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Stable（默认）</span>
          <span className="text-xs text-muted-foreground">Beta：待定</span>
        </div>
      </section>

      {/* 手动检查 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">手动检查</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            立即向 GitHub Release 发起检查请求
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="default"
            onClick={handleCheckNow}
            disabled={checking}
            className="gap-2"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {checking ? "检查中..." : "立即检查"}
          </Button>
        </div>

        {/* 检查错误 */}
        {checkError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>检查失败：{checkError}</span>
          </div>
        )}

        {/* 检查结果 */}
        {status && !checkError && (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">当前版本</div>
                <div className="font-medium">{status.current_version}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">最新版本</div>
                <div className="font-medium">
                  {status.latest_version ?? "获取失败"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">上次检查</div>
                <div className="font-medium">{formatTime(status.checked_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">发布时间</div>
                <div className="font-medium">{formatTime(status.published_at)}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {status.update_available ? (
                <>
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    发现新版本 {status.latest_version}
                  </span>
                  {status.release_url && (
                    <a
                      href={status.release_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      前往下载
                    </a>
                  )}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-muted-foreground">
                    已是最新版本
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 强制更新说明 */}
      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-base font-medium">强制更新</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            开发者通过 force-update.json 推送最低版本号，低于该版本时必须更新才能继续使用
          </p>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          当前未启用强制更新（无可用的 force-update.json 或当前版本满足要求）
        </div>
      </section>
    </div>
  );
}
