/**
 * 外观分区（Phase 6a · SPEC 3.5 页面 5 分区 1）
 *
 * 包含：
 * - 深浅模式（跟随系统 / 浅色 / 深色）
 * - 8 色主题色板（Win11 色板）
 * - Mica 背景开关（默认关闭，需 Windows 11 + decorations:false）
 */

import { Check } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useThemeStore } from "@/stores/theme";
import { THEME_COLORS, THEME_MODES } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function AppearanceSection() {
  const { config, setMode, setColor, setMicaEnabled } = useThemeStore();

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

      {/* 主题色 */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium">主题色</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Win11 8 色色板，影响按钮、链接、高亮等强调色
          </p>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={color.key}
              onClick={() => setColor(color.key)}
              title={color.label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                config.color === color.key
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color.preview }}
            >
              {config.color === color.key && (
                <Check className="h-5 w-5 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Mica 背景 */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-medium">Mica 背景</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Windows 11 云母材质背景（仅 Windows 11 22000+ 且无边框模式可用，当前系统标题栏模式下不可用）
          </p>
        </div>
        <Switch
          checked={config.mica_enabled}
          onCheckedChange={setMicaEnabled}
        />
      </section>
    </div>
  );
}
