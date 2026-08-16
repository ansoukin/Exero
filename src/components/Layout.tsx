import { lazy, Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { NotificationToast } from "@/components/NotificationToast";
import { CloseBehaviorDialog } from "@/components/CloseBehaviorDialog";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { OobeWizard } from "@/components/oobe/OobeWizard";
import { UpdateManager } from "@/components/UpdateManager";
import { StartupSplash } from "@/components/StartupSplash";
import { PluginHostLayer } from "@/components/PluginHostLayer";
import { AnimatedPage } from "@/components/ui/AnimatedPage";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore, isPackPage, extractPackId } from "@/stores/app";
import { useOnboardingStore } from "@/stores/onboarding";
import { useThemeStore } from "@/stores/theme";

// 页面懒加载（减少首屏 JS 解析/执行时间）
const HomePage = lazy(() => import("@/pages/Home"));
const TimelinePage = lazy(() => import("@/pages/Timeline"));
const QuickActionsPage = lazy(() => import("@/pages/QuickActions"));
const ExtensionsPage = lazy(() => import("@/pages/Extensions"));
const PerformancePage = lazy(() => import("@/pages/Performance"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
// 更新历史二级页面（Beta9 · 任务8，从关于页跳转）
const ChangelogPage = lazy(() => import("@/pages/ChangelogPage"));
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
  // Beta9 任务17：亚克力适配，根 div 设置 data-acrylic 触发全局半透明着色
  // （模糊由 Rust 侧 Effect::Acrylic 系统级提供，CSS 只叠着色/噪点/光影）
  const acrylicEnabled = useThemeStore((s) => s.config.acrylic_enabled);
  // B9 第三阶段任务2：窗口圆角
  // - Win11：恒 8px（DWM 物理圆角，Windows 特性）
  // - Win10：由用户开关控制（与亚克力互斥，store 层保证不同时开）
  const isWindows11 = useThemeStore((s) => s.isWindows11);
  const windowRounded = useThemeStore((s) => s.appearance.windowRounded);
  const cornerRadius = isWindows11 === false && !windowRounded ? 0 : 8;

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
      case "changelog":
        return <ChangelogPage />;
      default:
        return <HomePage />;
    }
  };

  /** 懒加载占位（透明，让亚克力透出，避免白屏闪烁） */
  const pageFallback = (
    <div className="flex flex-1 items-center justify-center" />
  );

  return (
    <div
      data-acrylic={acrylicEnabled ? "true" : "false"}
      className="flex h-screen w-screen overflow-hidden"
      // B9 第三阶段任务2：圆角由平台 + 用户开关驱动
      // - Win11 恒 8px（DWMWCP_ROUND 物理圆角在系统层裁剪，CSS 双保险）
      // - Win10 开关开 8px / 关 0px（纯 CSS clip-path 圆角，是唯一圆角来源）
      style={{
        borderRadius: cornerRadius,
        clipPath: `inset(0 round ${cornerRadius}px)`,
      }}
    >
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden surface-bg">
        {/* 自定义标题栏（decorations:false · 窗口拖拽 + Windows 三按钮） */}
        <TitleBar />
        {/* 演示模式提示条（SPEC 11.2，仅 demoMode=true 时显示） */}
        {demoMode && (
          <div className="flex shrink-0 items-center gap-2 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <FlaskConical className="h-3 w-3" />
            演示模式 — 课表数据为示例数据
          </div>
        )}
        {/* 主内容区（relative 供插件宿主层 absolute 覆盖） */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* 页面切换动画（Beta9 任务9：framer-motion 替代 CSS animate-page-fade-in） */}
          <AnimatedPage
            pageKey={currentPage}
            className="absolute inset-0 overflow-y-auto scrollbar-fluent"
          >
            <Suspense fallback={pageFallback}>{renderPage()}</Suspense>
          </AnimatedPage>
          {/* 插件宿主层（Beta9 任务6：常驻 iframe，切页保活，活跃插件覆盖主内容区） */}
          <PluginHostLayer />
        </div>
      </main>
      {/* 应用内通知 Toast（Beta9 任务11：监听后端 notification:in-app 事件转发给 sonner） */}
      <NotificationToast />
      {/* sonner Toaster 容器（渲染 toast UI） */}
      <Toaster />
      {/* 关闭行为弹窗（监听 window:close-requested 事件，close_behavior=ask 时触发） */}
      <CloseBehaviorDialog />
      {/* 课表初始化向导（首次启动 / 空状态触发 / 设置页重新初始化） */}
      <OnboardingWizard />
      {/* OOBE 开箱体验引导（Beta6 · 包裹课表向导的全流程引导） */}
      <OobeWizard />
      {/* 老用户启动闪屏（Beta9 · 任务2，新用户由 OOBE 接管） */}
      <StartupSplash />
      {/* 更新管理器（启动检查 + 强制更新阻断 + 推荐更新弹窗） */}
      <UpdateManager />
    </div>
  );
}
