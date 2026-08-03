import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { settingCommands, systemCommands, type Setting } from "@/lib/tauri";

/**
 * 关闭行为弹窗（Phase 6a · SPEC 4.2）
 *
 * 监听后端 `window:close-requested` 事件（close_behavior=ask 时触发）。
 * 用户选择：
 * - 最小化到托盘 → hide_main_window + 可选记住选择
 * - 退出应用 → exit_app + 可选记住选择
 * - 取消 → 不操作
 */
export function CloseBehaviorDialog() {
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("window:close-requested", () => setOpen(true)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  /** 记住选择到 settings 表 */
  const saveBehavior = async (behavior: "minimize" | "exit") => {
    if (!remember) return;
    const setting: Setting = {
      key: "general.close_behavior",
      value: behavior,
      value_type: "string",
    };
    try {
      await settingCommands.setSetting(setting);
    } catch (e) {
      console.error("[close-behavior] 保存关闭行为失败:", e);
    }
  };

  const handleMinimize = async () => {
    setOpen(false);
    await saveBehavior("minimize");
    try {
      await systemCommands.hideMainWindow();
    } catch (e) {
      console.error("[close-behavior] 隐藏窗口失败:", e);
    }
  };

  const handleExit = async () => {
    setOpen(false);
    await saveBehavior("exit");
    try {
      await systemCommands.exitApp();
    } catch (e) {
      console.error("[close-behavior] 退出应用失败:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>关闭窗口</DialogTitle>
          <DialogDescription>
            选择关闭主窗口时的行为，可在设置中修改
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sm">记住选择（不再询问）</span>
          <Switch checked={remember} onCheckedChange={setRemember} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={handleMinimize}>
            最小化到托盘
          </Button>
          <Button variant="destructive" onClick={handleExit}>
            退出应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
