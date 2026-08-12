/**
 * 关于分区（Phase 6b · SPEC 3.5 页面 5 分区 4）
 *
 * 包含：
 * - 基本信息（Logo 占位 + 名称 + 版本号 + 构建日期）
 * - 技术栈列表
 * - MIT 许可
 * - GitHub 仓库链接
 * - 更新历史（GitHub Release Notes 优先，失败回退本地 CHANGELOG.md）
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ExternalLink,
  Github,
  ScrollText,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import {
  updateCommands,
  type AppInfo,
  type ChangelogEntry,
} from "@/lib/tauri";

/** changelog 内存缓存（10 分钟 TTL，避免切分区时重复打 GitHub API） */
const CHANGELOG_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
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

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      updateCommands.getAppInfo(),
      fetchChangelogWithCache(),
    ])
      .then(([appInfo, entries]) => {
        setInfo(appInfo);
        setChangelog(entries);
      })
      .catch((e) => {
        console.error("[about] 加载应用信息或更新历史失败:", e);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !info) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 基本信息 */}
      <section className="flex items-center gap-4">
        {/* Logo 占位（SPEC 13.2：V0.4.0 占位"E"字母） */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-3xl font-bold text-primary-foreground">
          E
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{info.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>版本 V{info.version}</span>
            <span>·</span>
            <span>构建 {info.build_date}</span>
            <span>·</span>
            <span>License {info.license}</span>
          </div>
        </div>
      </section>

      {/* GitHub 仓库 */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">GitHub 仓库</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            源代码、问题反馈、Release 下载
          </p>
        </div>
        <a
          href={info.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Github className="h-4 w-4" />
          {info.repo_url.replace("https://", "")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      {/* 技术栈 */}
      <CollapsibleSection title="技术栈" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {info.tech_stack.map((item) => (
            <div
              key={`${item.category}-${item.name}`}
              className="rounded-md border bg-muted/30 px-3 py-2"
            >
              <div className="text-xs text-muted-foreground">{item.category}</div>
              <div className="text-sm font-medium">
                {item.name}
                {item.version && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {item.version}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* MIT 许可 */}
      <CollapsibleSection title="License" defaultOpen={false}>
        <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
          <p>
            本软件基于 <span className="font-medium">MIT License</span> 开源。
          </p>
        </div>
      </CollapsibleSection>

      {/* 更新历史 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          <h3 className="text-base font-medium">更新历史</h3>
        </div>

        {changelog.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            暂无更新历史
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {changelog.map((entry) => {
              const expanded = expandedVersion === entry.version;
              return (
                <div
                  key={entry.version}
                  className="rounded-md border bg-card"
                >
                  <button
                    onClick={() =>
                      setExpandedVersion(expanded ? null : entry.version)
                    }
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
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
                          components={{
                            h1: ({ node, ...props }) => (
                              <h1 className="mb-2 mt-3 text-base font-semibold text-foreground" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="mb-2 mt-3 text-base font-semibold text-foreground" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="mb-1.5 mt-2 text-sm font-semibold text-foreground" {...props} />
                            ),
                            h4: ({ node, ...props }) => (
                              <h4 className="mb-1 mt-2 text-sm font-medium text-foreground" {...props} />
                            ),
                            h5: ({ node, ...props }) => (
                              <h5 className="mb-1 mt-2 text-xs font-medium text-foreground" {...props} />
                            ),
                            h6: ({ node, ...props }) => (
                              <h6 className="mb-1 mt-2 text-xs font-medium text-muted-foreground" {...props} />
                            ),
                            p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="mb-2 ml-5 list-disc space-y-0.5" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol className="mb-2 ml-5 list-decimal space-y-0.5" {...props} />
                            ),
                            li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                            blockquote: ({ node, ...props }) => (
                              <blockquote
                                className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground"
                                {...props}
                              />
                            ),
                            hr: ({ node, ...props }) => (
                              <hr className="my-3 border-border" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                              <strong className="font-semibold text-foreground" {...props} />
                            ),
                            em: ({ node, ...props }) => <em className="italic" {...props} />,
                            del: ({ node, ...props }) => <del className="line-through" {...props} />,
                            code: ({ node, className, children, ...props }) => {
                              const isInline = !className?.includes("language-");
                              return isInline ? (
                                <code
                                  className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
                                  {...props}
                                >
                                  {children}
                                </code>
                              ) : (
                                <code className="font-mono text-[0.85em]" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ node, ...props }) => (
                              <pre
                                className="my-2 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs"
                                {...props}
                              />
                            ),
                            table: ({ node, ...props }) => (
                              <div className="my-2 overflow-x-auto">
                                <table
                                  className="w-full border-collapse text-xs"
                                  {...props}
                                />
                              </div>
                            ),
                            thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                            th: ({ node, ...props }) => (
                              <th
                                className="border border-border px-2 py-1 text-left font-medium"
                                {...props}
                              />
                            ),
                            td: ({ node, ...props }) => (
                              <td className="border border-border px-2 py-1" {...props} />
                            ),
                            img: ({ node, alt, ...props }) => (
                              <img
                                alt={alt ?? ""}
                                className="my-2 max-w-full rounded-md"
                                {...props}
                              />
                            ),
                          }}
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
          </div>
        )}
      </section>
    </div>
  );
}

/** 可折叠分区：点击标题切换展开/收起，默认收起 */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="text-base font-medium">{title}</h3>
      </button>
      {open && children}
    </section>
  );
}
