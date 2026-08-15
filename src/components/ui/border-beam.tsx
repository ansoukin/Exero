/**
 * border-beam 边框光效组件（Beta9 · 任务10）
 *
 * 可复用的边框光效，用于关于页 Hero 卡片高亮。
 * framer-motion 实现：顶部光带从左到右流动，周期 3s。
 *
 * 参考：NexBox src/components/ui/border-beam.tsx
 */

import { motion } from "framer-motion";

interface BorderBeamProps {
  /** 光带颜色，默认 hsl(var(--primary)) */
  color?: string;
  /** 动画周期（秒），默认 3 */
  duration?: number;
  /** 容器尺寸（影响光带尺寸），默认 100% */
  size?: string;
}

export function BorderBeam({
  color = "hsl(var(--primary))",
  duration = 3,
  size = "100%",
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      style={{ width: size, height: size }}
    >
      <motion.span
        className="absolute left-0 top-0 h-full"
        style={{
          width: "40%",
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          filter: "blur(2px)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "250%" }}
        transition={{
          duration,
          ease: "linear",
          repeat: Infinity,
        }}
      />
    </div>
  );
}
