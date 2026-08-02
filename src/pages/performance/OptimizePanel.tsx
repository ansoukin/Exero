/**
 * 一键优化面板（SPEC 3.6 页面 4）
 *
 * 包含：
 * - 一键优化按钮（结束黑名单进程 + 降级高 CPU 进程 + 清理内存）
 * - 优化结果展示（结束/降级/释放内存/错误）
 * - 黑名单管理弹窗（增删黑名单进程名）
 */

import { useCallback, useEffect, useState } from "react";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Plus,
  X,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  performanceCommands,
  type OptimizeResult,
} from "@/lib/tauri";

/** 字节格式化为 MB/GB */
function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export function OptimizePanel() {
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 黑名单弹窗状态
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOptimize = async () => {
    setOptimizing(true);
    setError(null);
    try {
      const res = await performanceCommands.oneClickOptimize();
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOptimizing(false);
    }
  };

  const loadBlacklist = useCallback(async () => {
    setBlacklistLoading(true);
    try {
      const list = await performanceCommands.getBlacklist();
      setBlacklist(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBlacklistLoading(false);
    }
  }, []);

  const handleAddBlacklistItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    // 去重（忽略大小写）
    if (blacklist.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
      setNewItem("");
      return;
    }
    setBlacklist([...blacklist, trimmed]);
    setNewItem("");
  };

  const handleRemoveBlacklistItem = (index: number) => {
    setBlacklist(blacklist.filter((_, i) => i !== index));
  };

  const handleSaveBlacklist = async () => {
    setSaving(true);
    try {
      await performanceCommands.setBlacklist(blacklist);
      setBlacklistOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // 打开黑名单弹窗时加载
  useEffect(() => {
    if (blacklistOpen) {
      loadBlacklist();
    }
  }, [blacklistOpen, loadBlacklist]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              一键优化
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setBlacklistOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              黑名单配置
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              onClick={handleOptimize}
              disabled={optimizing}
              className="gap-2"
            >
              {optimizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  优化中...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  立即优化
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              结束黑名单进程 · 降级高 CPU 进程 · 清理内存
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* 优化结果 */}
          {result && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                优化完成
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-card px-2 py-1.5">
                  <div className="text-muted-foreground">结束进程</div>
                  <div className="font-mono font-semibold text-destructive">
                    {result.killed_processes.length}
                  </div>
                </div>
                <div className="rounded bg-card px-2 py-1.5">
                  <div className="text-muted-foreground">降级进程</div>
                  <div className="font-mono font-semibold text-amber-500">
                    {result.demoted_processes.length}
                  </div>
                </div>
                <div className="rounded bg-card px-2 py-1.5">
                  <div className="text-muted-foreground">释放内存</div>
                  <div className="font-mono font-semibold text-emerald-500">
                    {formatBytes(result.memory_freed_bytes)}
                  </div>
                </div>
              </div>

              {/* 详细列表 */}
              {result.killed_processes.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">已结束：</span>
                  <span className="font-mono">
                    {result.killed_processes.join(", ")}
                  </span>
                </div>
              )}
              {result.demoted_processes.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">已降级：</span>
                  <span className="font-mono">
                    {result.demoted_processes.join(", ")}
                  </span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-xs text-destructive">
                  <span>错误：</span>
                  <span className="font-mono">{result.errors.join("; ")}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 黑名单配置弹窗 */}
      <Dialog open={blacklistOpen} onOpenChange={setBlacklistOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-5 w-5 text-primary" />
              优化黑名单配置
            </DialogTitle>
            <DialogDescription>
              一键优化时会结束列表中的进程（按进程名匹配，不区分大小写）。
              新用户默认预置常见后台更新服务，可自行增删。
            </DialogDescription>
          </DialogHeader>

          {blacklistLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <div className="space-y-3">
              {/* 添加新项 */}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">进程名（如 chrome.exe）</Label>
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBlacklistItem();
                      }
                    }}
                    placeholder="输入进程名后回车添加"
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleAddBlacklistItem}
                  title="添加"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 黑名单列表 */}
              <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-fluent">
                {blacklist.length === 0 ? (
                  <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                    黑名单为空，一键优化不会结束任何进程
                  </div>
                ) : (
                  blacklist.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5"
                    >
                      <span className="truncate font-mono text-xs">{item}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveBlacklistItem(index)}
                        title="删除"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {blacklist.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1 text-xs text-muted-foreground"
                  onClick={() => setBlacklist([])}
                >
                  <Trash2 className="h-3 w-3" />
                  清空全部
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlacklistOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSaveBlacklist} disabled={saving || blacklistLoading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
