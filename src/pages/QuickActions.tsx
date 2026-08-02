import { useState } from "react";
import { Zap, List, History, Settings2, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import { FlowListTab } from "@/pages/quickactions/FlowListTab";
import { LogsTab } from "@/pages/quickactions/LogsTab";
import { AutomationSettingsTab } from "@/pages/quickactions/AutomationSettingsTab";
import { LuaMarketTab } from "@/pages/quickactions/LuaMarketTab";

/**
 * 快捷指令页面（SPEC 3.5 页面 3）
 *
 * 4 Tab 切换：
 * 1. 指令列表：卡片网格展示，点击卡片进入可视化编辑器
 * 2. 执行日志：全部/成功/失败筛选，显示最近执行记录
 * 3. 自动化设置：全局默认值
 * 4. Lua 脚本市场：直连 GitHub 仓库（Phase 5 实现，Phase 4 占位）
 *
 * 可视化编辑器作为独立子页面，从指令列表 Tab 点击卡片进入。
 */
type TabId = "list" | "logs" | "settings" | "lua";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "list", label: "指令列表", icon: List },
  { id: "logs", label: "执行日志", icon: History },
  { id: "settings", label: "自动化设置", icon: Settings2 },
  { id: "lua", label: "Lua 脚本市场", icon: Store },
];

export default function QuickActionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("list");

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* 顶部标题 */}
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">快捷指令</h1>
      </div>

      {/* Tab 切换栏 */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors duration-200",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "list" && <FlowListTab />}
        {activeTab === "logs" && <LogsTab />}
        {activeTab === "settings" && <AutomationSettingsTab />}
        {activeTab === "lua" && <LuaMarketTab />}
      </div>
    </div>
  );
}
