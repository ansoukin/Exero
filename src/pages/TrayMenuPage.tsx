/**
 * 托盘菜单页（Beta9 · 任务2 · 统一 8px 圆角）
 *
 * 参考 NexBox TrayMenuPage 设计：纯色背景 + 8px 圆角 + 无边框。
 *
 * 设计要点：
 * - 圆角 8px（与主窗口统一）
 * - 纯色背景 #1a1a1a（无毛玻璃，避免透明窗口渲染黑色）
 * - 无 border（去掉窗口边框感）
 * - 窗口尺寸 160×114，3 项菜单紧凑排列
 *
 * 3 项菜单：
 * 1. 打开主窗口（Monitor 图标）
 * 2. 检查更新（RefreshCw 图标）
 * 3. 退出（LogOut 图标，红色 #e74c3c）
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Monitor, RefreshCw, LogOut } from "lucide-react";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

const EASE_FLUENT = [0.16, 1, 0.3, 1] as const;

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

function MenuItem({ icon, label, onClick, color = "#e0e0e0" }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2 border-none bg-transparent px-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-white/10 active:bg-white/[0.12]"
      style={{ color }}
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function TrayMenuPage() {
  useEffect(() => {
    // 失焦自动隐藏
    const unlisten = getCurrentWindow().onFocusChanged((event) => {
      if (!event.payload) {
        getCurrentWindow().hide();
      }
    });

    // ESC 关闭
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWindow().hide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /** 打开主窗口 */
  const handleShowWindow = async () => {
    const mainWindow = await Window.getByLabel("main");
    if (mainWindow) {
      await mainWindow.show();
      await mainWindow.unminimize();
      await mainWindow.setFocus();
    }
    await getCurrentWindow().hide();
  };

  /** 检查更新：显示主窗口并触发检查更新事件 */
  const handleCheckUpdate = async () => {
    const mainWindow = await Window.getByLabel("main");
    if (mainWindow) {
      await mainWindow.show();
      await mainWindow.unminimize();
      await mainWindow.setFocus();
    }
    // 触发主窗口的更新检查（主窗口监听 check-update 事件）
    await invoke("check_update_and_show").catch(() => {});
    await getCurrentWindow().hide();
  };

  /** 退出应用 */
  const handleExit = async () => {
    await invoke("exit_app").catch(() => {});
  };

  return (
    <div className="h-screen w-screen p-0">
      <motion.div
        className="h-full w-full overflow-hidden rounded-[8px]"
        style={{ backgroundColor: "#1a1a1a" }}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12, ease: EASE_FLUENT }}
      >
        <MenuItem
          icon={<Monitor size={16} strokeWidth={2} />}
          label="打开主窗口"
          onClick={handleShowWindow}
        />
        <div className="mx-3 h-px bg-white/[0.06]" />
        <MenuItem
          icon={<RefreshCw size={16} strokeWidth={2} />}
          label="检查更新"
          onClick={handleCheckUpdate}
        />
        <div className="mx-3 h-px bg-white/[0.06]" />
        <MenuItem
          icon={<LogOut size={16} strokeWidth={2} />}
          label="退出"
          onClick={handleExit}
          color="#e74c3c"
        />
      </motion.div>
    </div>
  );
}
