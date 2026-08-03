import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

/**
 * 应用内通知 Toast 组件（Phase 5 修复）
 *
 * 监听后端 `notification:in-app` 事件，在右下角显示通知卡片。
 *
 * 事件来源：
 * - ShowInAppNotification 动作执行器（ctx.emit_in_app_notification）
 * - Lua 脚本 exero.notify(level, title, body)
 * - 容错策略 Notify（handle_fault）
 *
 * 通知 5 秒后自动消失，最多同时显示 5 条。
 */

interface InAppNotificationPayload {
  level: string;
  title: string;
  body: string;
  timestamp: string;
  flow_id: string;
}

interface NotificationItem extends InAppNotificationPayload {
  id: number;
  level: "info" | "warning" | "error" | "success";
}

let notificationIdCounter = 0;

/** 级别配置：图标 + 主题色 */
const LEVEL_CONFIG: Record<
  NotificationItem["level"],
  { icon: typeof Info; border: string; iconColor: string }
> = {
  info: { icon: Info, border: "border-l-blue-500", iconColor: "text-blue-500" },
  warning: {
    icon: AlertTriangle,
    border: "border-l-yellow-500",
    iconColor: "text-yellow-500",
  },
  error: {
    icon: AlertCircle,
    border: "border-l-red-500",
    iconColor: "text-red-500",
  },
  success: {
    icon: CheckCircle,
    border: "border-l-green-500",
    iconColor: "text-green-500",
  },
};

/** 规范化级别（后端可能传任意字符串） */
function normalizeLevel(level: string): NotificationItem["level"] {
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    // 监听后端 notification:in-app 事件
    const unlistenPromise = listen<InAppNotificationPayload>(
      "notification:in-app",
      (event) => {
        const item: NotificationItem = {
          ...event.payload,
          level: normalizeLevel(event.payload.level),
          id: ++notificationIdCounter,
        };
        setNotifications((prev) => [item, ...prev].slice(0, 5));
        // 5 秒后自动移除
        setTimeout(() => {
          removeNotification(item.id);
        }, 5000);
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [removeNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {notifications.map((n) => {
        const config = LEVEL_CONFIG[n.level];
        const Icon = config.icon;
        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-md border border-l-4 ${config.border} bg-card p-3 shadow-lg animate-in slide-in-from-right-full fade-in duration-300`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground">
                {n.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
                {n.body}
              </p>
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
