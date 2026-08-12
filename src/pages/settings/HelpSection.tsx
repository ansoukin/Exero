/**
 * 帮助分区（Phase 6b · SPEC 3.5 页面 5 分区 5）
 *
 * Beta6 重做：删除 Alpha 阶段占位自嘲文案，改为正经的资源入口页：
 * - 开发文档入口（动作包 / 插件开发指南）
 * - 问题反馈入口（GitHub Issues）
 */

import {
  HelpCircle,
  BookOpen,
  Bug,
  ExternalLink,
} from "lucide-react";

/** 开发文档入口（GitHub Pages 在线版） */
const DEV_DOCS_URL = "https://ansoukin.github.io/Exero/docs/";

/** GitHub Issues 反馈入口 */
const ISSUES_URL = "https://github.com/ansoukin/Exero/issues";

interface HelpCardData {
  icon: typeof BookOpen;
  title: string;
  description: string;
  href: string;
}

/** 资源入口卡片数据 */
const CARDS: HelpCardData[] = [
  {
    icon: BookOpen,
    title: "开发文档",
    description: "动作包开发指南、插件开发指南",
    href: DEV_DOCS_URL,
  },
  {
    icon: Bug,
    title: "问题反馈",
    description: "在 GitHub Issues 提交 BUG 或功能建议",
    href: ISSUES_URL,
  },
];

export function HelpSection() {
  return (
    <div className="flex flex-col gap-8">
      {/* 头部说明 */}
      <section className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">帮助</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            查阅开发文档、提交问题反馈
          </p>
        </div>
      </section>

      {/* 资源入口卡片 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <a
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 rounded-md border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">{card.title}</h3>
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </a>
          );
        })}
      </section>
    </div>
  );
}
