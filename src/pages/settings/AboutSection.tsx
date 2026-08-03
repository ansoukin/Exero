/**
 * 关于分区（Phase 6b · SPEC 3.5 页面 5 分区 4）
 *
 * 包含：
 * - 基本信息（Logo 占位 + 名称 + 版本号 + 构建日期）
 * - 技术栈列表
 * - MIT 许可 + 娱乐性 24 小时删除声明
 * - GitHub 仓库链接
 * - 更新历史（GitHub Release Notes 优先，失败回退本地 CHANGELOG.md）
 */

import { useEffect, useState } from "react";
import { ExternalLink, Github, ScrollText, Loader2 } from "lucide-react";

import {
  updateCommands,
  type AppInfo,
  type ChangelogEntry,
} from "@/lib/tauri";

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      updateCommands.getAppInfo(),
      updateCommands.getChangelog(),
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
            <span>版本 {info.version}</span>
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
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-medium">技术栈</h3>
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
      </section>

      {/* MIT 许可 + 娱乐性声明 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-medium">License</h3>
        <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
          <p>
            本软件基于 <span className="font-medium">MIT License</span> 开源。
          </p>
          <p className="mt-2 text-muted-foreground">
            娱乐性声明（无法律效力，纯属娱乐）：本软件仅供学习研究使用，请在下载后
            24 小时内删除。请支持正版软件，尊重知识产权。
          </p>
        </div>
      </section>

      {/* 更新历史 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          <h3 className="text-base font-medium">更新历史</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          数据源：GitHub Release Notes 优先，网络失败时回退本地 CHANGELOG.md
        </p>

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
                        v{entry.version}
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
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground">
                        {entry.body || "（无 Release Notes）"}
                      </pre>
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
