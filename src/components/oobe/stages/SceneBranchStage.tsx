/**
 * OOBE 阶段：场景分流
 *
 * 学校模式：自动触发现有课表初始化向导（OnboardingWizard），完成后进入 tour
 * 日常模式：直接进入 tour（无需配置课表）
 *
 * 副作用由 useSceneBranchEffect hook 管理（在 OobeWizard 中调用）。
 * 本组件不渲染任何 UI（返回 null）——课表向导是 Radix Dialog z-50，
 * 若 OOBE 渲染全屏覆盖层 z-[100] 会盖住向导，因此此阶段 OOBE 退场让向导可见。
 */

export function SceneBranchStage() {
  return null;
}
