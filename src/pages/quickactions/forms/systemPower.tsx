/**
 * 系统与电源类动作表单（7 种）
 *
 * - Shutdown / Reboot / LockScreen / Hibernate / Logoff：共享 PowerActionParams
 * - CleanTempFiles：清理临时文件
 * - SwitchPowerPlan：切换电源计划
 *
 * 5 种电源动作参数结构相同（delay_secs / force / message），
 * 抽取公共 PowerActionForm 组件复用。
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import {
  boolValue,
  numValue,
  strValue,
  updateField,
} from "@/pages/quickactions/forms/helpers";

// ============================================================
// 公共电源动作表单（5 种电源动作复用）
// ============================================================
function PowerActionForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">延迟秒数（0 = 立即）</Label>
        <Input
          type="number"
          min={0}
          value={(params.delay_secs as number) ?? 0}
          onChange={(e) => onChange(updateField(params, "delay_secs", Math.max(0, numValue(e))))}
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
        强制执行（不等待程序响应）
      </label>
      <div className="space-y-1.5">
        <Label className="text-xs">提示消息</Label>
        <Textarea
          value={(params.message as string) || ""}
          onChange={(e) => onChange(updateField(params, "message", strValue(e)))}
          placeholder="可选，显示给用户的关机/重启提示..."
          className="min-h-[50px] text-xs"
        />
      </div>
    </div>
  );
}

// 5 种电源动作共享同一表单
const ShutdownForm = PowerActionForm;
const RebootForm = PowerActionForm;
const LockScreenForm = PowerActionForm;
const HibernateForm = PowerActionForm;
const LogoffForm = PowerActionForm;

// ============================================================
// CleanTempFiles：清理临时文件
// ============================================================
function CleanTempFilesForm({ params, onChange }: ActionFormProps) {
  const dirsValue = Array.isArray(params.dirs) ? (params.dirs as string[]).join("\n") : "";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">清理目录（每行一个，留空用系统默认）</Label>
        <Textarea
          value={dirsValue}
          onChange={(e) => {
            const dirs = e.target.value ? e.target.value.split("\n").filter(Boolean) : null;
            onChange(updateField(params, "dirs", dirs));
          }}
          placeholder={"%TEMP%\nC:\\Windows\\Temp"}
          className="min-h-[70px] text-xs font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">文件通配符</Label>
        <Input
          value={(params.pattern as string) || "*.*"}
          onChange={(e) => onChange(updateField(params, "pattern", strValue(e)))}
          className="h-8 text-xs font-mono"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.recursive}
          onChange={(e) => onChange(updateField(params, "recursive", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        递归子目录
      </label>
      <div className="space-y-1.5">
        <Label className="text-xs">最小保留时间（分钟）</Label>
        <Input
          type="number"
          min={0}
          value={(params.min_age_minutes as number) ?? 0}
          onChange={(e) => onChange(updateField(params, "min_age_minutes", Math.max(0, numValue(e))))}
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">0 = 不限制，仅清理存在时间超过此值的文件</p>
      </div>
    </div>
  );
}

// ============================================================
// SwitchPowerPlan：切换电源计划
// ============================================================
function SwitchPowerPlanForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">电源计划 GUID *</Label>
        <Input
          value={(params.plan_guid as string) || ""}
          onChange={(e) => onChange(updateField(params, "plan_guid", strValue(e)))}
          placeholder="381b4222-f694-4f62-9c5f-c1f5c2a8b5c3"
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
        <p className="font-medium">常用 GUID：</p>
        <ul className="mt-1 space-y-0.5">
          <li>平衡：381b4222-f694-4f62-9c5f-c1f5c2a8b5c3</li>
          <li>高性能：8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c</li>
          <li>节能：a1841308-3541-4fab-bc81-f71556f20b4a</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// 导出
// ============================================================
export const SystemPowerForms = {
  Shutdown: ShutdownForm,
  Reboot: RebootForm,
  LockScreen: LockScreenForm,
  Hibernate: HibernateForm,
  Logoff: LogoffForm,
  CleanTempFiles: CleanTempFilesForm,
  SwitchPowerPlan: SwitchPowerPlanForm,
};
