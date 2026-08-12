/**
 * OOBE 阶段：字体安装提示（重启前）
 *
 * 检测 Segoe Fluent Icons（Win11 图标字体）是否已安装：
 * - 已安装：直接下一步
 * - 未安装：提供微软官方下载链接 + "已安装，重启应用"按钮
 *
 * 字体检测：canvas measureText 对比法（渲染测试字符，比较字体宽度差异）
 */

import { useState } from "react";
import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";
import { OobeShell } from "../OobeWizard";
import { Button } from "@/components/ui/button";
import { systemCommands } from "@/lib/tauri";

/** 检测字体是否可用（canvas measureText 对比法） */
function isFontAvailable(fontFamily: string): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const text = "mmmmmmmmmmlli";
    // 基线宽度（monospace）
    ctx.font = "72px monospace";
    const baseline = ctx.measureText(text).width;
    // 目标字体宽度
    ctx.font = `72px "${fontFamily}", monospace`;
    return ctx.measureText(text).width !== baseline;
  } catch {
    return false;
  }
}

/** Segoe Fluent Icons 官方获取指引（微软文档） */
const FONT_DOC_URL =
  "https://learn.microsoft.com/windows/apps/design/style/segoe-fluent-icons-font";

export function FontStage() {
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);
  const [fontAvailable] = useState(() => isFontAvailable("Segoe Fluent Icons"));

  // 重启前先推进 stage 到 post_restart 并等待持久化完成，避免重启后回退到 font
  const handleRestart = async () => {
    await goTo("post_restart");
    systemCommands.restartApp();
  };

  return (
    <OobeShell
      stage="font"
      title="图标字体安装"
      subtitle="Segoe Fluent Icons 为 Windows 11 图标字体，确保界面图标正常显示"
      canNext
      onNext={next}
      onBack={() => goTo("scenario")}
    >
      {fontAvailable ? (
        <div className="flex items-start gap-4 rounded-2xl border border-green-500/30 bg-green-500/[0.06] p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              已检测到 Segoe Fluent Icons 字体
            </p>
            <p className="mt-1 text-muted-foreground">
              图标显示正常，点击下一步继续
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                未检测到 Segoe Fluent Icons 字体
              </p>
              <p className="mt-1 text-muted-foreground">
                该字体为 Windows 11 自带图标字体，缺失会导致部分图标显示为方框。
                请从 Windows 11 系统获取或参考微软文档安装。
              </p>
            </div>
          </div>

          <a
            href={FONT_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            查看微软官方字体文档
          </a>

          <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-5">
            <div className="flex-1 text-sm">
              <p className="font-medium">已手动安装字体？</p>
              <p className="mt-1 text-muted-foreground">
                安装完成后需重启应用使字体生效
              </p>
            </div>
            <Button onClick={handleRestart} size="sm" className="rounded-lg">
              重启应用
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            如已安装但未检测到，可直接下一步（重启后会重新检测）
          </p>
        </div>
      )}
    </OobeShell>
  );
}
