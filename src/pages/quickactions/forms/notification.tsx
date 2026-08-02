/**
 * 通知类动作表单（2 种）
 *
 * - ShowToast：Toast 通知（系统级）
 * - ShowInAppNotification：应用内通知
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import { strValue, updateField } from "@/pages/quickactions/forms/helpers";

// ============================================================
// ShowToast：Toast 通知
// ============================================================
function ShowToastForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">标题 *</Label>
        <Input
          value={(params.title as string) || ""}
          onChange={(e) => onChange(updateField(params, "title", strValue(e)))}
          placeholder="通知标题"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">正文</Label>
        <Textarea
          value={(params.body as string) || ""}
          onChange={(e) => onChange(updateField(params, "body", strValue(e)))}
          placeholder="通知内容..."
          className="min-h-[60px] text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">图标路径（可选）</Label>
        <Input
          value={(params.icon as string) || ""}
          onChange={(e) => onChange(updateField(params, "icon", strValue(e)))}
          placeholder="C:\icons\app.ico"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ============================================================
// ShowInAppNotification：应用内通知
// ============================================================
function ShowInAppNotificationForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">标题 *</Label>
        <Input
          value={(params.title as string) || ""}
          onChange={(e) => onChange(updateField(params, "title", strValue(e)))}
          placeholder="通知标题"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">正文</Label>
        <Textarea
          value={(params.body as string) || ""}
          onChange={(e) => onChange(updateField(params, "body", strValue(e)))}
          placeholder="通知内容..."
          className="min-h-[60px] text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">通知级别</Label>
        <Select
          value={(params.level as string) || "info"}
          onValueChange={(v) => onChange(updateField(params, "level", v))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">信息</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="error">错误</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ============================================================
// 导出
// ============================================================
export const NotificationForms = {
  ShowToast: ShowToastForm,
  ShowInAppNotification: ShowInAppNotificationForm,
};
