/**
 * 扩展市场列表组件（Beta3 · 已独立为侧边栏主页面）
 *
 * 直连 GitHub 仓库 ansoukin/Exero 的 action-packs/ 目录，
 * 浏览 / 安装 / 更新 / 卸载 .exero-pack 扩展包。
 *
 * 网络策略：github.com 主 → ghproxy 镜像后备 → 离线模式（仅已安装）。
 *
 * UI/UX 增强（类 Modrinth/CurseForge）：
 * - 搜索：防抖 500ms + 骨架屏加载
 * - 分页：上一页/下一页 + 页码
 * - 每页显示数：12 / 24 / 48
 * - 类型筛选 Tag：全部 / 动作包 / Lua 脚本
 * - 响应式卡片：宽屏长横幅（类 Modrinth），窄屏回退网格
 * - 骨架屏加载动画（零布局跳动）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
  Package,
  RefreshCw,
  Search,
  LayoutPanelLeft,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  extensionPackCommands,
  extensionPackMarketCommands,
  type MarketPack,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";

/** 每页显示数选项 */
const PAGE_SIZE_OPTIONS = [12, 24, 48];

/** 搜索防抖延迟（毫秒） */
const SEARCH_DEBOUNCE_MS = 500;

/** 横幅卡片启用的最小容器宽度（px） */
const BANNER_MIN_WIDTH = 640;

/** 类型筛选选项 */
type FilterType = "all" | "action" | "lua_scripts";

