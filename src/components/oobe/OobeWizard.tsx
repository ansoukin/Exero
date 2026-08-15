/**
 * OOBE（开箱体验）引导主组件（Beta6 · SPEC 13.x）
 *
 * 参考 Windows 10/11 OOBE 流程，全屏覆盖层 + 阶段路由。
 * 阶段流转由 useOobeStore 管理，持久化到 settings.onboarding_stage。
 *
 * scene_branch 阶段：学校模式触发现有 OnboardingWizard（课表向导），
 * 完成后自动进入 tour 阶段。
 */

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Square, X, Copy } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button } from "@/components/ui/button";
import { pageFadeVariants } from "@/components/ui/motion";
import { useOobeStore, type OobeStage } from "@/stores/oobe";
import { useOnboardingStore } from "@/stores/onboarding";
import { applyThemeMode } from "@/lib/theme";

import { SplashStage } from "./stages/SplashStage";
import { LicenseStage } from "./stages/LicenseStage";
import { ScenarioStage } from "./stages/ScenarioStage";
import { FontStage } from "./stages/FontStage";
import { PostRestartStage } from "./stages/PostRestartStage";
import { QuickSettingsStage } from "./stages/QuickSettingsStage";
import { PersonalizationStage } from "./stages/PersonalizationStage";
import { SceneBranchStage } from "./stages/SceneBranchStage";
import { TourStage } from "./stages/TourStage";
import { MarketStage } from "./stages/MarketStage";
import { DoneStage } from "./stages/DoneStage";

/** 阶段顺序（用于进度指示器） */
const STAGE_ORDER: OobeStage[] = [
  "splash",
  "license",
  "scenario",
  "font",
  "post_restart",
  "quick_settings",
  "personalization",
  "scene_branch",
  "tour",
  "market",
  "done",
];

export function OobeWizard() {
  const isActive = useOobeStore((s) => s.isActive);
  const stage = useOobeStore((s) => s.stage);

  // scene_branch 阶段副作用：学校模式触发课表向导
  useSceneBranchEffect();

  // OOBE 启动时强制切换到深色模式（致敬 Win11 OOBE 深色背景）
  // PersonalizationStage 用户选择模式时会覆盖；OOBE 完成后保持用户选择
  useEffect(() => {
    if (isActive) {
      applyThemeMode("dark");
    }
  }, [isActive]);

  if (!isActive) return null;

  // tour 阶段：不渲染全屏覆盖层，主界面可见供 driver.js 高亮
  if (stage === "tour") {
    return <TourStage />;
  }

  // scene_branch 阶段（学校模式）：不渲染全屏覆盖层，让课表向导可见
  // （OnboardingWizard 用 Radix Dialog z-50，会被 OOBE z-[100] 盖住）
  if (stage === "scene_branch") {
    return <SceneBranchStage />;
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* OOBE 顶部拖拽条 + 窗口控制按钮（复刻 TitleBar 布局，保留窗口拖拽能力） */}
      <OobeTopBar />
      {renderStage(stage)}
    </div>
  );
}

/**
 * OOBE 顶部条：左侧可拖拽区域 + 右侧 Windows 三按钮
 *
 * OOBE 全屏覆盖 z-[100] 会盖住主界面的 TitleBar（含 data-tauri-drag-region），
 * 因此在 OOBE 内部复刻顶部条，左侧 drag region 保留窗口拖拽能力。
 */
function OobeTopBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    const unlisten = appWindow.onResized(async () => {
      try {
        setMaximized(await appWindow.isMaximized());
      } catch {
        // 忽略查询失败
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div className="relative flex h-12 shrink-0 items-stretch">
      {/* 左侧可拖拽区域（占满除三按钮外的空间） */}
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center pl-4"
      >
        <span className="select-none text-xs font-medium text-muted-foreground">
          Exero
        </span>
      </div>
      {/* 右侧 Windows 三按钮 */}
      <div className="flex items-center">
        <button
          onClick={handleMinimize}
          title="最小化"
          className="flex h-12 w-12 items-center justify-center transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleToggleMaximize}
          title={maximized ? "还原" : "最大化"}
          className="flex h-12 w-12 items-center justify-center transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
        >
          {maximized ? (
            <Copy className="h-3.5 w-3.5 rotate-90" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={handleClose}
          title="关闭"
          className="flex h-12 w-12 items-center justify-center transition-colors duration-200 hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function renderStage(stage: OobeStage): ReactNode {
  switch (stage) {
    case "splash":
      return <SplashStage />;
    case "license":
      return <LicenseStage />;
    case "scenario":
      return <ScenarioStage />;
    case "font":
      return <FontStage />;
    case "post_restart":
      return <PostRestartStage />;
    case "quick_settings":
      return <QuickSettingsStage />;
    case "personalization":
      return <PersonalizationStage />;
    case "scene_branch":
      return <SceneBranchStage />;
    case "tour":
      return <TourStage />;
    case "market":
      return <MarketStage />;
    case "done":
      return <DoneStage />;
    default:
      return <SplashStage />;
  }
}

/** OOBE 共享布局：进度指示器 + 内容区 + 底部导航 */
export function OobeShell({
  stage,
  title,
  subtitle,
  children,
  canNext = true,
  nextLabel = "下一步",
  onNext,
  onBack,
  showProgress = true,
  hideNav = false,
}: {
  stage: OobeStage;
  title: string;
  subtitle?: string;
  children: ReactNode;
  canNext?: boolean;
  nextLabel?: string;
  onNext?: () => void;
  onBack?: () => void;
  showProgress?: boolean;
  hideNav?: boolean;
}) {
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);
  const currentIndex = STAGE_ORDER.indexOf(stage);

  const handleNext = onNext ?? next;
  const handleBack = onBack ?? (() => goTo(STAGE_ORDER[currentIndex - 1]));

  // 进度条阶段（排除 splash / done）
  const progressStages: OobeStage[] = STAGE_ORDER.filter(
    (s) => s !== "splash" && s !== "done"
  );
  // 当前阶段在 progressStages 中的索引（用于进度条宽度计算）
  // splash/done 阶段不显示进度条，设为 -1
  const progressIdx = stage === "splash" || stage === "done"
    ? -1
    : progressStages.indexOf(stage);
  const progressPercent = progressIdx >= 0
    ? (progressIdx / (progressStages.length - 1)) * 100
    : 0;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* 背景装饰：顶部柔和光效（Win11 OOBE 深色背景层次感） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[100px]" />
      </div>

      {/* 内容区（阶段切换动画 · Beta9 任务9：framer-motion 替代 CSS animate-page-fade-in） */}
      <motion.div
        key={stage}
        className="relative flex flex-1 flex-col overflow-y-auto scrollbar-fluent"
        variants={pageFadeVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col px-16 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
          <div className="mt-10">{children}</div>
        </div>
      </motion.div>

      {/* 底部：进度条 + 导航按钮（统一一行，参考 Win11 OOBE 底部布局） */}
      <div className="relative flex shrink-0 flex-col gap-4 px-16 pb-6">
        {/* 进度条（细线式，当前阶段位置高亮） */}
        {showProgress && (
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {progressIdx + 1} / {progressStages.length}
            </span>
          </div>
        )}

        {/* 导航按钮 */}
        {!hideNav && (
          <div className="flex items-center justify-between">
            <div>
              {onBack && currentIndex > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-1.5 rounded-lg px-5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一步
                </Button>
              )}
            </div>
            <Button
              onClick={handleNext}
              disabled={!canNext}
              className="gap-1.5 rounded-lg px-8"
            >
              {nextLabel}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * scene_branch 阶段副作用 hook
 *
 * 学校模式：自动触发现有课表向导，向导完成后进入 tour。
 * 日常模式：直接进入 tour。
 *
 * 竞态修复：用 courseWizardOpened 记录课表向导是否曾打开过，
 * 只有"曾打开过 && 现在已关闭"才进入 tour，避免 open() 异步未生效时
 * 第二个 effect 误判为已完成直接跳到 tour。
 */
export function useSceneBranchEffect() {
  const stage = useOobeStore((s) => s.stage);
  const appMode = useOobeStore((s) => s.appMode);
  const next = useOobeStore((s) => s.next);
  const onboardingIsOpen = useOnboardingStore((s) => s.isOpen);

  // 课表向导是否已触发（仅触发一次）
  const [courseWizardTriggered, setCourseWizardTriggered] = useState(false);
  // 课表向导是否曾打开过（用于区分"未打开"和"打开后已关闭"）
  const [courseWizardOpened, setCourseWizardOpened] = useState(false);

  // 1. 进入 scene_branch 时触发课表向导（学校模式）
  useEffect(() => {
    if (stage !== "scene_branch") return;
    if (appMode === "daily") {
      // 日常模式直接进入 tour
      next();
      return;
    }
    // 学校模式：首次进入时触发课表向导（仅触发一次）
    if (!courseWizardTriggered) {
      setCourseWizardTriggered(true);
      useOnboardingStore.getState().open(0);
    }
  }, [stage, appMode, courseWizardTriggered, next]);

  // 2. 跟踪课表向导打开状态（打开时标记 opened=true）
  useEffect(() => {
    if (onboardingIsOpen && !courseWizardOpened) {
      setCourseWizardOpened(true);
    }
  }, [onboardingIsOpen, courseWizardOpened]);

  // 3. 课表向导曾打开过且现在关闭 → 进入 tour
  useEffect(() => {
    if (
      stage === "scene_branch" &&
      appMode === "school" &&
      courseWizardOpened &&
      !onboardingIsOpen
    ) {
      next();
    }
  }, [stage, appMode, courseWizardOpened, onboardingIsOpen, next]);
}
