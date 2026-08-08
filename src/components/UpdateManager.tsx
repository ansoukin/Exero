/**
 * 更新管理器（SPEC 7.6 · R3 + R4）
 *
 * 职责：
 * 1. 启动时恢复 check_frequency + 清理旧安装包 + 检查更新
 * 2. 强制更新：全屏阻断弹窗，仅允许"立即更新"或"退出软件"
 *    - 来源：启动检查 / 设置页手动检查（通过 useUpdateStore 共享）
 * 3. 推荐更新：弹窗显示版本信息 + Release Note，三选项：
 *    - 立即更新：下载并静默安装
 *    - 忽略更新：本次忽略，下次启动仍弹窗
 *    - 取消：忽略此版本，下一版本仍弹窗
 * 4. 普通更新：不弹窗（用户可在设置页手动检查）
 */

import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert,
  Bell,
  Download,
  X,
  LogOut,
  Loader2,
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

export function UpdateManager() {
  // 推荐更新弹窗使用本地状态
  const [recommendStatus, setRecommendStatus] = useState<UpdateStatus | null>(null);
  const [showRecommended, setShowRecommended] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 强制更新状态从 store 读取（可被 UpdateSection 触发）
  const forceStatus = useUpdateStore((s) => s.forceStatus);
  const setForceStatus = useUpdateStore((s) => s.setForceStatus);

  /** 启动时检查更新 */
  const checkOnStartup = useCallback(async () => {
    try {
      // 1. 恢复 check_frequency（新版本启动时）
      await updateCommands.restoreCheckFrequency().catch((e) =>
        console.error("[update] 恢复 check_frequency 失败:", e)
      );

      // 2. 清理旧安装包
      await updateCommands.cleanupOldInstallers().catch((e) =>
        console.error("[update] 清理旧安装包失败:", e)
      );

      // 3. 读取检查频率设置
      const freqSetting = await settingCommands
        .get("update.check_frequency")
        .catch(() => null);
      const frequency = freqSetting?.value ?? "startup";

      // "manual" 模式不自动检查
      if (frequency === "manual") return;

      // "daily" 模式：检查上次检查时间，24h 内不重复检查
      if (frequency === "daily") {
        const lastCheck = await settingCommands
          .get("update.last_check_time")
          .catch(() => null);
        if (lastCheck?.value) {
          const last = new Date(lastCheck.value).getTime();
          const now = Date.now();
          if (now - last < 24 * 60 * 60 * 1000) return; // 24h 内跳过
        }
      }

      // 4. 检查更新
      const result = await updateCommands.checkForUpdates();
      if (!result.update_available || result.error) return;

      // 5. 持久化状态到设置（供设置页展示）
      const statusSetting: Setting = {
        key: "update.last_status",
        value: JSON.stringify(result),
        value_type: "json",
      };
      await settingCommands.set(statusSetting).catch(() => {});

      // 6. 判断更新级别
      const isForce =
        result.force_update_required || result.minimum_version_required;

      if (isForce) {
        // 强制更新：准备保险措施 + 设置 store 触发阻断弹窗
        await updateCommands.prepareForceUpdate().catch((e) =>
          console.error("[update] 准备强制更新失败:", e)
        );
        setForceStatus(result);
      } else if (result.recommend_update) {
        // 推荐更新：检查是否已忽略此版本
        const ignored = await settingCommands
          .get("update.ignored_version")
          .catch(() => null);
        const ignoredVersion = ignored?.value ?? "";
        if (result.latest_version && result.latest_version !== ignoredVersion) {
          setRecommendStatus(result);
          setShowRecommended(true);
        }
      }
      // 普通更新：不弹窗
    } catch (e) {
      console.error("[update] 启动检查失败:", e);
    }
  }, [setForceStatus]);

  useEffect(() => {
    // 延迟 2s 启动检查，避免与 bootstrap 初始化竞争
    const timer = setTimeout(() => checkOnStartup(), 2000);
    return () => clearTimeout(timer);
  }, [checkOnStartup]);

  /** 立即更新：下载 + 静默安装 */
  const handleDownloadAndInstall = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await updateCommands.downloadAndInstall();
      // downloadAndInstall 成功后会 app.exit(0)，不会执行到这里
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
      setDownloading(false);
    }
  };

  /** 忽略此版本（取消：记录版本号，该版本不再弹窗） */
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

  // ===== 强制更新全屏阻断弹窗（来源：store，可被 UpdateSection 触发） =====
  if (forceStatus) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
        <div className="mx-4 w-full max-w-2xl rounded-lg border border-destructive/40 bg-card p-6 shadow-2xl">
          {/* 头部 */}
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
                  ? `当前版本 ${forceStatus.current_version} 低于最低要求版本 ${forceStatus.minimum_version}，必须升级。`
                  : `最新版本 ${forceStatus.latest_version} 标记为强制更新，必须升级。`}
              </p>
            </div>
          </div>

          {/* Release Note（可滚动） */}
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

          {/* 下载错误 */}
          {downloadError && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              下载失败：{downloadError}
            </div>
          )}

          {/* 按钮 */}
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
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "下载中..." : "立即更新"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 推荐更新弹窗 =====
  return (
    <Dialog
      open={showRecommended}
      onOpenChange={(open) => {
        // 推荐更新不允许通过点击外部关闭
        if (!open) return;
        setShowRecommended(open);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>推荐更新到 {recommendStatus?.latest_version}</DialogTitle>
              <DialogDescription>
                当前版本 {recommendStatus?.current_version}，此版本标记为推荐更新
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Release Note（可滚动） */}
        {recommendStatus?.release_body && (
          <div className="max-h-[40vh] overflow-y-auto scrollbar-fluent rounded-md border bg-muted/30 p-4">
            <div className="text-sm leading-relaxed space-y-2 text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {recommendStatus.release_body}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* 下载错误 */}
        {downloadError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            下载失败：{downloadError}
          </div>
        )}

        {/* 按钮：立即更新 / 忽略更新（本次）/ 取消（忽略此版本） */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelVersion}
            className="text-xs text-muted-foreground"
          >
            取消（忽略此版本）
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRecommended(false)}
            >
              <X className="h-4 w-4" />
              忽略更新
            </Button>
            <Button
              onClick={handleDownloadAndInstall}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "下载中..." : "立即更新"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
