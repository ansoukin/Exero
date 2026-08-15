/**
 * 插件宿主层（Beta9 · 任务6：插件持久运行）
 *
 * 常驻 Layout 的 iframe 容器（类 Chrome 扩展后台页）：
 * - 每个存活插件一个独立 iframe + 独立 postMessage 桥（invoke / storage）
 * - activePackId 对应的 iframe 覆盖主内容区展示，其余 display:none 保活
 *   （Chromium 下 display:none 的 iframe 音频播放 / 定时器继续运行）
 * - iframe src 全生命周期稳定，React 重渲染不重载插件
 *
 * 消息桥（自 PluginPage 迁移，逻辑不变）：
 * iframe (window.exero.invoke/storage)
 *   -> postMessage -> PluginHostLayer 转发 Tauri 命令 -> postMessage 回传
 */

import { useEffect, useMemo } from "react";
import { Puzzle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extensionPackCommands } from "@/lib/tauri";
import { useAppStore } from "@/stores/app";
import { usePluginHostStore, type PluginInstance } from "@/stores/pluginHost";

/**
 * 插件激活器（ExtensionPackDetail 分发用）
 *
 * 挂载时注册插件到宿主；卸载（用户离开插件页面）时按 keep_alive 设置
 * 决定销毁或保活。渲染 null（实际 UI 由 PluginHostLayer 覆盖层展示）。
 */
export function PluginActivator({ packId }: { packId: string }) {
  const open = usePluginHostStore((s) => s.open);
  const close = usePluginHostStore((s) => s.close);
  const shouldKeepAlive = usePluginHostStore((s) => s.shouldKeepAlive);
  const setActive = usePluginHostStore((s) => s.setActive);

  useEffect(() => {
    void open(packId);
  }, [open, packId]);

  // 离开插件页面：keep_alive=false 时销毁 iframe（默认保活）
  useEffect(() => {
    return () => {
      setActive(null);
      void shouldKeepAlive(packId).then((keep) => {
        if (!keep) close(packId);
      });
    };
  }, [packId, setActive, shouldKeepAlive, close]);

  return null;
}

/** 单个插件 iframe + 消息桥 */
function PluginFrame({
  instance,
  visible,
}: {
  instance: PluginInstance;
  visible: boolean;
}) {
  const { packId, entry, title, version, hideHeader } = instance;
  const setPage = useAppStore((s) => s.setPage);
  const iframeSrc = useMemo(
    () => `http://plugin.localhost/${packId}/${entry}`,
    [packId, entry],
  );

  // 消息桥：转发 invoke / storage 请求到 Tauri 命令（自 PluginPage 迁移）
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (
        !data ||
        (data.type !== "exero-invoke" && data.type !== "exero-storage")
      ) {
        return;
      }
      const { id } = data as { id: string };
      try {
        let result: unknown;
        if (data.type === "exero-invoke") {
          const { actionId, params } = data as {
            actionId: string;
            params: Record<string, unknown> | null;
          };
          result = await extensionPackCommands.executePluginAction(
            packId,
            actionId,
            params ?? {},
          );
        } else {
          const { op, key, value } = data as {
            op: string;
            key?: string;
            value?: unknown;
          };
          switch (op) {
            case "get":
              result = await extensionPackCommands.pluginStorageGet(packId, key!);
              break;
            case "set":
              await extensionPackCommands.pluginStorageSet(packId, key!, value);
              break;
            case "remove":
              await extensionPackCommands.pluginStorageRemove(packId, key!);
              break;
            case "clear":
              await extensionPackCommands.pluginStorageClear(packId);
              break;
            case "keys":
              result = await extensionPackCommands.pluginStorageKeys(packId);
              break;
            default:
              throw new Error("未知的存储操作: " + op);
          }
        }
        event.source?.postMessage(
          { type: "exero-result", id, result },
          { targetOrigin: "*" },
        );
      } catch (e) {
        event.source?.postMessage(
          {
            type: "exero-result",
            id,
            error: e instanceof Error ? e.message : String(e),
          },
          { targetOrigin: "*" },
        );
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [packId]);

  return (
    <div
      className={
        visible
          ? "absolute inset-0 z-20 flex flex-col overflow-hidden bg-background"
          : "hidden" /* display:none 保活：音频/定时器继续，不参与布局 */
      }
    >
      {/* 宿主标题栏（hide_header=true 时由插件自绘） */}
      {!hideHeader && (
        <div className="flex shrink-0 items-center justify-between border-b bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage("settings")}
              className="h-9 w-9"
              title="返回"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Puzzle className="h-6 w-6 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  v{version}
                </span>
                <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                  插件
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{packId}</p>
            </div>
          </div>
        </div>
      )}

      {/* iframe 区：src 稳定，切页不重载（持久运行核心） */}
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        <iframe
          src={iframeSrc}
          title={title}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}

/** 宿主层：渲染所有存活插件，活跃者可见（absolute 覆盖主内容区），其余 display:none 保活 */
export function PluginHostLayer() {
  const plugins = usePluginHostStore((s) => s.plugins);
  const activePackId = usePluginHostStore((s) => s.activePackId);

  return (
    <>
      {Object.values(plugins).map((instance) => (
        <PluginFrame
          key={instance.packId}
          instance={instance}
          visible={instance.packId === activePackId}
        />
      ))}
    </>
  );
}
