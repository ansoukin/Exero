/**
 * framer-motion 常用变体（Beta9 · 任务9）
 *
 * 替代 index.css 中手写的 @keyframes 动画。
 * 缓动曲线对齐 CSS --ease-fluent（cubic-bezier(0.16, 1, 0.3, 1)）。
 */

import type { Variants, Transition } from "framer-motion";

/** Win11 Fluent 缓动曲线（对齐 CSS --ease-fluent） */
export const EASE_FLUENT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** 200ms 标准过渡（SPEC 3.1：兼容 30Hz） */
export const DURATION_STANDARD = 0.2;

/** 标准过渡配置 */
export const transitionStandard: Transition = {
  duration: DURATION_STANDARD,
  ease: EASE_FLUENT,
};

/** 淡入变体（替代 .animate-fade-in） */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionStandard },
};

/** 页面切换变体（替代 .animate-page-fade-in：opacity + translateY 2px） */
export const pageFadeVariants: Variants = {
  hidden: { opacity: 0, y: 2 },
  visible: { opacity: 1, y: 0, transition: transitionStandard },
};

/** 滑入变体（替代 .animate-slide-up：opacity + translateY 8px） */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_FLUENT } },
};

/** 缩放入场变体（替代 .animate-scale-in：opacity + scale 0.96） */
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitionStandard },
};
