/**
 * 插件分区（Beta9 · 任务6：插件协议拓展）
 *
 * 类似安卓应用管理的插件管理页（仅 pack_type=plugin）：
 * - 持久运行开关（退出插件页面后 iframe 是否保活，settings: plugin.keep_alive.{id}，默认开）
 * - 缓存清理（清空插件宿主存储 plugin_storage，用户配置随插件卸载删除）
 * - 强制停止（销毁常驻 iframe，低内存场景手动回收）
 * - 权限徽章：页面显示 / 本地存储 / 后台运行（插件能力集，只读）
 *
 * 不开放：系统操作（注册表/电源/进程）、系统能力（通知/托盘/启动项）。
 */

import { useEffect, useState } from "react";
import { Plug, Loader2, Trash2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { extensionPackCommands, settingCommands, type Setting, type PackSummary } from "@/lib/tauri";
import { keepAliveKey, usePluginHostStore } from "@/stores/pluginHost";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/** 轻量徽章（项目无 shadcn badge 组件，内联样式替代） */
function MiniBadge({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-medium",
        primary
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** 插件能力徽章（只读展示，不提供系统级权限） */
function PermissionBadges({ keepAlive }: { keepAlive: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <MiniBadge>页面显示</MiniBadge>
      <MiniBadge>本地存储</MiniBadge>
      {keepAlive && <MiniBadge primary>后台运行</MiniBadge>}
    </div>
  );
}

/** 单个插件卡片 */
function PluginCard({ pack }: { pack: PackSummary }) {
  const [keepAlive, setKeepAlive] = useState<boolean | null>(null); // null = 加载中
  const [clearing, setClearing] = useState(false);
  const plugins = usePluginHostStore((s) => s.plugins);
  const closePlugin = usePluginHostStore((s) => s.close);
  const running = !!plugins[pack.id];

  // 加载 keep_alive 设置
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await settingCommands.get(keepAliveKey(pack.id));
        if (mounted) setKeepAlive(s ? s.value !== "false" : true);
      } catch {
        if (mounted) setKeepAlive(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pack.id]);

  const toggleKeepAlive = async (enabled: boolean) => {
    setKeepAlive(enabled);
    try {
      const setting: Setting = {
        key: keepAliveKey(pack.id),
        value: enabled ? "true" : "false",
        value_type: "bool",
      };
      await settingCommands.set(setting);
    } catch (e) {
      // 失败回滚状态
      setKeepAlive(!enabled);
      toast.error("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await extensionPackCommands.pluginStorageClear(pack.id);
      toast.success(`已清理 ${pack.name} 的缓存数据`);
    } catch (e) {
      toast.error("清理失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* 头部：图标 + 名称 + 版本 + 运行状态 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{pack.name}</p>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              v{pack.version}
            </span>
            {running && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                运行中
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {pack.id} · {pack.author || "未知作者"}
          </p>
        </div>
      </div>

      {/* 持久运行开关 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">退出页面后保持运行</p>
          <p className="text-xs text-muted-foreground">
            关闭后离开插件页面即停止（如音乐播放暂停）
          </p>
        </div>
        {keepAlive === null ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Switch checked={keepAlive} onCheckedChange={toggleKeepAlive} />
        )}
      </div>

      {/* 权限徽章 */}
      <PermissionBadges keepAlive={keepAlive !== false} />

      {/* 操作行 */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleClearCache}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          清理缓存
        </Button>
        {running && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => closePlugin(pack.id)}
            title="销毁常驻进程（下次打开重新加载）"
          >
            <Square className="h-3 w-3" />
            强制停止
          </Button>
        )}
      </div>
    </Card>
  );
}

export function PluginsSection() {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await extensionPackCommands.listInstalledPacks();
        // 仅插件（动作包在"扩展"分区管理）
        if (mounted) setPacks(all.filter((p) => p.pack_type === "plugin"));
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">加载失败: {error}</p>;
  }

  if (!packs) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载已安装插件...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">插件</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          管理已安装插件的运行行为与缓存。插件默认在退出页面后继续运行（类似浏览器扩展）
        </p>
      </div>

      {packs.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Plug className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            暂无已安装插件，可前往扩展市场安装
          </p>
        </Card>
      ) : (
        packs.map((pack) => <PluginCard key={pack.id} pack={pack} />)
      )}
    </div>
  );
}
