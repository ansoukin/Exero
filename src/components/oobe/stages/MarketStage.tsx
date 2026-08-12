/**
 * OOBE 阶段：扩展市场介绍（致敬 Windows "获取更多应用"）
 *
 * 参考官网 https://ansoukin.github.io/Exero/ 的"核心特性"卡片设计风格，
 * 用三大特性卡片 + 数量徽章的形式介绍 Exero 的扩展能力。
 *
 * 设计要点：
 * - 顶部大卡：扩展市场总入口（图标 + 标题 + 描述）
 * - 中部三卡：动作包 / 插件 / Lua 脚本 三类扩展
 * - 底部 CTA：前往扩展市场按钮
 *
 * 注释面向新手：每个概念都用通俗语言解释，避免技术黑话
 */

import { Store, Package, Puzzle, ArrowRight, Code2 } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";
import { useAppStore } from "@/stores/app";
import { OobeShell } from "../OobeWizard";
import { Button } from "@/components/ui/button";

/** 三类扩展的特性卡片配置 */
const FEATURE_CARDS = [
  {
    icon: Package,
    title: "动作包",
    desc: "把常用动作打包好，一键安装就能用，不用自己从头编排",
    badge: "即装即用",
  },
  {
    icon: Puzzle,
    title: "插件",
    desc: "独立功能页面，给 Exero 加新能力，像给手机装 App 一样简单",
    badge: "扩展功能",
  },
  {
    icon: Code2,
    title: "Lua 脚本",
    desc: "用脚本实现更灵活的逻辑，社区分享的脚本可直接安装使用",
    badge: "脚本市场",
  },
] as const;

export function MarketStage() {
  const complete = useOobeStore((s) => s.complete);
  const goTo = useOobeStore((s) => s.goTo);
  const setPage = useAppStore((s) => s.setPage);

  /** 点击"前往扩展市场"：先完成 OOBE，再跳转到扩展页 */
  const handleGoToMarket = async () => {
    await complete();
    setPage("extensions");
  };

  return (
    <OobeShell
      stage="market"
      title="扩展你的 Exero"
      subtitle="通过扩展市场获取更多功能，让自动化能力更上一层楼"
      canNext
      nextLabel="进入应用"
      onNext={complete}
      onBack={() => goTo("tour")}
    >
      {/* 顶部大卡：扩展市场总入口（参考官网 Hero 区设计） */}
      <div className="flex items-start gap-5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Store className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <p className="text-lg font-medium">扩展市场</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            浏览社区贡献的动作包、插件和 Lua 脚本，一键安装扩展 Exero 的能力。
            所有扩展都经过严格沙箱隔离，安全可靠。
          </p>
        </div>
      </div>

      {/* 三大特性卡片（参考官网"核心特性"卡片风格） */}
      <div className="grid grid-cols-3 gap-4">
        {FEATURE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors duration-300 hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {card.badge}
                </span>
              </div>
              <p className="text-sm font-medium">{card.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {card.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* 底部 CTA：前往扩展市场 */}
      <Button
        onClick={handleGoToMarket}
        variant="outline"
        className="w-full gap-2 rounded-lg py-5"
      >
        前往扩展市场
        <ArrowRight className="h-4 w-4" />
      </Button>
    </OobeShell>
  );
}
