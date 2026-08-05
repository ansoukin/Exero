import { useEffect, useRef, useState, useCallback } from "react";

/** 长按触发时携带的视口坐标（用于菜单定位） */
export interface LongPressPosition {
  x: number;
  y: number;
}

/**
 * 长按 hook（SPEC 3.5 页面 2：长按课程块 500ms 弹出操作菜单）
 *
 * 触屏无右键，统一用长按替代。同时支持鼠标与触摸：
 * - 鼠标：pointerdown 开始计时，pointerup/pointerleave 取消
 * - 触摸：pointerdown 开始计时，pointerup/pointercancel 取消
 *
 * 触发时回调接收视口坐标，用于菜单定位。
 *
 * @param onLongPress 长按触发回调，携带触发坐标
 * @param duration 长按持续时间（毫秒），默认 500
 */
export function useLongPress(
  onLongPress: (pos: LongPressPosition) => void,
  duration = 500
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef<LongPressPosition>({ x: 0, y: 0 });
  const [isLongPress, setIsLongPress] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // 记录触发坐标（视口坐标，用于菜单定位）
      posRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        setIsLongPress(true);
        onLongPress(posRef.current);
      }, duration);
    },
    [onLongPress, duration, clearTimer]
  );

  const cancel = useCallback(() => {
    clearTimer();
    setIsLongPress(false);
  }, [clearTimer]);

  // 卸载时清理
  useEffect(() => clearTimer, [clearTimer]);

  return {
    isLongPress,
    /** 主动取消长按定时器 */
    cancel,
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
