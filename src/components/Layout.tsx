import { useEffect } from "react";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NotificationToast } from "@/components/NotificationToast";
import { CloseBehaviorDialog } from "@/components/CloseBehaviorDialog";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useAppStore } from "@/stores/app";
import { useOnboardingStore } from "@/stores/onboarding";
import { onboardingCommands } from "@/lib/tauri";
import HomePage from "@/pages/Home";
import TimelinePage from "@/pages/Timeline";
import QuickActionsPage from "@/pages/QuickActions";
import PerformancePage from "@/pages/Performance";
import SettingsPage from "@/pages/Settings";

/**
 * 主窗口布局（SPEC 3.3）
 *
 * 结构：系统标题栏（decorations:true）+ 左侧可折叠侧边栏 + 右侧主内容区
 * 主内容区根据当前页面状态切换，支持纵向滚动 + fade-in 过渡动画。
 *
 * Phase 6a：
 * - 挂载课表向导，首次启动自动触发（SPEC 11.2 触发条件）
 * - 演示模式时主内容区顶部显示提示条（SPEC 11.2）
 *
 * 注意：恢复系统标题栏（decorations:true）以解决 Windows 10/11 下
 * decorations:false 的 DWM 黑边问题。Mica 背景需 decorations:false，
 * 在系统标题栏模式下不可用。
 */
export function Layout() {
  const currentPage = useAppStore((s) => s.currentPage);
  const openOnboarding = useOnboardingStore((s) => s.open);
  const setDemoMode = useOnboardingStore((s) => s.setDemoMode);
  const demoMode = useOnboardingStore((s) => s.demoMode);

  // 首次启动检测：onboarding_completed=false 且 has_semesters=false 时弹向导
  // 同时同步 demoMode 状态（SPEC 11.2 演示模式标识 / 退出按钮依赖）
  useEffect(() => {
    let cancelled = false;
    onboardingCommands
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        setDemoMode(status.demo_mode);
        if (!status.onboarding_completed && !status.has_semesters) {
          openOnboarding(0);
        }
      })
      .catch((e) => {
        console.error("[onboarding] 读取向导状态失败:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [openOnboarding, setDemoMode]);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage />;
      case "timeline":
        return <TimelinePage />;
      case "quick-actions":
        return <QuickActionsPage />;
      case "performance":
        return <PerformancePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 演示模式提示条（SPEC 11.2，仅 demoMode=true 时显示） */}
        {demoMode && (
          <div className="flex shrink-0 items-center gap-2 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <FlaskConical className="h-3 w-3" />
            演示模式 — 课表数据为示例数据
          </div>
        )}
        {/* 页面切换 fade-in 动画（SPEC 3.1：200ms 过渡，兼容 30Hz） */}
        <div
          key={currentPage}
          className="flex-1 animate-page-fade-in overflow-y-auto scrollbar-fluent"
        >
          {renderPage()}
        </div>
      </main>
      {/* 应用内通知 Toast（监听后端 notification:in-app 事件） */}
      <NotificationToast />
      {/* 关闭行为弹窗（监听 window:close-requested 事件，close_behavior=ask 时触发） */}
      <CloseBehaviorDialog />
      {/* 课表初始化向导（首次启动 / 空状态触发 / 设置页重新初始化） */}
      <OnboardingWizard />
    </div>
  );
}
