/**
 * OOBE 阶段：个性化选择（致敬 Windows 11 主题选择）
 *
 * 深色/浅色模式 + 8 色主题色
 * 选择后通过 useThemeStore 立即应用 + 持久化
 */

import { Moon, Sun, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOobeStore } from "@/stores/oobe";
import { useThemeStore } from "@/stores/theme";
import type { ThemeMode, ThemeColor } from "@/lib/tauri";
import { OobeShell } from "../OobeWizard";

const THEME_COLORS: { key: ThemeColor; label: string; preview: string }[] = [
  { key: "blue", label: "蓝", preview: "#0078D4" },
  { key: "green", label: "绿", preview: "#107C10" },
  { key: "orange", label: "橙", preview: "#D83B01" },
  { key: "purple", label: "紫", preview: "#5C2D91" },
  { key: "red", label: "红", preview: "#E81123" },
  { key: "cyan", label: "青", preview: "#0099BC" },
  { key: "pink", label: "粉", preview: "#E3008C" },
  { key: "yellow", label: "黄", preview: "#FFB900" },
];

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: LucideIcon }[] = [
  { key: "dark", label: "深色", icon: Moon },
  { key: "light", label: "浅色", icon: Sun },
];

export function PersonalizationStage() {
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);
  const themeConfig = useThemeStore((s) => s.config);
  const setMode = useThemeStore((s) => s.setMode);
  const setColor = useThemeStore((s) => s.setColor);

  return (
    <OobeShell
      stage="personalization"
      title="个性化选择"
      subtitle="选择你喜欢的视觉风格"
      canNext
      onNext={next}
      onBack={() => goTo("quick_settings")}
    >
      {/* 深色/浅色模式 */}
      <div className="grid grid-cols-2 gap-4">
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = themeConfig.mode === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={cn(
                "flex items-center gap-4 rounded-2xl border p-5 transition-all duration-300",
                selected
                  ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
                  : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/[0.03]",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* 8 色主题 */}
      <div>
        <p className="mb-4 text-sm font-medium">主题色</p>
        <div className="grid grid-cols-4 gap-4">
          {THEME_COLORS.map((color) => {
            const selected = themeConfig.color === color.key;
            return (
              <button
                key={color.key}
                onClick={() => setColor(color.key)}
                className={cn(
                  "flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-300",
                  selected
                    ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
                    : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/[0.03]",
                )}
              >
                <span
                  className="h-9 w-9 rounded-full shadow-sm"
                  style={{ backgroundColor: color.preview }}
                />
                <span className="text-xs">{color.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </OobeShell>
  );
}
