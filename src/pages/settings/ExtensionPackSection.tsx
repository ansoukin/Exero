import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Package,
  FolderOpen,
  RefreshCw,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Save,
  LayoutPanelLeft,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  extensionPackCommands,
  settingCommands,
  type PackSummary,
  type Setting,
} from "@/lib/tauri";
import { useAppStore, packPageId } from "@/stores/app";
import { cn } from "@/lib/utils";

/**
 * 扩展包管理分区（Beta3 阶段 c · 扩展市场 UI）
 *
 * 功能：
 * - 安装扩展包：文件选择器选择 .exero-pack（zip）文件安装
 * - 卸载扩展包：所有来源可卸载（base-pack 已改为在线安装，不再内置捆绑）
 * - 打开目录：在文件管理器中打开可写目录，支持手动放置扩展包
 * - 自定义目录：设置额外扫描目录，保存后重新加载
 * - 已安装列表：卡片式展示，点击跳转详情页
 * - 侧边栏入口排序：上下移动扩展包注册的侧边栏入口，重置为默认
 */

/** 来源标签中文映射 */
function sourceLabel(source: string): string {
  switch (source) {
    case "builtin":
      return "内置";
    case "user":
      return "已安装";
    case "custom":
      return "自定义";
    default:
      return source;
  }
}

