/**
 * 外观分区（Beta9 · 任务17 + 任务9）
 *
 * 包含：
 * - 深浅模式（跟随系统 / 浅色 / 深色）
 * - 8 色主题色板 + 自定义取色器（Beta9 任务9）
 * - 亚克力背景开关（系统级 Acrylic，Win10/11 通用，低性能机器可关闭）
 * - 界面密度 / 字体 / 图标风格 / LiquidGlass（Beta9 任务17 外观扩充）
 */

import { useState } from "react";
import { Check, Palette } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThemeStore } from "@/stores/theme";
import {
  THEME_COLORS,
  THEME_MODES,
  type Density,
  type FontFamily,
  type FontSize,
  type IconStyle,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/** 密度选项（Beta9 任务17a） */
const DENSITY_OPTIONS: { key: Density; label: string }[] = [
  { key: "compact", label: "紧凑" },
  { key: "standard", label: "标准" },
  { key: "comfortable", label: "舒适" },
];

/** 字体族选项（Beta9 任务17b） */
const FONT_FAMILY_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: "system", label: "系统默认" },
  { key: "mono", label: "等宽" },
];

/** 字号选项（Beta9 任务17b） */
const FONT_SIZE_OPTIONS: { key: FontSize; label: string }[] = [
  { key: "small", label: "小" },
  { key: "standard", label: "标准" },
  { key: "large", label: "大" },
];

/** 图标风格选项（Beta9 任务17c） */
const ICON_STYLE_OPTIONS: { key: IconStyle; label: string }[] = [
  { key: "lucide", label: "Lucide" },
  { key: "segoe", label: "Segoe 系统图标" },
];

export function AppearanceSection() {
  const {
    config,
    setMode,
    setColor,
    setAcrylicEnabled,
    customColor,
    setCustomColor,
    clearCustomColor,
    appearance,
    setAppearance,
  } = useThemeStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      {/* 深浅模式 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">深浅模式</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            选择应用外观模式，跟随系统将根据系统主题自动切换
          </p>
        </div>
        <div className="flex gap-2">
          {THEME_MODES.map((mode) => (
            <button
              key={mode.key}
              onClick={() => setMode(mode.key)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                config.mode === mode.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      {/* 主题色（8 色预设 + 自定义取色器按钮） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">主题色</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Win11 8 色色板，影响按钮、链接、高亮等强调色。末尾画笔按钮可自定义颜色
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={color.key}
              onClick={() => setColor(color.key)}
              title={color.label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                !customColor && config.color === color.key
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color.preview }}
            >
              {!customColor && config.color === color.key && (
                <Check className="h-5 w-5 text-white drop-shadow" />
              )}
            </button>
          ))}
          {/* 自定义取色器按钮（画笔图标，选中时显示当前自定义色） */}
          <button
            onClick={() => setPickerOpen(true)}
            title="自定义颜色"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
              customColor
                ? "border-foreground scale-110"
                : "border-dashed border-input hover:scale-105 hover:border-primary",
            )}
            style={customColor ? { backgroundColor: customColor } : undefined}
          >
            {customColor ? (
              <Check className="h-5 w-5 text-white drop-shadow" />
            ) : (
              <Palette className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        {/* 自定义色清除按钮 */}
        {customColor && (
          <button
            onClick={() => clearCustomColor()}
            className="text-left text-xs text-muted-foreground hover:text-foreground"
          >
            清除自定义色（{customColor}），恢复预设
          </button>
        )}
      </section>

      {/* 亚克力背景 */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">亚克力背景</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            系统级磨砂玻璃效果（Win11 DWMSB / Win10 兼容降级，默认开启）。低性能机器可关闭以减少 GPU 占用
          </p>
        </div>
        <Switch
          checked={config.acrylic_enabled}
          onCheckedChange={setAcrylicEnabled}
        />
      </section>

      {/* 界面密度（Beta9 任务17a） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">界面密度</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            控制页面内容间距：紧凑可显示更多信息，舒适更透气
          </p>
        </div>
        <div className="flex gap-2">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAppearance({ density: opt.key })}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                appearance.density === opt.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 字体（Beta9 任务17b：字体族 + 字号，Win10 兼容 fallback） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">字体</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            系统栈自动兼容 Win10/11（Segoe UI / Segoe UI Variable）；等宽为 Cascadia（Win10 自动回退 Consolas）
          </p>
        </div>
        <div className="flex gap-2">
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAppearance({ fontFamily: opt.key })}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                appearance.fontFamily === opt.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" />
          {FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAppearance({ fontSize: opt.key })}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                appearance.fontSize === opt.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 图标风格（Beta9 任务17c：侧边栏 lucide / Segoe 系统图标切换） */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">图标风格</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            侧边栏导航图标切换：Lucide（默认）或 Segoe 系统图标（Win11 Fluent / Win10 MDL2）
          </p>
        </div>
        <div className="flex gap-2">
          {ICON_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAppearance({ iconStyle: opt.key })}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-200",
                appearance.iconStyle === opt.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* LiquidGlass 实验性（Beta9 任务17d） */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">
            LiquidGlass 玻璃效果
            <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
              实验性
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            展示页（关于 Hero / 首页卡片）叠加玻璃折射高光。默认关闭，不影响交互流畅度
          </p>
        </div>
        <Switch
          checked={appearance.liquidGlass}
          onCheckedChange={(v) => setAppearance({ liquidGlass: v })}
        />
      </section>

      {/* 自定义取色器弹窗（Beta9 任务9） */}
      <ColorPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialColor={customColor || "#0078D4"}
        onConfirm={(hex) => {
          setCustomColor(hex);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

/**
 * 自定义取色器弹窗（Beta9 任务9）
 *
 * 类似 Win10 个性化弹窗：
 * - 原生 <input type="color"> 取色板（点击选色）
 * - hex 文本输入（手动输入）
 * - 预设快捷色（常用色快速选）
 * - 实时预览
 */
function ColorPickerDialog({
  open,
  onOpenChange,
  initialColor,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialColor: string;
  onConfirm: (hex: string) => void;
}) {
  const [hex, setHex] = useState(initialColor);

  // 弹窗打开时同步初始色
  const handleOpenChange = (o: boolean) => {
    if (o) setHex(initialColor);
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>自定义颜色</DialogTitle>
          <DialogDescription>
            选择自定义主题色，将覆盖预设色板
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* 预览块 + 原生取色器 */}
          <div className="flex items-center gap-3">
            <label
              className="relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 shadow-inner"
              style={{ backgroundColor: hex }}
              title="点击选色"
            >
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">实时预览</p>
              <div
                className="mt-1 rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: hex }}
              >
                主题色示例文字
              </div>
            </div>
          </div>

          {/* hex 文本输入 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">HEX</span>
            <input
              type="text"
              value={hex}
              onChange={(e) => {
                let v = e.target.value.toUpperCase();
                if (!v.startsWith("#")) v = "#" + v;
                if (/^#[0-9A-F]{0,6}$/.test(v)) setHex(v);
              }}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              maxLength={7}
            />
          </div>

          {/* 预设快捷色 */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">快捷色</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "#E81123", "#FF4343", "#FF8C00", "#F5C518",
                "#107C10", "#00A050", "#00BC7E", "#00B294",
                "#0078D4", "#0099BC", "#0063B1", "#5C2D91",
                "#8764B8", "#B146C2", "#E3008C", "#C239B3",
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => setHex(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-transform hover:scale-110",
                    hex.toUpperCase() === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onConfirm(hex)}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
