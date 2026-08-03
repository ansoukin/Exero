/**
 * 媒体与输入类动作表单（3 种）
 *
 * - SetVolume：调节音量
 * - PlaySound：播放声音
 * - SimulateKey：模拟按键
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionFormProps } from "@/pages/quickactions/forms";
import {
  boolValue,
  numValue,
  strValue,
  updateField,
} from "@/pages/quickactions/forms/helpers";

// ============================================================
// SetVolume：调节音量
// ============================================================
function SetVolumeForm({ params, onChange }: ActionFormProps) {
  const mode = params.mute ? "mute" : params.volume !== null && params.volume !== undefined ? "volume" : "none";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">模式</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            if (v === "mute") onChange({ ...params, mute: true, volume: null });
            else if (v === "volume") onChange({ ...params, mute: false, volume: params.volume ?? 50 });
            else onChange({ ...params, mute: false, volume: null });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不修改</SelectItem>
            <SelectItem value="volume">设定音量</SelectItem>
            <SelectItem value="mute">静音</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "volume" && (
        <div className="space-y-1.5">
          <Label className="text-xs">音量（0-100）</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={(params.volume as number) ?? 50}
            onChange={(e) => {
              const v = numValue(e);
              onChange(updateField(params, "volume", Math.max(0, Math.min(100, v))));
            }}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// PlaySound：播放声音
// ============================================================
function PlaySoundForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">音源路径或系统声音名 *</Label>
        <Input
          value={(params.source as string) || ""}
          onChange={(e) => onChange(updateField(params, "source", strValue(e)))}
          placeholder="C:\sounds\bell.wav 或 SystemNotification"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">音量（0-100，可选）</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={typeof params.volume === "number" ? params.volume : ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : numValue(e);
            onChange(updateField(params, "volume", v));
          }}
          placeholder="留空使用系统音量"
          className="h-8 text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!params.loop}
          onChange={(e) => onChange(updateField(params, "loop", boolValue(e)))}
          className="h-3.5 w-3.5"
        />
        循环播放
      </label>
    </div>
  );
}

// ============================================================
// SimulateKey：模拟按键
// ============================================================
function SimulateKeyForm({ params, onChange }: ActionFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">按键序列 *</Label>
        <Input
          value={(params.keys as string) || ""}
          onChange={(e) => onChange(updateField(params, "keys", strValue(e)))}
          placeholder="Ctrl+C / Win+D / Alt+Tab"
          className="h-8 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          组合键用 + 连接，多组用空格分隔
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">重复次数</Label>
        <Input
          type="number"
          min={1}
          value={(params.repeat as number) ?? 1}
          onChange={(e) => {
            const v = Math.max(1, numValue(e));
            onChange(updateField(params, "repeat", v));
          }}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ============================================================
// 导出
// ============================================================
export const MediaInputForms = {
  SetVolume: SetVolumeForm,
  PlaySound: PlaySoundForm,
  SimulateKey: SimulateKeyForm,
};
