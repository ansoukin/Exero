/**
 * OOBE 阶段：开屏动画（重启前）
 *
 * 动画时间线：
 * 0ms       logo 切出（oobe-logo-clip 600ms）
 * 500ms     "EXERO" 字母依次展开（oobe-letter 400ms）
 * 1100ms    副标题打字机效果启动（中文 → 换行 → 英文翻译）
 * 6500ms    "开始"按钮淡入弹出（oobe-start-enter 500ms）
 *
 * 动画说明：
 * - 入场动画（logo 切出 + 字母展开）一次性播放后停止
 * - 副标题用打字机效果逐字显示，无光标
 * - 按钮等待 6.5s 才弹出，弹出后入场动画保持静止
 */

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";

/** 副标题打字机内容：中文 + 换行 + 英文翻译 */
const SUBTITLE_LINES = [
  "Windows 桌面自动化管理工具",
  "Windows Desktop Automation Tool",
];

export function SplashStage() {
  const next = useOobeStore((s) => s.next);
  const [showButton, setShowButton] = useState(false);
  const [typedText, setTypedText] = useState("");

  // 6.5s 后显示"开始"按钮
  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 6500);
    return () => clearTimeout(timer);
  }, []);

  // 1.1s 后启动打字机效果（logo + 字母入场完成后）
  useEffect(() => {
    const startDelay = 1100;
    const charInterval = 80; // 每字 80ms
    const lineBreakDelay = 400; // 换行停顿 400ms

    let fullText = "";
    let charIndex = 0;
    let lineIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      if (lineIndex >= SUBTITLE_LINES.length) return;

      const currentLine = SUBTITLE_LINES[lineIndex];
      if (charIndex < currentLine.length) {
        fullText += currentLine[charIndex];
        setTypedText(fullText);
        charIndex++;
        timer = setTimeout(typeNext, charInterval);
      } else {
        // 当前行打完，换行（最后一行不换行）
        if (lineIndex < SUBTITLE_LINES.length - 1) {
          fullText += "\n";
          setTypedText(fullText);
          lineIndex++;
          charIndex = 0;
          timer = setTimeout(typeNext, lineBreakDelay);
        }
      }
    };

    timer = setTimeout(typeNext, startDelay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10">
      {/* 顶部光效装饰（径向渐变） */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 45%, hsl(var(--primary) / 0.08), transparent 70%)",
        }}
      />

      {/* logo + EXERO 字母依次展开（循环播放，每 3s 一个周期） */}
      <div className="relative flex items-center gap-6">
        <div className="oobe-logo-clip flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-4xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
          E
        </div>
        <div className="flex overflow-hidden">
          {"EXERO".split("").map((ch, i) => (
            <span
              key={i}
              className="oobe-letter text-5xl font-bold tracking-tight"
              style={{ animationDelay: `${(i * 120) % 3000}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>

      {/* 副标题打字机效果（中文 + 换行 + 英文翻译，无光标） */}
      <div className="flex min-h-[3.5rem] flex-col items-center justify-center">
        {typedText.split("\n").map((line, i) => (
          <p
            key={i}
            className={
              i === 0
                ? "text-sm text-muted-foreground"
                : "mt-1 text-xs text-muted-foreground/60"
            }
          >
            {line}
          </p>
        ))}
      </div>

      {/* 开始按钮（6.5s 后弹出） */}
      {showButton && (
        <button
          onClick={next}
          className="oobe-start-enter group flex items-center gap-3 rounded-full bg-primary px-10 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/50 active:scale-95"
        >
          开始使用
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );
}
