/**
 * 更新管理器（Beta9 · 任务7 重做推荐更新弹窗）
 *
 * 职责：
 * 1. 启动时恢复 check_frequency + 清理旧安装包 + 检查更新
 * 2. 强制更新：全屏阻断弹窗（保留原逻辑）
 * 3. 推荐更新：重做弹窗 UI（版本号顶部 + Release Notes 滚动区 + framer-motion 进度条 + 下载完成绿色提示 + 按钮状态机）
 * 4. 普通更新：不弹窗
 *
 * 下载进度通过后端事件 update://download-progress 推送（payload: {downloaded, total, percent}）。
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import {
  ShieldAlert,
  Bell,
  Download,
  X,
  LogOut,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  updateCommands,
  settingCommands,
  systemCommands,
  type UpdateStatus,
  type Setting,
} from "@/lib/tauri";
import { useUpdateStore } from "@/stores/updateStore";

/** 下载进度事件 payload */
interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export function UpdateManager() {
  // 推荐更新弹窗状态
  const [recommendStatus, setRecommendStatus] = useState<UpdateStatus | null>(null);
  const [showRecommended, setShowRecommended] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // 下载状态机：idle → downloading → completed（成功后 app.exit，不会真的到 completed，保留兜底）
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "completed">("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  // 强制更新状态从 store 读取
  const forceStatus = useUpdateStore((s) => s.forceStatus);
  const setForceStatus = useUpdateStore((s) => s.setForceStatus);

  /** 监听下载进度事件（Beta9 任务7） */
  useEffect(() => {
    const unlisten = listen<DownloadProgress>("update://download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.percent >= 100) {
        setDownloadState("completed");
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  /** 启动时检查更新 */
  const checkOnStartup = useCallback(async () => {
    try {
      await updateCommands.restoreCheckFrequency().catch((e) =>
        console.error("[update] 恢复 check_frequency 失败:", e)
      );
      await updateCommands.cleanupOldInstallers().catch((e) =>
        console.error("[update] 清理旧安装包失败:", e)
      );

      const freqSetting = await settingCommands
        .get("update.check_frequency")
        .catch(() => null);
      const frequency = freqSetting?.value ?? "startup";

      if (frequency === "manual") return;

      if (frequency === "daily") {
        const lastCheck = await settingCommands
          .get("update.last_check_time")
          .catch(() => null);
        if (lastCheck?.value) {
          const last = new Date(lastCheck.value).getTime();
          const now = Date.now();
          if (now - last < 24 * 60 * 60 * 1000) return;
        }
      }

      const result = await updateCommands.checkForUpdates();
      if (!result.update_available || result.error) return;

      const statusSetting: Setting = {
        key: "update.last_status",
        value: JSON.stringify(result),
        value_type: "json",
      };
      await settingCommands.set(statusSetting).catch(() => {});

      const isForce =
        result.force_update_required || result.minimum_version_required;

      if (isForce) {
        await updateCommands.prepareForceUpdate().catch((e) =>
          console.error("[update] 准备强制更新失败:", e)
        );
        setForceStatus(result);
      } else if (result.recommend_update) {
        const ignored = await settingCommands
          .get("update.ignored_version")
          .catch(() => null);
        const ignoredVersion = ignored?.value ?? "";
        if (result.latest_version && result.latest_version !== ignoredVersion) {
          const silentUpdateSetting = await settingCommands
            .get("update.silent_update")
            .catch(() => null);
          const silentUpdate = silentUpdateSetting?.value === "true";
          if (silentUpdate) {
            updateCommands
              .downloadAndInstall()
              .catch((e) => console.error("[update] 静默更新失败:", e));
          } else {
            setRecommendStatus(result);
            setShowRecommended(true);
          }
        }
      }
    } catch (e) {
      console.error("[update] 启动检查失败:", e);
    }
  }, [setForceStatus]);

  useEffect(() => {
    const timer = setTimeout(() => checkOnStartup(), 2000);
    return () => clearTimeout(timer);
  }, [checkOnStartup]);

  /** 立即更新：下载 + 静默安装 */
  const handleDownloadAndInstall = async () => {
    setDownloadState("downloading");
    setDownloadError(null);
    setProgress(null);
    try {
      await updateCommands.downloadAndInstall();
      // 成功后 app.exit(0)，不会执行到这里；兜底标记 completed
      setDownloadState("completed");
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
      setDownloadState("idle");
    }
  };

  /** 忽略此版本 */
  const handleCancelVersion = async () => {
    if (!recommendStatus?.latest_version) return;
    const setting: Setting = {
      key: "update.ignored_version",
      value: recommendStatus.latest_version,
      value_type: "string",
    };
    await settingCommands.set(setting).catch(() => {});
    setShowRecommended(false);
  };

  /** 重置弹窗状态（关闭时） */
  const handleClose = () => {
    setShowRecommended(false);
    setDownloadState("idle");
    setProgress(null);
    setDownloadError(null);
  };

  // ===== 强制更新全屏阻断弹窗（保留原逻辑） =====
  if (forceStatus) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
        <div className="mx-4 w-full max-w-2xl rounded-lg border border-destructive/40 bg-card p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-destructive">
                必须更新才能继续使用
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {forceStatus.minimum_version_required
                  ? `当前版本 V${forceStatus.current_version} 低于最低要求版本 V${forceStatus.minimum_version}，必须升级。`
                  : `最新版本 V${forceStatus.latest_version} 标记为强制更新，必须升级。`}
              </p>
            </div>
          </div>

          {forceStatus.release_body && (
            <div className="mt-4 max-h-[40vh] overflow-y-auto scrollbar-fluent rounded-md border bg-muted/30 p-4">
              <h3 className="mb-2 text-sm font-medium">更新日志</h3>
              <div className="text-sm leading-relaxed space-y-2 text-muted-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {forceStatus.release_body}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {downloadError && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              下载失败：{downloadError}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => systemCommands.exitApp()}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              退出软件
            </Button>
            <Button
              variant="destructive"
              onClick={handleDownloadAndInstall}
              disabled={downloadState === "downloading"}
              className="gap-2"
            >
              {downloadState === "downloading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloadState === "downloading" ? "下载中..." : "立即更新"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 推荐更新弹窗（Beta9 任务7 重做） =====
  return (
    <Dialog
      open={showRecommended}
      onOpenChange={(open) => {
        if (!open && downloadState !== "downloading") {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="max-w-2xl"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (downloadState === "downloading") e.preventDefault();
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          {/* 顶部：版本号（v{tag_name}） */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>v{recommendStatus?.latest_version}</DialogTitle>
              <DialogDescription>
                当前版本 v{recommendStatus?.current_version}，此版本标记为推荐更新
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Release Notes 滚动区（max-h-200px，主题色滚动条） */}
        {recommendStatus?.release_body && (
          <div className="max-h-[200px] overflow-y-auto rounded-md border bg-muted/30 p-4 scrollbar-fluent">
            <div className="text-sm leading-relaxed space-y-2 text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {recommendStatus.release_body}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* 下载进度条（仅下载中显示，framer-motion 平滑过渡 width） */}
        {downloadState === "downloading" && (
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress?.percent ?? 0}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              下载中 {progress?.percent ?? 0}%
            </p>
          </div>
        )}

        {/* 下载完成态：绿色提示卡片 */}
        {downloadState === "completed" && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            下载完成，即将安装并重启...
          </div>
        )}

        {/* 下载错误 */}
        {downloadError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            下载失败：{downloadError}
          </div>
        )}

        {/* 底部按钮（状态机） */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* 未下载：取消 + 下载 */}
          {downloadState === "idle" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelVersion}
                className="text-xs text-muted-foreground"
              >
                取消（忽略此版本）
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleClose}>
                  <X className="h-4 w-4" />
                  忽略更新
                </Button>
                <Button onClick={handleDownloadAndInstall} className="gap-2">
                  <Download className="h-4 w-4" />
                  立即更新
                </Button>
              </div>
            </>
          )}
          {/* 下载中：禁用显示"下载中" */}
          {downloadState === "downloading" && (
            <div className="flex w-full justify-end">
              <Button disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                下载中...
              </Button>
            </div>
          )}
          {/* 下载完成：跳过 + 重启安装 */}
          {downloadState === "completed" && (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                跳过
              </Button>
              <Button onClick={() => systemCommands.exitApp()} className="gap-2">
                <LogOut className="h-4 w-4" />
                重启安装
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
