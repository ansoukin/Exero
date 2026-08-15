/**
 * 关于分区（Beta9 · 任务4 + 任务8 重做）
 *
 * 结构：
 * 1. Hero 卡片：纯主题蓝渐变背景 + 正式 Logo（明暗两版自动切换）+ 应用名 + 版本号，border-beam 光效包裹
 * 2. 作者信息行：Ansoukin 仓鼠君 + GitHub 入口（图标 24×24，whileHover scale 1.1）
 * 3. GitHub 仓库链接（保留）
 * 4. 鸣谢（Beta9 任务8：致谢词 + 技术栈作为鸣谢的一部分）
 * 5. License（保留）
 * 6. 更新历史入口（点击跳转二级页面 ChangelogPage 查看）
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ExternalLink,
  Github,
  Heart,
  Loader2,
  ChevronDown,
  ChevronRight,
  ScrollText,
} from "lucide-react";

import { useAppStore } from "@/stores/app";
import {
  updateCommands,
  type AppInfo,
} from "@/lib/tauri";

/** 作者 GitHub 主页 */
const AUTHOR_GITHUB_URL = "https://github.com/ansoukin";

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    updateCommands
      .getAppInfo()
      .then((appInfo) => setInfo(appInfo))
      .catch((e) => {
        console.error("[about] 加载应用信息失败:", e);
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
      {/* Hero 卡片（Beta9 任务4 重做：Win11 设置关于页风格）
       * 纯主题蓝渐变背景（明暗适配）+ 正式 logo + 应用名 + 版本号
       * 无 border-beam、无装饰光晕，简洁克制 */}
      <div className="liquid-glass flex flex-col items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/15 via-primary/8 to-primary/12 p-8 dark:from-primary/12 dark:via-primary/5 dark:to-primary/8">
        {/* Logo（正式版，明暗两套，跟随 .dark 自动切换） */}
        <div className="flex h-20 w-20 items-center justify-center">
          {/* 浅色 logo（深色模式下隐藏） */}
          <img
            src="/favicon-light.ico"
            alt="Exero Logo"
            className="h-20 w-20 rounded-2xl object-contain drop-shadow-[0_2px_8px_hsl(var(--primary)/0.2)] block dark:hidden"
            draggable={false}
          />
          {/* 深色 logo（浅色模式下隐藏） */}
          <img
            src="/favicon-dark.ico"
            alt="Exero Logo"
            className="h-20 w-20 rounded-2xl object-contain drop-shadow-[0_2px_8px_hsl(var(--primary)/0.2)] hidden dark:block"
            draggable={false}
          />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{info.name}</h2>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>版本 V{info.version}</span>
          <span>·</span>
          <span>构建 {info.build_date}</span>
          <span>·</span>
          <span>License {info.license}</span>
        </div>
      </div>

      {/* 作者信息行（Beta9 任务5：AnsouKin 仓鼠君 + GitHub 入口） */}
      <section className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">作者：</span>
        <motion.a
          href={AUTHOR_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Github className="h-6 w-6" />
          AnsouKin 仓鼠君
        </motion.a>
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

      {/* 鸣谢（Beta9 任务8：致谢词 + 技术栈作为鸣谢的一部分） */}
      <CollapsibleSection title="鸣谢" defaultOpen={false}>
        <div className="flex flex-col gap-4">
          {/* 致谢词 */}
          <div className="flex items-start gap-2.5 rounded-md border bg-primary/5 p-3">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Exero 的诞生与成长，离不开以下开源项目的支撑，也感谢所有提出建议、反馈问题与贡献代码的用户。
              没有开源社区，就没有 Exero。
            </p>
          </div>
          {/* 技术栈 */}
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

      {/* 更新历史入口（Beta9 任务8：点击跳转二级页面） */}
      <motion.button
        type="button"
        onClick={() => setPage("changelog")}
        className="group flex w-full items-center justify-between gap-4 rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-medium">更新历史</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              查看各版本 Release Notes
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </motion.button>
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
