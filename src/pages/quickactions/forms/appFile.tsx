/**
 * 应用与文件类动作表单（4 种）
 *
 * - LaunchProgram：启动程序
 * - KillProcess：关闭进程
 * - OpenUrl：打开网页
 * - OpenFile：打开文件
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import {
  boolValue,
  numValue,
  strValue,
  updateField,
} from "@/pages/quickactions/forms/helpers";

// ============================================================
// LaunchProgram：启动程序
// ============================================================
function LaunchProgramForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">可执行文件路径 *</Label>
        <Input
          value={(params.path as string) || ""}
          onChange={(e) => onChange(updateField(params, "path", strValue(e)))}
          placeholder="C:\Windows\notepad.exe"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">命令行参数</Label>
        <Input
          value={(params.args as string) || ""}
          onChange={(e) => onChange(updateField(params, "args", strValue(e)))}
          placeholder="可选..."
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">工作目录</Label>
        <Input
          value={(params.working_dir as string) || ""}
          onChange={(e) => onChange(updateField(params, "working_dir", strValue(e)))}
          placeholder="可选..."
          className="h-8 text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.run_as_admin}
          onChange={(e) => onChange(updateField(params, "run_as_admin", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        以管理员权限运行
      </label>
    </div>
  );
}

// ============================================================
// KillProcess：关闭进程
// ============================================================
function KillProcessForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">进程名或 PID *</Label>
        <Input
          value={(params.target as string) || ""}
          onChange={(e) => onChange(updateField(params, "target", strValue(e)))}
          placeholder="notepad.exe 或 1234"
          className="h-8 text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.force}
          onChange={(e) => onChange(updateField(params, "force", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        强制结束
      </label>
      <div className="space-y-1.5">
        <Label className="text-xs">等待超时（毫秒，0 = 不等待）</Label>
        <Input
          type="number"
          value={(params.timeout_ms as number) ?? 0}
          onChange={(e) => onChange(updateField(params, "timeout_ms", numValue(e)))}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ============================================================
// OpenUrl：打开网页
// ============================================================
function OpenUrlForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">URL *</Label>
        <Input
          value={(params.url as string) || ""}
          onChange={(e) => onChange(updateField(params, "url", strValue(e)))}
          placeholder="https://example.com"
          className="h-8 text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.new_window}
          onChange={(e) => onChange(updateField(params, "new_window", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        在新窗口打开
      </label>
    </div>
  );
}

// ============================================================
// OpenFile：打开文件
// ============================================================
function OpenFileForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">文件路径 *</Label>
        <Input
          value={(params.path as string) || ""}
          onChange={(e) => onChange(updateField(params, "path", strValue(e)))}
          placeholder="D:\docs\report.pdf"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">打开方式（程序路径）</Label>
        <Input
          value={(params.open_with as string) || ""}
          onChange={(e) => onChange(updateField(params, "open_with", strValue(e)))}
          placeholder="留空使用默认程序"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ============================================================
// 导出
// ============================================================
export const AppFileForms = {
  LaunchProgram: LaunchProgramForm,
  KillProcess: KillProcessForm,
  OpenUrl: OpenUrlForm,
  OpenFile: OpenFileForm,
};
