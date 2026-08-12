/**
 * OOBE 阶段：重启后入口 - 新/老用户分流
 *
 * "你是第一次使用软件吗？"
 * - 是 → 进入 quick_settings（新用户引导）
 * - 否 → 文件选择器导入 .exero 备份 → 完成
 */

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOobeStore } from "@/stores/oobe";
import { OobeShell } from "../OobeWizard";
import { ioCommands } from "@/lib/tauri";

export function PostRestartStage() {
  const next = useOobeStore((s) => s.next);
  const complete = useOobeStore((s) => s.complete);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setError(null);
    try {
      const filePath = await open({
        title: "选择 .exero 备份文件",
        filters: [{ name: "Exero 备份", extensions: ["exero"] }],
        multiple: false,
      });
      if (!filePath || typeof filePath !== "string") return;
      setImporting(true);
      await ioCommands.importData(filePath, ["all"], "replace");
      await complete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <OobeShell
      stage="post_restart"
      title="恢复你的数据"
      subtitle="我们将帮你完成剩余配置"
      hideNav
    >
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <button
          onClick={next}
          disabled={importing}
          className="group flex items-center gap-5 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all duration-300 hover:border-primary/50 hover:bg-primary/[0.06] hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
            <UserPlus className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="text-base font-medium">是，第一次使用</p>
            <p className="mt-1 text-sm text-muted-foreground">
              从快速设置开始配置应用
            </p>
          </div>
        </button>

        <button
          onClick={handleImport}
          disabled={importing}
          className={cn(
            "group flex items-center gap-5 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all duration-300",
            importing ? "opacity-50" : "hover:border-primary/50 hover:bg-primary/[0.06] hover:shadow-lg hover:shadow-primary/5",
          )}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
            {importing ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <UserCheck className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-base font-medium">否，从备份恢复</p>
            <p className="mt-1 text-sm text-muted-foreground">
              导入 .exero 备份文件恢复原有数据
            </p>
          </div>
        </button>
      </div>
    </OobeShell>
  );
}
