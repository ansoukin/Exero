import { lazy, Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { NotificationToast } from "@/components/NotificationToast";
import { CloseBehaviorDialog } from "@/components/CloseBehaviorDialog";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { UpdateManager } from "@/components/UpdateManager";
import { useAppStore, isPackPage, extractPackId } from "@/stores/app";
import { useOnboardingStore } from "@/stores/onboarding";

// 页面懒加载（减少首屏 JS 解析/执行时间）
const HomePage = lazy(() => import("@/pages/Home"));
const TimelinePage = lazy(() => import("@/pages/Timeline"));
const QuickActionsPage = lazy(() => import("@/pages/QuickActions"));
const ExtensionsPage = lazy(() => import("@/pages/Extensions"));
const PerformancePage = lazy(() => import("@/pages/Performance"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
// 扩展包详情页（Beta3 动态侧边栏入口）
const ExtensionPackDetailPage = lazy(() =>
  import("@/pages/ExtensionPackDetail").then((m) => ({ default: m.ExtensionPackDetailPage }))
);

/**
 * 主窗口布局（SPEC 3.3）
 *
 * 结构：decorations:false 无原生边框 + 左侧可折叠侧边栏 + 右侧主内容区
 * 主内容区顶部为自定义 TitleBar（窗口拖拽 + Windows 三按钮），
 * 下方根据当前页面状态切换，支持纵向滚动 + fade-in 过渡动画。
 *
 * Beta3（SPEC 3.4 重做 + 扩展包架构）：
 * - decorations:false + 自定义 TitleBar（DWM 黑边已由单窗口 boot-splash 解决）
 * - onboarding 状态检测与 demoMode 同步已移至 main.tsx 的 bootstrap()
 * - 本组件仅从 store 读取 demoMode 决定是否显示演示模式提示条
 * - 课表向导由 main.tsx 检测后触发 open(0)，OnboardingWizard 组件监听 store
 * - 支持扩展包动态页面（pack:{id} 前缀），渲染 ExtensionPackDetail
 */
export function Layout() {
  const currentPage = useAppStore((s) => s.currentPage);
  const demoMode = useOnboardingStore((s) => s.demoMode);

  const renderPage = () => {
    // 扩展包详情页（pack:{id} 前缀）
    if (isPackPage(currentPage)) {
      const packId = extractPackId(currentPage);
      if (packId) {
        return <ExtensionPackDetailPage packId={packId} />;
      }
    }

    switch (currentPage) {
      case "home":
        return <HomePage />;
      case "timeline":
        return <TimelinePage />;
      case "quick-actions":
        return <QuickActionsPage />;
      case "extensions":
        return <ExtensionsPage />;
      case "performance":
        return <PerformancePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  /** 懒加载占位（与主内容区背景一致，避免白屏闪烁） */
  const pageFallback = (
    <div className="flex flex-1 items-center justify-center bg-background" />
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 自定义标题栏（decorations:false · 窗口拖拽 + Windows 三按钮） */}
        <TitleBar />
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
          <Suspense fallback={pageFallback}>{renderPage()}</Suspense>
        </div>
      </main>
      {/* 应用内通知 Toast（监听后端 notification:in-app 事件） */}
      <NotificationToast />
      {/* 关闭行为弹窗（监听 window:close-requested 事件，close_behavior=ask 时触发） */}
      <CloseBehaviorDialog />
      {/* 课表初始化向导（首次启动 / 空状态触发 / 设置页重新初始化） */}
      <OnboardingWizard />
      {/* 更新管理器（启动检查 + 强制更新阻断 + 推荐更新弹窗） */}
      <UpdateManager />
    </div>
  );
}
