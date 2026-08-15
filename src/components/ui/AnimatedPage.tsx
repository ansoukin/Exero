/**
 * AnimatedPage 页面切换动画（Beta9 · 任务9）
 *
 * 替代 CSS .animate-page-fade-in 类。
 * 用 framer-motion motion.div + pageFadeVariants 实现 200ms opacity+translateY 过渡。
 *
 * 用法：<AnimatedPage key={pageKey}>...</AnimatedPage>
 * key 变化时自动重新挂载触发入场动画。
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { pageFadeVariants } from "@/components/ui/motion";

interface AnimatedPageProps {
  children: ReactNode;
  /** key 变化时触发重新动画 */
  pageKey?: string;
  className?: string;
}

export function AnimatedPage({ children, pageKey, className }: AnimatedPageProps) {
  return (
    <motion.div
      key={pageKey}
      className={className}
      variants={pageFadeVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
