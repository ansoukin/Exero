/**
 * 应用内通知 Toast（Beta9 · 任务11 · sonner 迁移）
 *
 * 监听后端 `notification:in-app` 事件，调用 sonner.toast() 显示通知。
 * 替代原手写 Toast 堆叠/自动消失/5条限制逻辑（sonner 内置）。
 *
 * 事件来源：
 * - ShowInAppNotification 动作执行器（ctx.emit_in_app_notification）
 * - Lua 脚本 exero.notify(level, title, body)
 * - 容错策略 Notify（handle_fault）
 *
 * 级别映射：info→toast.info / warning→toast.warning / error→toast.error / success→toast.success
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { toast } from "@/components/ui/sonner";

interface InAppNotificationPayload {
  level: string;
  title: string;
  body: string;
  timestamp: string;
  flow_id: string;
}

/** 规范化级别（后端可能传任意字符串，兜底为 info） */
function normalizeLevel(level: string): "info" | "warning" | "error" | "success" {
  switch (level) {
    case "info":
    case "warning":
    case "error":
    case "success":
      return level;
    default:
      return "info";
  }
}

export function NotificationToast() {
  useEffect(() => {
    // 监听后端 notification:in-app 事件，转发给 sonner
    const unlistenPromise = listen<InAppNotificationPayload>(
      "notification:in-app",
      (event) => {
        const { level, title, body } = event.payload;
        const normalized = normalizeLevel(level);
        // sonner.toast 各级别 API
        switch (normalized) {
          case "info":
            toast.info(title, { description: body });
            break;
          case "warning":
            toast.warning(title, { description: body });
            break;
          case "error":
            toast.error(title, { description: body });
            break;
          case "success":
            toast.success(title, { description: body });
            break;
        }
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // 本组件不渲染 UI，仅作为事件桥接（<Toaster /> 在 Layout.tsx 渲染）
  return null;
}
