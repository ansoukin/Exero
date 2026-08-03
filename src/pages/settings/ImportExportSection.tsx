/**
 * 导入导出分区（Phase 6b · SPEC 5.5）
 *
 * 实现 .exero 文件格式（zip 包，含 JSON 数据 + Lua 脚本）。
 * 范围：快捷指令 / 课表 / 设置 / Lua 脚本 / 全部
 * 用途：U 盘导入导出（家里 ↔ 学校配置同步）
 *
 * 导入模式：
 * - merge：保留现有数据，新数据 INSERT OR REPLACE
 * - replace：先清空范围内现有数据，再导入
 */

import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ioCommands, type ExportScope, type ImportMode } from "@/lib/tauri";

/** 导出范围选项 */
const SCOPE_OPTIONS: { key: ExportScope; label: string; desc: string }[] = [
  { key: "all", label: "全部", desc: "所有数据" },
  { key: "flows", label: "快捷指令", desc: "flows + actions + triggers" },
  { key: "courses", label: "课表", desc: "学期 + 节次 + 课程 + 调课 + 模板" },
  { key: "settings", label: "设置", desc: "settings 表（排除敏感项）" },
  { key: "scripts", label: "Lua 脚本", desc: "本地 .lua 文件 + 元数据" },
];

/** 导入模式选项 */
const IMPORT_MODES: { key: ImportMode; label: string; desc: string }[] = [
  { key: "merge", label: "合并", desc: "保留现有数据，新数据覆盖同 ID" },
  { key: "replace", label: "替换", desc: "先清空范围内数据，再导入" },
];

/** 反馈消息 */
interface Feedback {
  type: "success" | "error";
  message: string;
}

export function ImportExportSection() {
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [importScope, setImportScope] = useState<ExportScope>("all");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const filePath = await saveDialog({
        title: "选择导出位置",
        defaultPath: `exero_export_${new Date().toISOString().slice(0, 10)}.exero`,
        filters: [{ name: "Exero 备份文件", extensions: ["exero"] }],
      });
      if (!filePath) {
        // 用户取消
        return;
      }

      const result = await ioCommands.exportData(filePath, [exportScope]);
      const sizeKb = (result.file_size / 1024).toFixed(1);
      setFeedback({
        type: "success",
        message: `导出成功：${result.file_path}（${sizeKb} KB）`,
      });
    } catch (e) {
      setFeedback({
        type: "error",
        message: `导出失败：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setFeedback(null);
    try {
      const filePath = await openDialog({
        title: "选择 .exero 文件",
        multiple: false,
        filters: [{ name: "Exero 备份文件", extensions: ["exero"] }],
      });
      if (!filePath || typeof filePath !== "string") {
        // 用户取消
        return;
      }

      const result = await ioCommands.importData(filePath, [importScope], importMode);
      const total =
        result.flows +
        result.actions +
        result.triggers +
        result.semesters +
        result.class_periods +
        result.weekly_templates +
        result.courses +
        result.schedule_overrides +
        result.settings +
        result.lua_scripts +
        result.script_files;
      setFeedback({
        type: "success",
        message: `导入成功：共 ${total} 条记录（含 ${result.script_files} 个 Lua 脚本文件）`,
      });
    } catch (e) {
      setFeedback({
        type: "error",
        message: `导入失败：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">导入导出</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          将数据导出为 .exero 文件（zip 格式，含 JSON + Lua 脚本），用于 U 盘导入导出（家里 ↔ 学校配置同步）
        </p>
      </div>

      {/* 导出区 */}
      <div className="rounded-md border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">导出数据</h4>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((item) => (
            <button
              key={item.key}
              onClick={() => setExportScope(item.key)}
              title={item.desc}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                exportScope === item.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button
          variant="default"
          onClick={handleExport}
          disabled={exporting}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "导出中..." : "选择位置并导出"}
        </Button>
      </div>

      {/* 导入区 */}
      <div className="rounded-md border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">导入数据</h4>
        </div>

        <div className="mb-3">
          <div className="mb-1 text-xs text-muted-foreground">导入范围</div>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((item) => (
              <button
                key={item.key}
                onClick={() => setImportScope(item.key)}
                title={item.desc}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                  importScope === item.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 text-xs text-muted-foreground">导入模式</div>
          <div className="flex flex-wrap gap-2">
            {IMPORT_MODES.map((item) => (
              <button
                key={item.key}
                onClick={() => setImportMode(item.key)}
                title={item.desc}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                  importMode === item.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="default"
          onClick={handleImport}
          disabled={importing}
          className="gap-2"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importing ? "导入中..." : "选择文件并导入"}
        </Button>

        {importMode === "replace" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <RotateCcw className="h-3 w-3" />
            替换模式会先清空范围内现有数据，请谨慎操作
          </p>
        )}
      </div>

      {/* 反馈消息 */}
      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
            feedback.type === "success"
              ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-all">{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
