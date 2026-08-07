import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AppearanceSection } from "./settings/AppearanceSection";
import { GeneralSection } from "./settings/GeneralSection";
import { ExtensionPackSection } from "./settings/ExtensionPackSection";
import { UpdateSection } from "./settings/UpdateSection";
import { AboutSection } from "./settings/AboutSection";
import { HelpSection } from "./settings/HelpSection";

/**
 * 设置页面（SPEC 3.5 页面 5）
 *
 * 6 个分区：
 * 1. 外观：深浅模式 + 8 色主题色 + Mica 背景 - Phase 6a ✅
 * 2. 通用：侧边栏折叠 + 开机自启 + 关闭主窗口行为 + 重新初始化课表 + URL 别名 + 导入导出 - Phase 6a/6b ✅
 * 3. 扩展：安装/卸载/目录管理/侧边栏排序 - Beta3 阶段 c ✅
 * 4. 更新：自动更新 + 强制更新 + 渠道 - Phase 6b ✅
 * 5. 关于：基本信息 + 技术栈 + MIT 许可 + GitHub 链接 + 更新历史 - Phase 6b ✅
 * 6. 帮助：内置帮助页 - Phase 6b ✅
 *
 * 布局：左侧分区导航 + 右侧分区内容（Win11 设置风格）
 */

/** 分区标识 */
type SettingsSection =
  | "appearance"
  | "general"
  | "extensions"
  | "updates"
  | "about"
  | "help";

/** 分区列表（顺序即导航顺序） */
const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "general", label: "通用" },
  { key: "extensions", label: "扩展" },
  { key: "updates", label: "更新" },
  { key: "about", label: "关于" },
  { key: "help", label: "帮助" },
];

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("appearance");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      </div>

      <div className="flex flex-1 gap-6">
        {/* 左侧分区导航 */}
        <nav className="flex w-48 shrink-0 flex-col gap-1">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => setActive(section.key)}
              className={cn(
                "interactive flex items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium",
                active === section.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        {/* 右侧分区内容 */}
        <Card className="flex-1 overflow-y-auto p-6 scrollbar-fluent">
          {active === "appearance" && <AppearanceSection />}
          {active === "general" && <GeneralSection />}
          {active === "extensions" && <ExtensionPackSection />}
          {active === "updates" && <UpdateSection />}
          {active === "about" && <AboutSection />}
          {active === "help" && <HelpSection />}
        </Card>
      </div>
    </div>
  );
}
