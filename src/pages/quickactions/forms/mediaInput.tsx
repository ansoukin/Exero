/**
 * 媒体与输入类动作表单（3 种）
 *
 * - SetVolume：调节音量
 * - PlaySound：播放声音
 * - SimulateKey：模拟按键
 */

import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** 键盘按键名称映射（KeyEvent.code/key -> 后端 parse_key_sequence 识别的名称） */
const KEY_DISPLAY_NAMES: Record<string, string> = {
  // 修饰键
  Control: "Ctrl",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  Alt: "Alt",
  AltLeft: "Alt",
  AltRight: "Alt",
  Shift: "Shift",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  Meta: "Win",
  MetaLeft: "Win",
  MetaRight: "Win",
  // 功能键
  Enter: "Enter",
  NumpadEnter: "Enter",
  Escape: "Esc",
  Tab: "Tab",
  Space: "Space",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  // F1-F12
  F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
};

/** 将键盘事件转换为后端可识别的按键名称 */
function keyEventToKeyName(e: KeyboardEvent): string | null {
  // 修饰键优先（按 code 识别左右 Ctrl/Alt/Shift/Meta）
  if (KEY_DISPLAY_NAMES[e.code]) {
    return KEY_DISPLAY_NAMES[e.code];
  }
  // 单字符键
  if (e.key.length === 1) {
    return e.key.toUpperCase();
  }
  // 其他命名键
  if (KEY_DISPLAY_NAMES[e.key]) {
    return KEY_DISPLAY_NAMES[e.key];
  }
  return null;
}

/** 按键捕捉弹窗 */
function KeyCaptureOverlay({
  onCapture,
  onCancel,
}: {
  onCapture: (keys: string) => void;
  onCancel: () => void;
}) {
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape 取消
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      const keyName = keyEventToKeyName(e);
      if (!keyName) return;

      setPressedKeys((prev) => {
        // 避免重复添加（按住不放）
        if (prev.includes(keyName)) return prev;
        return [...prev, keyName];
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 修饰键全部释放时，结束捕捉
      const isModifier = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
      const allModifiersReleased =
        !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;

      if (isModifier && allModifiersReleased && pressedKeys.length > 0) {
        // 组合键已完成（如 Ctrl+Shift）
        onCapture(pressedKeys.join("+"));
        return;
      }

      // 非修饰键释放且已有按键按下，结束捕捉
      if (!isModifier && pressedKeys.length > 0) {
        onCapture(pressedKeys.join("+"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [pressedKeys, onCapture, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="mx-4 max-w-md rounded-lg border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mb-3 text-sm font-medium text-card-foreground">
            按下按键组合
          </div>
          <div className="mb-4 text-xs text-muted-foreground">
            按下并释放任意按键组合，按 Esc 取消
          </div>
          <div className="flex min-h-[3rem] items-center justify-center rounded-md border border-dashed bg-background p-3">
            {pressedKeys.length > 0 ? (
              <span className="font-mono text-sm font-medium text-foreground">
                {pressedKeys.join(" + ")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                等待按键...
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          >
            取消（Esc）
          </button>
        </div>
      </div>
    </div>
  );
}

function SimulateKeyForm({ params, onChange }: ActionFormProps) {
  const [capturing, setCapturing] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">按键序列 *</Label>
        <div className="flex gap-2">
          <Input
            value={(params.keys as string) || ""}
            onChange={(e) => onChange(updateField(params, "keys", e.target.value))}
            placeholder="Ctrl+C / Win+D / Alt+Tab"
            className="h-8 flex-1 text-xs font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCapturing(true)}
            className="h-8 gap-1 text-xs"
          >
            <Keyboard className="h-3.5 w-3.5" />
            捕捉
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          点击"捕捉"按钮后按下按键组合，系统将自动识别并填入；也可手动输入，组合键用 + 连接
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
      {capturing && (
        <KeyCaptureOverlay
          onCapture={(keys) => {
            onChange(updateField(params, "keys", keys));
            setCapturing(false);
          }}
          onCancel={() => setCapturing(false)}
        />
      )}
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
