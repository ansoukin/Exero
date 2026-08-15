import { useState } from "react";
import {
  Settings as SettingsIcon,
  Palette,
  SlidersHorizontal,
  Puzzle,
  Plug,
  RefreshCw,
  Info,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AppearanceSection } from "./settings/AppearanceSection";
import { GeneralSection } from "./settings/GeneralSection";
import { ExtensionPackSection } from "./settings/ExtensionPackSection";
import { PluginsSection } from "./settings/PluginsSection";
import { UpdateSection } from "./settings/UpdateSection";
import { AboutSection } from "./settings/AboutSection";
import { HelpSection } from "./settings/HelpSection";

/**
 * 设置页面（SPEC 3.5 页面 5）
 *
 * 6 个分区：
 * 1. 外观：深浅模式 + 8 色主题色 + Acrylic 亚克力背景 - Phase 6a ✅
 * 2. 通用：侧边栏折叠 + 开机自启 + 关闭主窗口行为 + 重新初始化课表 + URL 别名 + 导入导出 - Phase 6a/6b ✅
 * 3. 扩展：安装/卸载/目录管理/侧边栏排序 - Beta3 阶段 c ✅
 * 4. 更新：自动更新 + 强制更新 + 渠道 - Phase 6b ✅
 * 5. 关于：基本信息 + 技术栈 + MIT 许可 + GitHub 链接 + 更新历史 - Phase 6b ✅
 * 6. 帮助：内置帮助页 - Phase 6b ✅
 *
 * Beta9 · 任务6：导航项添加 lucide 图标，选中态左侧 3px primary 竖条 + bg-primary/10 + primary 文字色。
 *
 * 布局：左侧分区导航 + 右侧分区内容（Win11 设置风格）
 */

/** 分区标识 */
type SettingsSection =
  | "appearance"
  | "general"
  | "extensions"
  | "plugins"
  | "updates"
  | "about"
  | "help";

/** 分区列表（顺序即导航顺序，含图标） */
const SECTIONS: { key: SettingsSection; label: string; icon: LucideIcon }[] = [
  { key: "appearance", label: "外观", icon: Palette },
  { key: "general", label: "通用", icon: SlidersHorizontal },
  { key: "extensions", label: "扩展", icon: Puzzle },
  // Beta9 任务6：插件分区（持久运行/缓存清理/权限展示，仅 pack_type=plugin）
  { key: "plugins", label: "插件", icon: Plug },
  { key: "updates", label: "更新", icon: RefreshCw },
  { key: "about", label: "关于", icon: Info },
  { key: "help", label: "帮助", icon: HelpCircle },
];

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("appearance");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 density-aware">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      </div>

      <div className="flex flex-1 gap-6">
        {/* 左侧分区导航（Beta9 任务6：图标 + 选中竖条高亮） */}
        <nav className="flex w-48 shrink-0 flex-col gap-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = active === section.key;
            return (
              <button
                key={section.key}
                onClick={() => setActive(section.key)}
                className={cn(
                  "interactive relative flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {/* 选中态左侧 3px primary 竖条 */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 右侧分区内容 */}
        <Card className="flex-1 overflow-y-auto p-6 scrollbar-fluent">
          {active === "appearance" && <AppearanceSection />}
          {active === "general" && <GeneralSection />}
          {active === "extensions" && <ExtensionPackSection />}
          {active === "plugins" && <PluginsSection />}
          {active === "updates" && <UpdateSection />}
          {active === "about" && <AboutSection />}
          {active === "help" && <HelpSection />}
        </Card>
      </div>
    </div>
  );
}
