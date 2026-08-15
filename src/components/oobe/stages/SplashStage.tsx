/**
 * OOBE 阶段：开屏动画（Beta9 · 任务3 老用户跳过打字机）
 *
 * 动画时间线（framer-motion）：
 * 0ms       logo 切出（opacity+scale+clipPath，600ms）
 * 500ms     "EXERO" 字母依次展开（stagger，每字 120ms 延迟）
 * 1100ms    副标题打字机效果启动（中文 → 换行 → 英文翻译）— 老用户跳过
 * 6500ms    "开始"按钮弹出（仅 oobe 模式，等用户点击）
 *
 * 三种模式：
 * - oobe 模式（新用户）：6.5s 后按钮弹出，点击进入下一阶段
 * - autoDismiss 模式（老用户启动闪屏，完整版）：打字机播完后延时自动消失
 * - skipTyping 模式（老用户启动闪屏，精简版）：跳过打字机，logo+字母入场后快速消失
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";

/** 副标题打字机内容：中文 + 换行 + 英文翻译 */
const SUBTITLE_LINES = [
  "Windows 桌面自动化管理工具",
  "Windows Desktop Automation Tool",
];

/** framer-motion 缓动曲线（对齐 CSS --ease-fluent） */
const EASE_FLUENT = [0.16, 1, 0.3, 1] as const;

interface SplashStageProps {
  /** 自动消失模式（老用户启动闪屏）：打字机播完后自动回调 onDismiss，不显示按钮 */
  autoDismiss?: boolean;
  /** 跳过打字机文本（老用户精简模式）：logo+字母入场后快速回调 onDismiss */
  skipTyping?: boolean;
  /** 自动消失完成回调 */
  onDismiss?: () => void;
}

export function SplashStage({ autoDismiss = false, skipTyping = false, onDismiss }: SplashStageProps) {
  const next = useOobeStore((s) => s.next);
  const [showButton, setShowButton] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);

  // oobe 模式：6.5s 后显示"开始"按钮
  useEffect(() => {
    if (autoDismiss) return;
    const timer = setTimeout(() => setShowButton(true), 6500);
    return () => clearTimeout(timer);
  }, [autoDismiss]);

  // 打字机效果（skipTyping 模式跳过）
  useEffect(() => {
    if (skipTyping) {
      setTypingDone(true);
      return;
    }

    const startDelay = 1100;
    const charInterval = 80; // 每字 80ms
    const lineBreakDelay = 400; // 换行停顿 400ms

    let fullText = "";
    let charIndex = 0;
    let lineIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      if (lineIndex >= SUBTITLE_LINES.length) {
        setTypingDone(true);
        return;
      }

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
        } else {
          setTypingDone(true);
        }
      }
    };

    timer = setTimeout(typeNext, startDelay);
    return () => clearTimeout(timer);
  }, [skipTyping]);

  // 老用户自动消失：打字机完成后（或 skipTyping 模式下 logo 入场后）延时回调
  useEffect(() => {
    if (!autoDismiss || !typingDone || !onDismiss) return;
    // skipTyping 模式：logo+字母入场约 1.5s，延时 0.8s 后消失（总约 2.3s）
    // 完整模式：打字机播完后延时 1.5s 消失
    const delay = skipTyping ? 800 : 1500;
    const timer = setTimeout(onDismiss, delay);
    return () => clearTimeout(timer);
  }, [autoDismiss, typingDone, onDismiss, skipTyping]);

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

      {/* logo 切出 + EXERO 字母依次展开 */}
      <div className="relative flex items-center gap-6">
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-4xl font-bold text-primary-foreground shadow-lg shadow-primary/30"
          initial={{ opacity: 0, scale: 0.8, clipPath: "inset(50% 50% 50% 50%)" }}
          animate={{ opacity: 1, scale: 1, clipPath: "inset(0% 0% 0% 0%)" }}
          transition={{ duration: 0.6, ease: EASE_FLUENT }}
        >
          E
        </motion.div>
        <div className="flex overflow-hidden">
          {"EXERO".split("").map((ch, i) => (
            <motion.span
              key={i}
              className="text-5xl font-bold tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.12, ease: EASE_FLUENT }}
            >
              {ch}
            </motion.span>
          ))}
        </div>
      </div>

      {/* 副标题打字机效果（skipTyping 模式不渲染） */}
      {!skipTyping && (
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
      )}

      {/* 开始按钮（仅 oobe 模式，6.5s 后弹出） */}
      {!autoDismiss && showButton && (
        <motion.button
          onClick={next}
          className="group flex items-center gap-3 rounded-full bg-primary px-10 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_FLUENT }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          开始使用
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </motion.button>
      )}
    </div>
  );
}
