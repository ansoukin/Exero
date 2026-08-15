/**
 * 更新历史二级页面（Beta9 · 任务8）
 *
 * 从关于页跳转过来，展示完整 Release Notes 列表。
 * 顶部"返回关于"按钮回到设置-关于分区。
 *
 * 缓存策略：10 分钟 TTL 内存缓存（模块级），避免在关于页和本页之间切换时重复打 GitHub API。
 * 默认展开第一项（最新版本）便于直接查看。
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  ScrollText,
} from "lucide-react";

import { updateCommands, type ChangelogEntry } from "@/lib/tauri";
import { useAppStore } from "@/stores/app";
import { markdownComponents } from "@/lib/markdown";
import { slideUpVariants, EASE_FLUENT } from "@/components/ui/motion";

/** changelog 内存缓存（10 分钟 TTL） */
const CHANGELOG_CACHE_TTL = 10 * 60 * 1000;
let changelogCache: { data: ChangelogEntry[]; timestamp: number } | null = null;

/** 获取 changelog（带缓存） */
async function fetchChangelogWithCache(): Promise<ChangelogEntry[]> {
  const now = Date.now();
  if (changelogCache && now - changelogCache.timestamp < CHANGELOG_CACHE_TTL) {
    return changelogCache.data;
  }
  const data = await updateCommands.getChangelog();
  changelogCache = { data, timestamp: now };
  return data;
}

export default function ChangelogPage() {
  const setPage = useAppStore((s) => s.setPage);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 默认展开第一项（最新版本），点击切换
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchChangelogWithCache()
      .then((entries) => {
        setChangelog(entries);
        // 默认展开最新版本
        if (entries.length > 0) {
          setExpandedVersion(entries[0].version);
        }
      })
      .catch((e) => {
        console.error("[changelog] 加载失败:", e);
        setError("加载更新历史失败，请检查网络后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 density-aware">
      {/* 顶部：返回按钮 + 标题 */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => setPage("settings")}
          className="interactive flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.15, ease: EASE_FLUENT }}
        >
          <ArrowLeft className="h-4 w-4" />
          返回关于
        </motion.button>
        <div className="ml-2 flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">更新历史</h1>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : changelog.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          暂无更新历史
        </div>
      ) : (
        <motion.div
          className="flex flex-col gap-2"
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
        >
          {changelog.map((entry) => {
            const expanded = expandedVersion === entry.version;
            return (
              <div
                key={entry.version}
                className="rounded-md border bg-card transition-colors hover:border-primary/30"
              >
                <button
                  onClick={() =>
                    setExpandedVersion(expanded ? null : entry.version)
                  }
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold text-foreground">
                      V{entry.version}
                    </span>
                    {entry.published_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.published_at).toLocaleDateString("zh-CN")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {expanded ? "收起" : "展开"}
                  </span>
                </button>
                {expanded && (
                  <div className="border-t px-4 py-3">
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {entry.body || "（无 Release Notes）"}
                      </ReactMarkdown>
                    </div>
                    {entry.html_url && (
                      <a
                        href={entry.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        在 GitHub 查看
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
