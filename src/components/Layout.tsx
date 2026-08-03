import { Sidebar } from "@/components/Sidebar";
import { NotificationToast } from "@/components/NotificationToast";
import { useAppStore } from "@/stores/app";
import HomePage from "@/pages/Home";
import TimelinePage from "@/pages/Timeline";
import QuickActionsPage from "@/pages/QuickActions";
import PerformancePage from "@/pages/Performance";
import SettingsPage from "@/pages/Settings";

/**
 * 主窗口布局（SPEC 3.3）
 *
 * 结构：左侧可折叠侧边栏 + 右侧主内容区
 * 主内容区根据当前页面状态切换，支持纵向滚动。
 */
export function Layout() {
  const currentPage = useAppStore((s) => s.currentPage);

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
        <div className="flex-1 overflow-y-auto scrollbar-fluent">
          {renderPage()}
        </div>
      </main>
      {/* 应用内通知 Toast（监听后端 notification:in-app 事件） */}
      <NotificationToast />
    </div>
  );
}