/** 来源标签样式 */
function sourceClass(source: string): string {
  switch (source) {
    case "builtin":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "user":
      return "bg-green-500/10 text-green-700 dark:text-green-400";
    case "custom":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ExtensionPackSection() {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [customDir, setCustomDir] = useState("");
  const [customDirOriginal, setCustomDirOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<PackSummary | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const setPage = useAppStore((s) => s.setPage);
  // 侧边栏入口排序（从 store 读取，与 Sidebar 共享状态）
  const dynamicNavEntries = useAppStore((s) => s.dynamicNavEntries);
  const sidebarOrder = useAppStore((s) => s.sidebarOrder);
  const setSidebarOrder = useAppStore((s) => s.setSidebarOrder);
  const bumpPackVersion = useAppStore((s) => s.bumpPackVersion);

  /** 加载扩展包列表 + 自定义目录 */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [packList, userDir] = await Promise.all([
        extensionPackCommands.listInstalledPacks(),
        extensionPackCommands.getUserDir(),
      ]);
      setPacks(packList);
      setCustomDir(userDir);
      setCustomDirOriginal(userDir);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 短暂提示（3 秒后自动消失） */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /** 安装扩展包（文件选择器） */
  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      const selected = await openDialog({
        title: "选择扩展包文件",
        filters: [
          { name: "Exero 扩展包", extensions: ["exero-pack"] },
          { name: "ZIP 压缩包", extensions: ["zip"] },
        ],
        multiple: false,
      });
      if (!selected || typeof selected !== "string") {
        setInstalling(false);
        return;
      }
      const summary = await extensionPackCommands.installPackFromFile(selected);
      showToast(`扩展包「${summary.name}」v${summary.version} 安装成功`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  /** 卸载扩展包 */
  const handleUninstall = async () => {
    if (!uninstallTarget) return;
    setUninstalling(true);
    setError(null);
    try {
      const uninstalledId = uninstallTarget.id;
      await extensionPackCommands.uninstallPack(uninstalledId);
      showToast(`扩展包「${uninstallTarget.name}」已卸载`);
      setUninstallTarget(null);
      // 清理 sidebarOrder 中已卸载的 pack_id，避免侧边栏残留占位
      if (sidebarOrder.includes(uninstalledId)) {
        const newOrder = sidebarOrder.filter((id) => id !== uninstalledId);
        setSidebarOrder(newOrder);
        // 持久化清理后的排序到 settings
        try {
          const setting: Setting = {
            key: "extension_pack.sidebar_order",
            value: JSON.stringify(newOrder),
            value_type: "json",
          };
          await settingCommands.set(setting);
        } catch {
          // 持久化失败不阻塞，下次启动会重新拉取
        }
      }
      // 触发 Sidebar 重新拉取侧边栏入口（移除已卸载插件的入口）
      bumpPackVersion();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUninstalling(false);
    }
  };

  /** 保存自定义目录 */
  const handleSaveCustomDir = async () => {
    setError(null);
    try {
      await extensionPackCommands.setUserDir(customDir.trim());
      await extensionPackCommands.reloadPacks();
      setCustomDirOriginal(customDir.trim());
      showToast("自定义目录已保存并重新扫描");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** 重新扫描 */
  const handleReload = async () => {
    setLoading(true);
    try {
      await extensionPackCommands.reloadPacks();
      await loadData();
      showToast("已重新扫描扩展包目录");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  const customDirDirty = customDir !== customDirOriginal;

  /** 侧边栏入口排序常量 */
  const SIDEBAR_ORDER_KEY = "extension_pack.sidebar_order";

  /** 按 sidebarOrder 排序后的动态入口（与 Sidebar 逻辑一致） */
  const sortedNavEntries = (() => {
    if (sidebarOrder.length === 0) return dynamicNavEntries;
    return [...dynamicNavEntries].sort((a, b) => {
      const idxA = sidebarOrder.indexOf(a.packId);
      const idxB = sidebarOrder.indexOf(b.packId);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  })();

  /** 持久化排序到 settings */
  const persistOrder = useCallback(
    async (order: string[]) => {
      try {
        const setting: Setting = {
          key: SIDEBAR_ORDER_KEY,
          value: JSON.stringify(order),
          value_type: "json",
        };
        await settingCommands.set(setting);
      } catch (e) {
        console.warn("[ExtensionPackSection] 持久化侧边栏排序失败:", e);
      }
    },
    [],
  );

  /** 上移入口 */
  const handleMoveUp = useCallback(
    (packId: string) => {
      const currentOrder =
        sidebarOrder.length > 0
          ? sidebarOrder
          : sortedNavEntries.map((e) => e.packId);
      const idx = currentOrder.indexOf(packId);
      if (idx <= 0) return;
      const newOrder = [...currentOrder];
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
      setSidebarOrder(newOrder);
      void persistOrder(newOrder);
    },
    [sidebarOrder, sortedNavEntries, setSidebarOrder, persistOrder],
  );

  /** 下移入口 */
  const handleMoveDown = useCallback(
    (packId: string) => {
      const currentOrder =
        sidebarOrder.length > 0
          ? sidebarOrder
          : sortedNavEntries.map((e) => e.packId);
      const idx = currentOrder.indexOf(packId);
      if (idx === -1 || idx >= currentOrder.length - 1) return;
      const newOrder = [...currentOrder];
      [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
      setSidebarOrder(newOrder);
      void persistOrder(newOrder);
    },
    [sidebarOrder, sortedNavEntries, setSidebarOrder, persistOrder],
  );

  /** 重置排序 */
  const handleResetOrder = useCallback(async () => {
    setSidebarOrder([]);
    try {
      const setting: Setting = {
        key: SIDEBAR_ORDER_KEY,
        value: "[]",
        value_type: "json",
      };
      await settingCommands.set(setting);
      showToast("已重置侧边栏排序");
    } catch (e) {
      console.warn("[ExtensionPackSection] 重置排序失败:", e);
    }
  }, [setSidebarOrder]);

  return (
    <div className="flex flex-col gap-6">
      {/* 操作栏 */}
      <section className="flex flex-wrap items-center gap-2">
        <Button onClick={handleInstall} disabled={installing} className="gap-2">
          {installing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          安装扩展包
        </Button>
        <Button
          variant="outline"
          onClick={() => extensionPackCommands.openPacksDir("user")}
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          打开扩展包目录
        </Button>
        <Button
          variant="outline"
          onClick={handleReload}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          重新扫描
        </Button>
      </section>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-destructive/70 hover:text-destructive"
          >
            ×
          </button>
        </div>
      )}

      {/* 成功提示 */}
      {toast && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* 已安装扩展包列表 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">
            已安装扩展包
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              （{packs.length} 个）
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">暂无已安装扩展包</p>
            <p className="text-xs text-muted-foreground/70">
              点击上方「安装扩展包」选择 .exero-pack 文件，或打开目录手动放置
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                onView={() => setPage(packPageId(pack.id))}
                onUninstall={() => setUninstallTarget(pack)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 侧边栏入口排序 */}
      <section className="flex flex-col gap-3 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">侧边栏入口排序</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              扩展包注册的侧边栏入口顺序（内置导航固定，不可调整）
            </p>
          </div>
          {dynamicNavEntries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetOrder}
              className="gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
          )}
        </div>

        {dynamicNavEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <LayoutPanelLeft className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              暂无扩展包注册侧边栏入口
            </p>
            <p className="text-xs text-muted-foreground/70">
              安装带侧边栏入口的扩展包后将显示在这里
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortedNavEntries.map((entry, idx) => (
              <div
                key={entry.pageId}
                className="flex items-center gap-2 rounded-md border bg-card p-2"
              >
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                  {idx + 1}
                </span>
                <LayoutPanelLeft className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate text-sm">{entry.label}</span>
                <code className="shrink-0 text-[10px] text-muted-foreground">
                  {entry.packId}
                </code>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveUp(entry.packId)}
                    disabled={idx === 0}
                    title="上移"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveDown(entry.packId)}
                    disabled={idx === sortedNavEntries.length - 1}
                    title="下移"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 自定义目录设置 */}
      <section className="flex flex-col gap-3 border-t pt-6">
        <div>
          <h3 className="text-base font-medium">自定义扩展包目录</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            配置扩展包的存放位置，留空则使用默认目录
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDir}
            onChange={(e) => setCustomDir(e.target.value)}
            placeholder="留空表示不使用自定义目录"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            variant="outline"
            onClick={async () => {
              const selected = await openDialog({
                title: "选择扩展包目录",
                directory: true,
                multiple: false,
              });
              if (typeof selected === "string") {
                setCustomDir(selected);
              }
            }}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            浏览
          </Button>
          <Button
            onClick={handleSaveCustomDir}
            disabled={!customDirDirty}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            保存
          </Button>
        </div>
      </section>

      {/* 卸载确认弹窗 */}
      <Dialog
        open={!!uninstallTarget}
        onOpenChange={(o) => !uninstalling && !o && setUninstallTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              确认卸载扩展包
            </DialogTitle>
            <DialogDescription>
              即将卸载扩展包「{uninstallTarget?.name}」v{uninstallTarget?.version}。
              卸载后将删除其目录下的所有文件，该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUninstallTarget(null)}
              disabled={uninstalling}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleUninstall}
              disabled={uninstalling}
              className="gap-2"
            >
              {uninstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              确认卸载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 扩展包卡片 */
interface PackCardProps {
  pack: PackSummary;
  onView: () => void;
  onUninstall: () => void;
}

function PackCard({ pack, onView, onUninstall }: PackCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-accent/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Package className="h-5 w-5 text-primary" />
      </div>

      {/* 主体信息 */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{pack.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            v{pack.version}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              sourceClass(pack.source),
            )}
          >
            {sourceLabel(pack.source)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>作者：{pack.author || "—"}</span>
          {pack.pack_type === "plugin" ? (
            <span>页面型插件</span>
          ) : (
            <span>动作：{pack.action_count} 个</span>
          )}
          {pack.has_sidebar && (
            <span className="flex items-center gap-1">
              <LayoutPanelLeft className="h-3 w-3" />
              侧边栏入口
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="gap-1 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          详情
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onUninstall}
          className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          卸载
        </Button>
      </div>
    </div>
  );
}
