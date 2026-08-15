/**
 * 更新分区（Phase 6b · SPEC 3.5 页面 5 分区 3 / SPEC 第七章）
 *
 * 包含：
 * - 自动更新开关
 * - 更新检查频率（启动后后台 / 每次启动 / 每日定时 / 仅手动）
 * - 渠道（仅 Stable，Beta 待定）
 * - 三级更新级别（SPEC 7.2 / 13.6）：
 *   A. 强制更新 `[强制更新]`：屏蔽应用其他功能，要求立即更新
 *   B. 推荐更新 `[推荐更新]`：启动时弹窗提示，可"稍后"或"忽略"（记录版本）
 *   C. 最低版本 `[最低版本 x.y.z]`：当前版本 < x.y.z 时同 A 行为
 *   D. 普通更新（无标记）：默认行为
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
  Bell,
  Info,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  settingCommands,
  updateCommands,
  type Setting,
  type UpdateStatus,
} from "@/lib/tauri";
import { useUpdateStore } from "@/stores/updateStore";
import { cn } from "@/lib/utils";

/** 更新检查频率选项（Beta9 任务5：删 each-startup 重复项，startup 即启动时） */
const CHECK_FREQUENCIES = [
  { key: "startup", label: "启动后后台" },
  { key: "daily", label: "每日定时" },
  { key: "manual", label: "仅手动" },
] as const;

type CheckFrequency = (typeof CHECK_FREQUENCIES)[number]["key"];

/** 格式化 ISO 8601 时间为本地可读格式 */
function formatTime(iso: string | null): string {
  if (!iso) return "-";
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
  // 推荐更新忽略记录（SPEC 13.6.2：用户忽略的版本号，该版本不再弹窗）
  const [ignoredVersion, setIgnoredVersion] = useState<string | null>(null);

  // 加载设置
  useEffect(() => {
    // 并行加载所有设置（SPEC 优化：4 次串行 IPC -> 1 次 Promise.all）
    Promise.all([
      settingCommands.get("update.auto_update").catch((e) => {
        console.error("[updates] 读取自动更新设置失败:", e);
        return null;
      }),
      settingCommands.get("update.check_frequency").catch((e) => {
        console.error("[updates] 读取检查频率失败:", e);
        return null;
      }),
      settingCommands.get("update.last_status").catch((e) => {
        console.error("[updates] 读取上次检查状态失败:", e);
        return null;
      }),
      settingCommands.get("update.ignored_version").catch((e) => {
        console.error("[updates] 读取忽略版本失败:", e);
        return null;
      }),
    ]).then(([autoUpdateSetting, frequencySetting, statusSetting, ignoredSetting]) => {
      if (autoUpdateSetting) setAutoUpdate(autoUpdateSetting.value === "true");
      if (frequencySetting && ["startup", "daily", "manual"].includes(frequencySetting.value)) {
        setCheckFrequency(frequencySetting.value as CheckFrequency);
      }
      if (statusSetting) {
        try {
          setStatus(JSON.parse(statusSetting.value) as UpdateStatus);
        } catch {
          // ignore parse error
        }
      }
      if (ignoredSetting) setIgnoredVersion(ignoredSetting.value);
    });
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

      // 强制更新检测：通过 store 触发全屏阻断弹窗（SPEC 7.6 R4）
      const isForce =
        result.force_update_required || result.minimum_version_required;
      if (isForce) {
        await updateCommands.prepareForceUpdate().catch(() => {});
        useUpdateStore.getState().setForceStatus(result);
      }
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  /** 忽略推荐更新版本（SPEC 13.6.2：记录版本号，该版本不再弹窗） */
  const handleIgnoreRecommend = async () => {
    if (!status?.latest_version) return;
    const version = status.latest_version;
    setIgnoredVersion(version);
    const setting: Setting = {
      key: "update.ignored_version",
      value: version,
      value_type: "string",
    };
    try {
      await settingCommands.set(setting);
    } catch (e) {
      console.error("[updates] 保存忽略版本失败:", e);
    }
  };

  // ===== 三级更新级别展示（SPEC 7.2）=====

  // A. 强制更新 或 C. 最低版本要求触发（同 A 行为）：屏蔽应用其他功能
  const isForceUpdate = status?.force_update_required || (status?.minimum_version_required ?? false);

  if (isForceUpdate) {
    const isMinimumVersion = status?.minimum_version_required && status.minimum_version;
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="text-base font-medium text-destructive">
              必须更新才能继续使用
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMinimumVersion ? (
                <>
                  当前版本 {status?.current_version} 低于最低要求版本{" "}
                  {status?.minimum_version}，必须升级才能继续使用。
                </>
              ) : (
                <>
                  最新版本 {status?.latest_version} 标记为强制更新，当前版本{" "}
                  {status?.current_version} 必须升级才能继续使用。
                </>
              )}
            </p>
            {status?.release_url && (
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
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">更新渠道</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            当前为稳定版渠道，测试版渠道待开放
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>稳定版（默认）</span>
          <span className="text-xs text-muted-foreground">测试版：待开放</span>
        </div>
      </section>

      {/* 手动检查 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">手动检查</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            立即检查是否有新版本
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

      {/* B. 推荐更新提示（SPEC 7.2 B / 13.6.2）*/}
      {status?.recommend_update &&
        status.update_available &&
        status.latest_version !== ignoredVersion && (
          <section className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <h3 className="text-base font-medium text-primary">
                  推荐更新到 {status.latest_version}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  此版本标记为推荐更新，建议升级以获得更好的体验
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {status.release_url && (
                    <a
                      href={status.release_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      前往下载
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleIgnoreRecommend}
                    className="ml-auto h-7 text-xs text-muted-foreground"
                  >
                    忽略此版本
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* C. 最低版本提示（未触发强制更新时，当前版本 >= 最低版本）*/}
      {status?.minimum_version && !status.minimum_version_required && (
        <section className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="text-base font-medium">
                最低版本要求：{status.minimum_version}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                当前版本 {status.current_version} 已满足要求
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 更新级别说明 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">更新级别</h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <span className="font-medium text-destructive">强制更新</span>
              <code className="ml-2 rounded bg-muted px-1 py-0.5 text-xs">[强制更新]</code>
              <p className="mt-1 text-xs text-muted-foreground">
                必须更新才能继续使用
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-primary">推荐更新</span>
              <code className="ml-2 rounded bg-muted px-1 py-0.5 text-xs">[推荐更新]</code>
              <p className="mt-1 text-xs text-muted-foreground">
                弹窗提示，可忽略
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-medium text-amber-700 dark:text-amber-400">最低版本</span>
              <code className="ml-2 rounded bg-muted px-1 py-0.5 text-xs">[最低版本 x.y.z]</code>
              <p className="mt-1 text-xs text-muted-foreground">
                低于该版本时强制更新
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <span className="font-medium">普通更新</span>
              <span className="ml-2 text-xs text-muted-foreground">无标记</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
