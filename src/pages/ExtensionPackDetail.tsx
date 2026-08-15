import { useEffect, useState } from "react";
import {
  Package,
  ArrowLeft,
  Loader2,
  AlertCircle,
  User,
  Tag,
  FolderOpen,
  Sidebar,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PackIcon } from "@/components/PackIcon";
import {
  extensionPackCommands,
  type PackDetail,
  type ActionManifest,
} from "@/lib/tauri";
import { useAppStore } from "@/stores/app";
import { PluginActivator } from "@/components/PluginHostLayer";

/** 来源标签映射 */
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  builtin: { label: "内置", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  user: { label: "用户", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  custom: { label: "自定义", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

/** 类别中文显示名 */
const CATEGORY_LABELS: Record<string, string> = {
  app: "应用与文件",
  media: "媒体与输入",
  system: "系统与电源",
  notification: "通知",
  control: "控制流",
  lua: "Lua 脚本",
};

interface ExtensionPackDetailPageProps {
  /** 扩展包 id */
  packId: string;
}

/**
 * 扩展包详情页（Beta3 · 扩展包架构）
 *
 * 统一详情页（PageType::Detail）：
 * - 扩展包元数据：名称、版本、作者、描述、API 版本
 * - 来源信息：目录类型（内置/用户/自定义）+ 根目录路径
 * - 动作列表：id、显示名、类别、执行器类型
 * - 侧边栏入口信息（如已注册）
 *
 * 从侧边栏动态入口点击进入，返回回到上一页。
 */
export function ExtensionPackDetailPage({ packId }: ExtensionPackDetailPageProps) {
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await extensionPackCommands.getPackDetail(packId);
        if (!mounted) return;
        if (!detail) {
          setError("扩展包不存在或未加载");
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载扩展包详情...
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <div className="space-y-1">
          <p className="text-base font-medium text-foreground">
            {error || "扩展包不存在"}
          </p>
          <p className="text-sm text-muted-foreground">
            扩展包可能已被移除或未正确加载
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPage("settings")}>
          返回设置
        </Button>
      </div>
    );
  }

  // 插件类型：注册到常驻宿主层（Beta9 任务6 持久运行，iframe 切页保活）
  if (pack.manifest.pack_type === "plugin") {
    return <PluginActivator packId={packId} />;
  }

  const sourceInfo = SOURCE_LABELS[pack.summary.source] ?? SOURCE_LABELS.user;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
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
          <Package className="h-6 w-6 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {pack.manifest.name}
              </h1>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                v{pack.manifest.version}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  sourceInfo.color,
                )}
              >
                {sourceInfo.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {pack.manifest.id} ·{" "}
              {pack.summary.pack_type === "plugin" ? (
                <span>页面型插件（不提供快捷指令动作）</span>
              ) : (
                <span>{pack.summary.action_count} 个动作</span>
              )}
              {pack.summary.has_sidebar && " · 注册侧边栏入口"}
            </p>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto scrollbar-fluent p-6 density-aware">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* 元数据卡片 */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              扩展包信息
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetaItem icon={User} label="作者" value={pack.manifest.author || "未知"} />
              <MetaItem
                icon={Tag}
                label="API 版本"
                value={`v${pack.manifest.exero_api_version}`}
              />
              <MetaItem
                icon={FolderOpen}
                label="根目录"
                value={pack.pack_dir}
                mono
              />
              <MetaItem
                icon={Sidebar}
                label="侧边栏入口"
                value={
                  pack.manifest.sidebar
                    ? `${pack.manifest.sidebar.label} (${pack.manifest.sidebar.id})`
                    : "未注册"
                }
              />
            </div>
            {pack.manifest.description && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {pack.manifest.description}
                </p>
              </div>
            )}
          </section>

          {/* 动作列表 */}
          <section className="rounded-lg border bg-card">
            <div className="border-b px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                动作列表（{pack.manifest.actions.length}）
              </h2>
            </div>
            <div className="divide-y">
              {pack.manifest.actions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** 元数据项 */
function MetaItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm text-foreground break-all",
            mono && "font-mono text-xs",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** 动作列表行 */
function ActionRow({ action }: { action: ActionManifest }) {
  const categoryLabel = CATEGORY_LABELS[action.category] ?? action.category;
  const executorLabel =
    action.executor_type === "rust" ? "Rust" : "Lua";

  return (
    <div className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50">
      {/* Beta9 任务15：三源图标（lucide 名 / segoe: / img: URL）统一渲染 */}
      <PackIcon
        spec={action.icon}
        size={16}
        className="shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{action.label}</p>
        <p className="font-mono text-xs text-muted-foreground">{action.id}</p>
      </div>
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {categoryLabel}
      </span>
      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        {executorLabel}
      </span>
    </div>
  );
}
