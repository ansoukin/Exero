/**
 * URL 短域名别名配置（Phase 6b · SPEC 11.3）
 *
 * OpenUrl 动作的 URL 自动补全增强功能。用户可在设置页配置短域名别名映射表，
 * OpenUrl 动作执行时自动解析别名并重写为完整 URL。
 *
 * 解析优先级（详见后端 models/url_alias.rs::resolve_url）：
 * 1. 别名匹配：输入完全等于某别名 -> 直接替换为目标 URL
 * 2. scheme 补全：输入无 :// -> 补全 https://
 * 3. 原样使用：输入已含 scheme -> 保持不变
 *
 * 默认别名（SPEC 11.3）：baidu / google / github / bing
 */

import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw, Loader2, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { urlAliasCommands, type UrlAlias } from "@/lib/tauri";

export function UrlAliasSection() {
  const [aliases, setAliases] = useState<UrlAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    urlAliasCommands
      .list()
      .then(setAliases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  /** 实时保存（SPEC 11.3：修改后立即写入 settings，无需额外保存按钮） */
  const persist = async (next: UrlAlias[]) => {
    setSaving(true);
    setError(null);
    try {
      await urlAliasCommands.set(next);
      setAliases(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const next = [...aliases, { alias: "", target: "" }];
    setAliases(next);
    // 不立即保存空项（后端会过滤），等用户填入内容后再保存
  };

  const handleRemove = (index: number) => {
    const next = aliases.filter((_, i) => i !== index);
    persist(next);
  };

  const handleChange = (index: number, field: keyof UrlAlias, value: string) => {
    const next = aliases.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setAliases(next);
  };

  const handleBlur = () => {
    // 失焦时保存（过滤空项由后端处理）
    persist(aliases);
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      const defaults = await urlAliasCommands.reset();
      setAliases(defaults);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Link2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-medium">URL 短域名别名</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            为 OpenUrl 动作配置短别名，例如输入 "baidu" 自动重写为 "https://www.baidu.com"。修改后自动保存。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置为默认
        </Button>
      </div>

      {/* 别名列表 */}
      <div className="flex flex-col gap-2">
        {/* 表头 */}
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 px-2 text-xs font-medium text-muted-foreground">
          <span>别名</span>
          <span>目标 URL</span>
          <span className="w-8" />
        </div>

        {aliases.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            暂无别名，点击下方"添加别名"按钮新建
          </div>
        )}

        {aliases.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_2fr_auto] items-center gap-2"
          >
            <Input
              value={item.alias}
              placeholder="如 baidu"
              onChange={(e) => handleChange(index, "alias", e.target.value)}
              onBlur={handleBlur}
              className="text-sm"
            />
            <Input
              value={item.target}
              placeholder="如 https://www.baidu.com"
              onChange={(e) => handleChange(index, "target", e.target.value)}
              onBlur={handleBlur}
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              disabled={saving}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={handleAdd}
          disabled={saving}
          className="mt-1 w-fit gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          添加别名
        </Button>
      </div>

      {/* 状态指示 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {saving && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            保存中...
          </>
        )}
        {!saving && !error && aliases.length > 0 && (
          <>已保存（{aliases.length} 条别名）</>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
