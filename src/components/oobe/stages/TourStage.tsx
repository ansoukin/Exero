/**
 * OOBE 阶段：功能介绍导览（driver.js 步骤式高亮）
 *
 * 致敬 Windows "获取更多应用"：导览结束后推荐安装扩展包。
 *
 * 本阶段不渲染全屏覆盖层（主界面可见），driver.js 接管高亮。
 * 每步高亮侧边栏导航按钮，同时切换到对应页面让用户预览。
 * 导览完成（或跳过）→ 进入 market 阶段
 *
 * 依赖：driver.js（用户手动 pnpm add）
 */

import { useEffect } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

import { useOobeStore } from "@/stores/oobe";
import { useAppStore } from "@/stores/app";

/** 导览步骤配置：5 个内置页面 */
const TOUR_PAGES: { nav: string; title: string; description: string }[] = [
  {
    nav: "home",
    title: "首页",
    description: "应用概览，查看今日课程安排与快捷操作入口",
  },
  {
    nav: "timeline",
    title: "时间轴",
    description: "日/周/月/年四视图课表管理，支持拖拽调课与临时调课",
  },
  {
    nav: "quick-actions",
    title: "快捷指令",
    description: "可视化编辑器编排自动化流程（动作链 + 触发器）",
  },
  {
    nav: "extensions",
    title: "扩展市场",
    description: "浏览并安装动作包与插件，扩展应用能力",
  },
  {
    nav: "performance",
    title: "性能优化",
    description: "硬件监控、进程管理、一键优化系统资源",
  },
  {
    nav: "settings",
    title: "设置",
    description: "应用配置、主题、导入导出、关于与帮助",
  },
];

export function TourStage() {
  const next = useOobeStore((s) => s.next);
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    const steps: DriveStep[] = TOUR_PAGES.map((p) => ({
      element: `[data-nav="${p.nav}"]`,
      popover: {
        title: p.title,
        description: p.description,
        side: "right" as const,
        align: "center" as const,
      },
    }));

    const driverObj: Driver = driver({
      showProgress: true,
      allowClose: false,
      nextBtnText: "下一步",
      prevBtnText: "上一步",
      doneBtnText: "完成导览",
      steps,
      onHighlightStarted: (element) => {
        const nav = element?.getAttribute("data-nav");
        if (nav) setPage(nav);
      },
      onDestroyed: () => next(),
    });

    // 先切换到首页再启动导览
    setPage("home");
    const timer = setTimeout(() => driverObj.drive(), 300);

    return () => {
      clearTimeout(timer);
      driverObj.destroy();
    };
  }, [next, setPage]);

  return null;
}
