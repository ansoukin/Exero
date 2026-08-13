import { useEffect, useState } from "react";
import {
  Puzzle,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { extensionPackCommands, type PackDetail } from "@/lib/tauri";
import { useAppStore } from "@/stores/app";

interface PluginPageProps {
  /** 插件扩展包 id */
  packId: string;
}

/**
 * 插件页面（Phase 3 · SPEC 6.5）
 *
 * 通过 iframe 加载插件前端资源（`http://plugin.localhost/{pack_id}/{entry}`），
 * 监听 iframe 内桥接脚本发出的 postMessage 请求，转发到后端 execute_plugin_action 命令，
 * 将 .dll 调用结果通过 postMessage 返回 iframe。
 *
 * 数据流：
 * ```text
 * iframe (window.exero.invoke)
 *   -> postMessage({type:'exero-invoke', id, actionId, params})
 * PluginPage (message 监听)
 *   -> extensionPackCommands.executePluginAction(packId, actionId, params)
 *   -> 后端 execute_plugin_action 命令
 *   -> RustLibraryRegistry::execute (C ABI 调用 .dll)
 *   <- JSON 结果
 * PluginPage
 *   -> postMessage({type:'exero-result', id, result|error}) -> iframe
 * iframe (Promise resolve/reject)
 * ```
 */
export function PluginPage({ packId }: PluginPageProps) {
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setPage = useAppStore((s) => s.setPage);

  // 加载插件 manifest，验证 pack_type=plugin 且有 ui 声明
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await extensionPackCommands.getPackDetail(packId);
        if (!mounted) return;
        if (!detail) {
          setError("插件不存在或未加载");
        } else if (detail.manifest.pack_type !== "plugin") {
          setError(`扩展包 ${packId} 不是插件类型`);
        } else if (!detail.manifest.ui) {
          setError("插件缺少 ui 声明（manifest.json 的 ui.entry 字段）");
        } else {
          setPack(detail);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [packId]);

  // 监听 iframe postMessage，转发到 execute_plugin_action
  useEffect(() => {
    if (!pack) return;

    const handler = async (event: MessageEvent) => {
      const data = event.data;
      // 仅处理插件桥接请求（动作调用 + 存储 API）
      if (!data || (data.type !== "exero-invoke" && data.type !== "exero-storage")) {
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
          // 插件存储 API：读写宿主持久化存储（按 pack_id 隔离）
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
        // 将结果回传给 iframe
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
  }, [pack, packId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载插件...
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <div className="space-y-1">
          <p className="text-base font-medium text-foreground">
            {error || "插件加载失败"}
          </p>
          <p className="text-sm text-muted-foreground">
            请检查插件 manifest.json 是否正确声明 ui 字段
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPage("settings")}>
          返回设置
        </Button>
      </div>
    );
  }

  // 插件前端入口 URL（Tauri v2 Windows：http://{scheme}.localhost/{path}）
  const entry = pack.manifest.ui!.entry;
  const iframeSrc = `http://plugin.localhost/${packId}/${entry}`;

  // hide_header=true 时隐藏标题栏，插件 iframe 撑满整个区域
  const hideHeader = pack.manifest.hide_header;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 标题栏（hide_header=true 时隐藏） */}
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
                <h1 className="text-2xl font-semibold tracking-tight">
                  {pack.manifest.name}
                </h1>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  v{pack.manifest.version}
                </span>
                <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                  插件
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {pack.manifest.id} · {pack.manifest.author || "未知作者"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* iframe 区：加载插件前端资源（min-h-0 确保 flex 子项可收缩，iframe 撑满剩余高度） */}
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        <iframe
          src={iframeSrc}
          title={pack.manifest.name}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}
