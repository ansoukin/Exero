import { create } from "zustand";

/**
 * 课表初始化向导全局状态（Phase 6a · SPEC 11.2）
 *
 * 跨组件触发入口：
 * - 首次启动自动触发（Layout mount 检测 onboarding_status）
 * - 设置页"重新初始化课表"（reset_schedule_data 后调用 open）
 * - 时间轴空状态"创建学期"（open，跳过欢迎页从步骤 1 开始）
 *
 * startStep：
 * - 0 = 欢迎页（首次启动 / 正常入口）
 * - 1 = 跳过欢迎页（从空状态"创建学期"或重置后重新触发）
 *
 * demoMode（SPEC 11.2 演示模式）：
 * - 由 Layout mount 时从 get_onboarding_status 同步
 * - 主内容区顶部显示"演示模式"提示条
 * - GeneralSection 显示"退出演示模式"按钮
 */
interface OnboardingState {
  /** 向导是否打开 */
  isOpen: boolean;
  /** 起始步骤（0=欢迎页，1=跳过欢迎页直接学期配置） */
  startStep: 0 | 1;
  /** 是否演示模式（settings.demo_mode） */
  demoMode: boolean;

  /** 打开向导 */
  open: (startStep?: 0 | 1) => void;
  /** 关闭向导 */
  close: () => void;
  /** 设置演示模式状态 */
  setDemoMode: (demo: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOpen: false,
  startStep: 0,
  demoMode: false,

  open: (startStep = 0) => set({ isOpen: true, startStep }),
  close: () => set({ isOpen: false }),
  setDemoMode: (demo) => set({ demoMode: demo }),
}));
