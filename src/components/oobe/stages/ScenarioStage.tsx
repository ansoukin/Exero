/**
 * OOBE 阶段：使用场景选择（重启前）
 *
 * 学校 / 日常自用 / 其它（占位）
 * 选择后持久化到 settings.app.mode，自动进入下一阶段
 */

import { GraduationCap, Home, MoreHorizontal, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOobeStore, type AppMode } from "@/stores/oobe";
import { OobeShell } from "../OobeWizard";

interface ScenarioOption {
  mode: AppMode | "other";
  label: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const OPTIONS: ScenarioOption[] = [
  {
    mode: "school",
    label: "学校",
    description: "基于课表的自动化管理（课程提醒、调课、节次触发器）",
    icon: GraduationCap,
  },
  {
    mode: "daily",
    label: "日常自用",
    description: "基于快捷指令触发时间的日常自动化管理",
    icon: Home,
  },
  {
    mode: "other",
    label: "其它",
    description: "敬请期待（占位选项，后续版本处理）",
    icon: MoreHorizontal,
    disabled: true,
  },
];

export function ScenarioStage() {
  const setAppMode = useOobeStore((s) => s.setAppMode);
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);

  const handleSelect = async (option: ScenarioOption) => {
    if (option.disabled) return;
    await setAppMode(option.mode as AppMode);
    next();
  };

  return (
    <OobeShell
      stage="scenario"
      title="选择你的使用场景"
      subtitle="选择后可在设置中随时切换"
      hideNav
      onBack={() => goTo("license")}
    >
      <div className="flex flex-col gap-4">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.mode}
              onClick={() => handleSelect(option)}
              disabled={option.disabled}
              className={cn(
                "group flex items-center gap-5 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all duration-300",
                option.disabled
                  ? "cursor-not-allowed opacity-40"
                  : "hover:border-primary/50 hover:bg-primary/[0.06] hover:shadow-lg hover:shadow-primary/5",
              )}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="text-base font-medium">{option.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </OobeShell>
  );
}
