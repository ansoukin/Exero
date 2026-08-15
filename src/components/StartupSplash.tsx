/**
 * 老用户启动闪屏容器（Beta9 · 任务3 老用户跳过打字机）
 *
 * 老用户（onboarding_completed=true）启动时显示 SplashStage 精简版闪屏：
 * - 保留 logo 切出 + EXERO 字母展开（品牌展示，约 1.5s）
 * - 跳过打字机文本（对老用户体验不佳）
 * - logo+字母入场后 0.8s 自动淡出进入主界面（总约 2.3s）
 *
 * 新用户由 OOBE 的 SplashStage 接管（完整打字机 + 开始按钮），本组件让位隐藏。
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useOobeStore } from "@/stores/oobe";
import { SplashStage } from "@/components/oobe/stages/SplashStage";

export function StartupSplash() {
  const oobeActive = useOobeStore((s) => s.isActive);
  const [dismissed, setDismissed] = useState(false);

  // 新用户 OOBE 激活 或 老用户播完后 dismissed → 不渲染
  const show = !oobeActive && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="startup-splash"
          className="fixed inset-0 z-[90] flex flex-col bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* 顶部拖拽区域（保持窗口可拖拽，复刻 OOBE 顶部条高度） */}
          <div data-tauri-drag-region className="h-12 shrink-0" />
          {/* 老用户精简模式：跳过打字机，只保留 logo+字母入场 */}
          <SplashStage autoDismiss skipTyping onDismiss={() => setDismissed(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