const FILTER_TAGS: { value: FilterType; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "action", label: "动作包" },
  { value: "lua_scripts", label: "Lua 脚本" },
];

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ExtensionMarketTab() {
  const bumpPackVersion = useAppStore((s) => s.bumpPackVersion);
  const [packs, setPacks] = useState<MarketPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketPack | null>(null);

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // 分页状态
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // 类型筛选
  const [filterType, setFilterType] = useState<FilterType>("all");

  // 容器宽度检测（响应式切换横幅/网格）
  const listRef = useRef<HTMLDivElement>(null);
  const [useBanner, setUseBanner] = useState(true);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await extensionPackMarketCommands.listMarketPacks();
      setPacks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  // 搜索防抖：输入后等待 500ms 再过滤，期间显示搜索加载状态
  useEffect(() => {
    if (searchQuery === debouncedQuery) return;
    setSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setSearching(false);
      setCurrentPage(1); // 搜索后回到第一页
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedQuery]);

  // 容器宽度监听：宽屏用横幅卡片，窄屏回退网格
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setUseBanner(width >= BANNER_MIN_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 离线模式推断：所有项 download_url 为空
  const offlineMode =
    !loading && packs.length > 0 && packs.every((p) => !p.download_url);

  /** 按类型 + 搜索词过滤扩展包 */
  const filteredPacks = useMemo(() => {
    let result = packs;
    // 类型筛选
    if (filterType !== "all") {
      result = result.filter((p) => p.pack_type === filterType);
    }
    // 搜索筛选
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          (p.author?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [packs, filterType, debouncedQuery]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredPacks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPacks = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPacks.slice(start, start + pageSize);
  }, [filteredPacks, safePage, pageSize]);

  /** 安装扩展包 */
  async function handleInstall(pack: MarketPack) {
    setOperatingId(pack.id);
    setError(null);
    try {
      await extensionPackMarketCommands.installPackFromGithub(
        pack.download_url,
        pack.file_name,
      );
      await loadMarket();
      bumpPackVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  /** 更新扩展包（重新下载安装） */
  async function handleUpdate(pack: MarketPack) {
    setOperatingId(pack.id);
    setError(null);
    try {
      await extensionPackMarketCommands.installPackFromGithub(
        pack.download_url,
        pack.file_name,
      );
      await loadMarket();
      bumpPackVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  /** 卸载扩展包 */
  async function handleUninstall(pack: MarketPack) {
    if (!confirm(`确定卸载扩展包「${pack.name}」？卸载后相关动作将不可用。`)) return;
    setOperatingId(pack.id);
    setError(null);
    try {
      await extensionPackCommands.uninstallPack(pack.id);
      await loadMarket();
      bumpPackVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOperatingId(null);
    }
  }

  /** 生成页码列表（最多显示 7 个页码，含省略号） */
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (safePage > 3) pages.push("…");
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }, [totalPages, safePage]);

  /** 骨架屏数量 */
  const skeletonCount = Math.min(pageSize, 8);

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏：搜索 + 每页显示数 + 刷新 */}
      <div className="flex flex-wrap items-center gap-2 py-2">
        {/* 搜索框（z-10 提升层级，防止聚焦 ring 被相邻元素遮盖） */}
        <div className="relative z-10 min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索扩展包名称、作者、描述..."
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* 每页显示数 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">每页</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={loadMarket} size="sm" variant="outline" className="gap-1">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          刷新
        </Button>
      </div>

      {/* 类型筛选 Tag */}
      <div className="flex items-center gap-1.5 pb-2">
        {FILTER_TAGS.map((tag) => (
          <button
            key={tag.value}
            onClick={() => {
              setFilterType(tag.value);
              setCurrentPage(1);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filterType === tag.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* 结果计数 */}
      <div className="pb-2">
        <p className="text-sm text-muted-foreground">
          共 {filteredPacks.length} 个扩展包
          {debouncedQuery && (
            <span className="ml-1">（搜索「{debouncedQuery}」的结果）</span>
          )}
          {offlineMode && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              （离线模式）
            </span>
          )}
        </p>
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
      {offlineMode && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            无法连接 GitHub，当前仅显示已安装扩展包。请检查网络后刷新。
          </span>
        </div>
      )}

      {/* 列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-fluent">
        {loading ? (
          // 骨架屏加载（零布局跳动，与最终网格/横幅结构一致）
          <div
            className={cn(
              "gap-3 pb-4",
              useBanner ? "flex flex-col" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            )}
          >
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <PackCardSkeleton key={i} banner={useBanner} />
            ))}
          </div>
        ) : searching ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            搜索中...
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Package className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">
              {debouncedQuery ? "无匹配结果" : "市场为空"}
            </p>
            <p className="mt-1 text-xs">
              {debouncedQuery
                ? "尝试更换关键词或清空搜索"
                : "仓库 action-packs/ 目录暂无扩展包，或网络不可达"}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "gap-3 pb-4",
              useBanner ? "flex flex-col" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            )}
          >
            {paginatedPacks.map((p) => (
              <PackCard
                key={p.id}
                pack={p}
                banner={useBanner}
                operating={operatingId === p.id}
                onInstall={() => handleInstall(p)}
                onUpdate={() => handleUpdate(p)}
                onUninstall={() => handleUninstall(p)}
                onShowDetail={() => setDetail(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 分页控制 */}
      {!loading && !searching && filteredPacks.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 border-t py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(safePage - 1)}
            disabled={safePage <= 1}
            title="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pageNumbers.map((pn, idx) =>
            typeof pn === "string" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-sm text-muted-foreground"
              >
                {pn}
              </span>
            ) : (
              <button
                key={pn}
                onClick={() => setCurrentPage(pn)}
                className={cn(
                  "h-8 min-w-[32px] rounded-md px-2 text-sm font-medium transition-colors",
                  pn === safePage
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {pn}
              </button>
            ),
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(safePage + 1)}
            disabled={safePage >= totalPages}
            title="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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
              {/* 类型徽章 */}
              <PackTypeBadge packType={detail.pack_type} />

              {/* 描述 */}
              {detail.description && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    描述
                  </p>
                  <p className="text-sm">{detail.description}</p>
                </div>
              )}

              {/* 元数据 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">
                    {detail.pack_type === "lua_scripts" ? "脚本数量" : "动作数量"}
                  </span>
                  <p className="mt-0.5 font-medium">
                    {detail.pack_type === "lua_scripts"
                      ? `${detail.script_count} 个`
                      : `${detail.action_count} 个`}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">文件大小</span>
                  <p className="mt-0.5 font-medium">{formatSize(detail.size)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">API 版本</span>
                  <p className="mt-0.5 font-medium">{detail.exero_api_version}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">侧边栏入口</span>
                  <p className="mt-0.5 font-medium">
                    {detail.has_sidebar ? "有" : "无"}
                  </p>
                </div>
              </div>

              {/* 文件名 */}
              {detail.file_name && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    文件名
                  </p>
                  <code className="block rounded bg-muted px-2 py-1 text-xs">
                    {detail.file_name}
                  </code>
                </div>
              )}

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

/** 类型徽章 */
function PackTypeBadge({ packType }: { packType: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-0.5 text-[10px] font-medium",
        packType === "lua_scripts"
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-primary/10 text-primary",
      )}
    >
      {packType === "lua_scripts" ? "Lua 脚本" : "动作包"}
    </span>
  );
}

/** 扩展包卡片（响应式：宽屏横幅 / 窄屏网格） */
function PackCard({
  pack,
  banner,
  operating,
  onInstall,
  onUpdate,
  onUninstall,
  onShowDetail,
}: {
  pack: MarketPack;
  banner: boolean;
  operating: boolean;
  onInstall: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
  onShowDetail: () => void;
}) {
  if (banner) {
    return (
      <PackBannerCard
        pack={pack}
        operating={operating}
        onInstall={onInstall}
        onUpdate={onUpdate}
        onUninstall={onUninstall}
        onShowDetail={onShowDetail}
      />
    );
  }
  return (
    <PackGridCard
      pack={pack}
      operating={operating}
      onInstall={onInstall}
      onUpdate={onUpdate}
      onUninstall={onUninstall}
      onShowDetail={onShowDetail}
    />
  );
}

/** 横幅卡片（宽屏 · 类 Modrinth 水平布局） */
function PackBannerCard({
  pack,
  operating,
  onInstall,
  onUpdate,
  onUninstall,
  onShowDetail,
}: {
  pack: MarketPack;
  operating: boolean;
  onInstall: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
  onShowDetail: () => void;
}) {
  return (
    <Card className="flex flex-row items-center gap-4 p-3">
      {/* 图标 */}
      <button
        onClick={onShowDetail}
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary/10"
        title="查看详情"
      >
        <Package className="h-6 w-6 text-primary" />
      </button>

      {/* 信息 */}
      <div
        className="flex min-w-0 flex-1 cursor-pointer flex-col"
        onClick={onShowDetail}
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{pack.name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            v{pack.version}
          </span>
          <PackTypeBadge packType={pack.pack_type} />
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {pack.description || "（无描述）"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>
            {pack.pack_type === "lua_scripts"
              ? `${pack.script_count} 个脚本`
              : `${pack.action_count} 个动作`}
          </span>
          <span>·</span>
          <span>{formatSize(pack.size)}</span>
          {pack.author && (
            <>
              <span>·</span>
              <span>{pack.author}</span>
            </>
          )}
          {pack.has_sidebar && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <LayoutPanelLeft className="h-3 w-3" />
                侧边栏
              </span>
            </>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {operating ? (
          <Button size="sm" variant="outline" disabled className="gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            处理中
          </Button>
        ) : pack.installed ? (
          <>
            {pack.update_available && (
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={onUpdate}
                disabled={!pack.download_url}
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
              卸载
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="gap-1"
            onClick={onInstall}
            disabled={!pack.download_url}
            title={!pack.download_url ? "离线模式，无法安装" : undefined}
          >
            <Download className="h-3.5 w-3.5" />
            安装
          </Button>
        )}
      </div>
    </Card>
  );
}

/** 网格卡片（窄屏 · 紧凑布局） */
function PackGridCard({
  pack,
  operating,
  onInstall,
  onUpdate,
  onUninstall,
  onShowDetail,
}: {
  pack: MarketPack;
  operating: boolean;
  onInstall: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
  onShowDetail: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="cursor-pointer pb-2" onClick={onShowDetail}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Package className="h-3.5 w-3.5 text-primary" />
            {pack.name}
          </CardTitle>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            v{pack.version}
          </span>
        </div>
        <CardDescription className="text-xs">
          {pack.author ? `作者：${pack.author}` : "作者：匿名"}
        </CardDescription>
      </CardHeader>

      <CardContent
        className="flex-1 cursor-pointer py-1"
        onClick={onShowDetail}
      >
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {pack.description || "（无描述）"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <PackTypeBadge packType={pack.pack_type} />
          <span>
            {pack.pack_type === "lua_scripts"
              ? `${pack.script_count} 个脚本`
              : `${pack.action_count} 个动作`}
          </span>
          <span>·</span>
          <span>{formatSize(pack.size)}</span>
          {pack.has_sidebar && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <LayoutPanelLeft className="h-3 w-3" />
                侧边栏
              </span>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-1.5 pt-2">
        {operating ? (
          <Button size="sm" variant="outline" disabled className="gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            处理中
          </Button>
        ) : pack.installed ? (
          <>
            {pack.update_available && (
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={onUpdate}
                disabled={!pack.download_url}
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
              卸载
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="gap-1"
            onClick={onInstall}
            disabled={!pack.download_url}
            title={!pack.download_url ? "离线模式，无法安装" : undefined}
          >
            <Download className="h-3.5 w-3.5" />
            安装
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** 骨架屏卡片（加载占位 · pulse 动画） */
function PackCardSkeleton({ banner }: { banner: boolean }) {
  if (banner) {
    return (
      <div className="flex items-center gap-4 rounded-lg border p-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-lg border p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
      <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-auto pt-4">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
