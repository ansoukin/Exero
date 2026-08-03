/**
 * Lua 脚本市场 Tab（SPEC 3.5 页面 3 第 4 Tab + 第六章）
 *
 * 直连 GitHub 仓库 scripts/ 目录浏览/安装/更新/卸载脚本。
 * 网络失败时进入离线模式（仅显示已安装脚本）。
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpCircle,
  Download,
  Info,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { luaCommands, type MarketScript, type ScriptParam } from "@/lib/tauri";

export function LuaMarketTab() {
  const [scripts, setScripts] = useState<MarketScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketScript | null>(null);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await luaCommands.listMarket();
      setScripts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  // 离线模式推断：市场列表无未安装项时，可能处于离线（仅返回了已安装）
  const offlineHint =
    !loading && scripts.length > 0 && scripts.every((s) => s.installed);

  async function handleInstall(id: string) {
    setOperatingId(id);
    try {
      await luaCommands.install(id);
      await loadMarket();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  async function handleUninstall(id: string) {
    if (!confirm(`确定卸载脚本？卸载后使用该脚本的指令将无法执行。`)) return;
    setOperatingId(id);
    try {
      await luaCommands.uninstall(id);
      await loadMarket();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  async function handleUpdate(id: string) {
    setOperatingId(id);
    try {
      await luaCommands.update(id);
      await loadMarket();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-muted-foreground">
          共 {scripts.length} 个脚本
        </p>
        <Button onClick={loadMarket} size="sm" variant="outline" className="gap-1">
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            关闭
          </Button>
        </div>
      )}

      {/* 离线提示 */}
      {offlineHint && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            市场暂未发现新脚本，可能处于离线模式（仅显示已安装）。请检查网络后刷新。
          </span>
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载市场...
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Package className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">市场为空</p>
            <p className="mt-1 text-xs">
              仓库 scripts/ 目录暂无脚本，或网络不可达
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {scripts.map((s) => (
              <ScriptCard
                key={s.id}
                script={s}
                operating={operatingId === s.id}
                onInstall={() => handleInstall(s.id)}
                onUninstall={() => handleUninstall(s.id)}
                onUpdate={() => handleUpdate(s.id)}
                onShowDetail={() => setDetail(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 详情 Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {detail?.name}
              <span className="text-xs font-mono text-muted-foreground">
                v{detail?.version}
              </span>
            </DialogTitle>
            <DialogDescription>
              作者：{detail?.author || "匿名"} · ID：{detail?.id}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 pt-2">
              {/* 描述 */}
              {detail.description && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    描述
                  </p>
                  <p className="text-sm">{detail.description}</p>
                </div>
              )}

              {/* 权限声明 */}
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ShieldAlert className="h-3 w-3" />
                  权限声明
                </p>
                {detail.permissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    无（严格沙箱下运行，仅需默认权限）
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {detail.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-400"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  含权限声明的脚本需在设置中开启宽松沙箱才能完整运行
                </p>
              </div>

              {/* 参数定义 */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  参数定义（{detail.params.length} 个）
                </p>
                {detail.params.length === 0 ? (
                  <p className="text-xs text-muted-foreground">无参数</p>
                ) : (
                  <div className="space-y-2">
                    {detail.params.map((param) => (
                      <ParamRow key={param.name} param={param} />
                    ))}
                  </div>
                )}
              </div>

              {/* 状态 */}
              <div className="rounded-md bg-muted/40 p-2 text-xs">
                <p>
                  状态：
                  {detail.installed
                    ? detail.update_available
                      ? `已安装 v${detail.installed_version}（可更新到 v${detail.version}）`
                      : `已安装 v${detail.installed_version}`
                    : "未安装"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 单个脚本卡片 */
function ScriptCard({
  script,
  operating,
  onInstall,
  onUninstall,
  onUpdate,
  onShowDetail,
}: {
  script: MarketScript;
  operating: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  onShowDetail: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={onShowDetail}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Package className="h-3.5 w-3.5 text-primary" />
            {script.name}
          </CardTitle>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            v{script.version}
          </span>
        </div>
        <CardDescription className="text-xs">
          {script.author ? `作者：${script.author}` : "作者：匿名"}
        </CardDescription>
      </CardHeader>

      <CardContent
        className="flex-1 cursor-pointer py-1"
        onClick={onShowDetail}
      >
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {script.description || "（无描述）"}
        </p>
        {script.permissions.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] text-amber-700 dark:text-amber-400">
              需宽松沙箱（{script.permissions.length} 项权限）
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-1.5 pt-2">
        {operating ? (
          <Button size="sm" variant="outline" disabled className="gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            处理中
          </Button>
        ) : script.installed ? (
          <>
            {script.update_available && (
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={onUpdate}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                更新
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={onUninstall}
            >
              <Trash2 className="h-3.5 w-3.5" />
              卸载
            </Button>
          </>
        ) : (
          <Button size="sm" className="gap-1" onClick={onInstall}>
            <Download className="h-3.5 w-3.5" />
            安装
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** 参数定义行（详情 Dialog 内） */
function ParamRow({ param }: { param: ScriptParam }) {
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{param.label}</span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {param.name}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1 py-0.5 font-mono">
          {param.type}
        </span>
        {param.required && (
          <span className="text-destructive">必填</span>
        )}
        <span>
          默认：
          {param.default === null || param.default === undefined
            ? "（无）"
            : String(param.default)}
        </span>
      </div>
      {param.type === "select" && param.options.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {param.options.map((opt) => (
            <span
              key={opt}
              className="rounded bg-muted/60 px-1 py-0.5 text-[10px]"
            >
              {opt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
