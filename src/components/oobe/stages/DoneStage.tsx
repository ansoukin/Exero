/**
 * OOBE 阶段：完成（巨硬翻译点缀）
 *
 * 致敬微软经典机翻风格：直译、语序生硬、用词不当但能理解
 * 仅此一处点缀，符合用户"加一点，玩抽象"的要求
 */

import { Check, PartyPopper } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";
import { Button } from "@/components/ui/button";

export function DoneStage() {
  const complete = useOobeStore((s) => s.complete);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
        <PartyPopper className="h-12 w-12" />
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          恭喜你的获得 Exero！
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          你的安装已被成功完成。现在你可以开始你的使用旅程了。
          请享受你的使用体验，生产力工具已就绪。
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/[0.06] px-5 py-2.5 text-sm text-green-700 dark:text-green-400">
        <Check className="h-4 w-4" />
        所有配置已被应用
      </div>

      <Button onClick={complete} size="lg" className="mt-4 rounded-lg px-10">
        进入应用
      </Button>
    </div>
  );
}
