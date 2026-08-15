import { useState, useRef, useEffect, useCallback } from "react";
import { Zap, List, History, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { FlowListTab } from "@/pages/quickactions/FlowListTab";
import { LogsTab } from "@/pages/quickactions/LogsTab";
import { AutomationSettingsTab } from "@/pages/quickactions/AutomationSettingsTab";

/**
 * 快捷指令页面（SPEC 3.5 页面 3）
 *
 * 3 Tab 切换（Beta3：扩展市场独立为侧边栏主页面）：
 * 1. 指令列表：卡片网格展示，点击卡片进入可视化编辑器
 * 2. 执行日志：全部/成功/失败筛选，显示最近执行记录
 * 3. 自动化设置：全局默认值
 *
 * 横向 Tab 滚动切换（Beta3 优化 · 类手机无限翻页）：
 * - 鼠标悬停 Tab 栏 + 垂直滚轮 → 切换上一个/下一个 Tab
 * - 无限循环：最后一个 → 第一个，第一个 → 最后一个
 * - 节流 250ms，避免一次滚动跳过多个 Tab
 * - Tab 数量多溢出时容器可横向滚动查看（overflow-x-auto）
 */
type TabId = "list" | "logs" | "settings";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "list", label: "指令列表", icon: List },
  { id: "logs", label: "执行日志", icon: History },
  { id: "settings", label: "自动化设置", icon: Settings2 },
];

/** 滚轮切换节流间隔（毫秒） */
const WHEEL_THROTTLE_MS = 250;

export default function QuickActionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const tabBarRef = useRef<HTMLDivElement>(null);
  const lastWheelTimeRef = useRef(0);

  /** 切换到指定索引的 Tab（无限循环） */
  const switchToIndex = useCallback((index: number) => {
    const len = TABS.length;
    // 无限循环取模（支持负数：-1 → len-1）
    const safeIndex = ((index % len) + len) % len;
    setActiveTab(TABS[safeIndex].id);
  }, []);

  /** 鼠标滚轮 → 切换 Tab（无限循环，带节流） */
  useEffect(() => {
    const tabBar = tabBarRef.current;
    if (!tabBar) return;

    const handleWheel = (e: WheelEvent) => {
      // 仅响应垂直滚轮（触控板横向滑动交由容器原生横向滚动）
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTimeRef.current < WHEEL_THROTTLE_MS) return;
      lastWheelTimeRef.current = now;

      const currentIndex = TABS.findIndex((t) => t.id === activeTab);
      // deltaY > 0：下滚 → 下一个 Tab；deltaY < 0：上滚 → 上一个 Tab
      const nextIndex = e.deltaY > 0 ? currentIndex + 1 : currentIndex - 1;
      switchToIndex(nextIndex);
    };

    tabBar.addEventListener("wheel", handleWheel, { passive: false });
    return () => tabBar.removeEventListener("wheel", handleWheel);
  }, [activeTab, switchToIndex]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 density-aware">
      {/* 顶部标题 */}
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">快捷指令</h1>
      </div>

      {/* Tab 切换栏（滚轮切换 + 无限循环） */}
      <div
        ref={tabBarRef}
        className="flex items-center gap-1 overflow-x-auto border-b scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        title="鼠标悬停后滚动滚轮切换页面"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors duration-200",
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
      </div>
    </div>
  );
}
