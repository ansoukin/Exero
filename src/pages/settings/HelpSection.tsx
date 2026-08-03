/**
 * 帮助分区（Phase 6b · SPEC 3.5 页面 5 分区 5 / SPEC 13.2 待定项）
 *
 * V0.4.0 占位嘲讽 / 自嘲文案，后续补充：
 * - 功能说明
 * - FAQ
 * - 错误代码
 * - 概念词典
 */

import {
  HelpCircle,
  BookOpen,
  MessageCircleQuestion,
  AlertTriangle,
  BookMarked,
  Construction,
} from "lucide-react";

/** 帮助分区卡片 */
interface HelpCardData {
  icon: typeof BookOpen;
  title: string;
  description: string;
  status: "placeholder" | "available";
  content: string;
}

/** 占位卡片数据 */
const CARDS: HelpCardData[] = [
  {
    icon: BookOpen,
    title: "功能说明",
    description: "Exero 各功能模块的详细使用说明",
    status: "placeholder",
    content:
      "还在想怎么写。如果你能用得起来这个软件，那说明你比软件本身还聪明——毕竟连作者都不知道有些功能是干嘛用的。",
  },
  {
    icon: MessageCircleQuestion,
    title: "常见问题 FAQ",
    description: "用户高频问题与解答",
    status: "placeholder",
    content:
      "Q: 为什么软件这么卡？\nA: 因为开发机比学校机性能好，没复现出来。\n\nQ: 为什么有 BUG？\nA: 因为是 Alpha 版本，BUG 是免费的额外功能。",
  },
  {
    icon: AlertTriangle,
    title: "错误代码",
    description: "执行日志中可能出现的错误代码说明",
    status: "placeholder",
    content:
      "目前还没有标准化的错误代码。如果你看到了错误，那就当是开发者给你发的彩蛋吧——后版本会补齐。",
  },
  {
    icon: BookMarked,
    title: "概念词典",
    description: "Exero 特有概念与术语解释",
    status: "placeholder",
    content:
      "快捷指令、动作链、触发器、调课、周模板……这些词是什么意思？\n说实话，作者写代码的时候也没完全想清楚，等想清楚了再补。",
  },
];

export function HelpSection() {
  return (
    <div className="flex flex-col gap-6">
      {/* 头部说明 */}
      <section className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">帮助</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exero V0.4.0 Alpha 阶段帮助内容占位，后续版本将补充完整文档
          </p>
        </div>
      </section>

      {/* 自嘲占位横幅 */}
      <section className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            此页面正在施工中
          </p>
          <p className="mt-1 text-muted-foreground">
            作者原本计划在 V0.4.0 写一份详尽的帮助文档，但是写代码已经写麻了，
            于是决定先放点占位文案凑数。如果你在 Alpha 阶段就用上了这个软件，
            说明你应该是开发者本人——那也就不需要帮助文档了对吧？
          </p>
        </div>
      </section>

      {/* 占位卡片网格 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex flex-col gap-3 rounded-md border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">{card.title}</h3>
                {card.status === "placeholder" && (
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    待补充
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
                {card.content}
              </pre>
            </div>
          );
        })}
      </section>

      {/* 联系方式 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-medium">问题反馈</h3>
        <p className="text-sm text-muted-foreground">
          发现 BUG 或有功能建议？欢迎在 GitHub Issues 提交反馈。
        </p>
        <a
          href="https://github.com/ansoukin/Exero/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          github.com/ansoukin/Exero/issues
        </a>
      </section>
    </div>
  );
}
