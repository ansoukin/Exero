/**
 * Splash Screen 启动画面（Phase 6a · SPEC 3.4）
 *
 * 多窗口方案中的 splash 窗口内容：
 * - 居中显示 "Exero" 文字（无 Logo，未来正式版前再设计）
 * - 下方彩虹渐变进度条（indeterminate 动画）
 * - 后端 setup 完成后延迟 1.5 秒关闭 splash 显示 main
 */

export function Splash() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-background">
      {/* "Exero" 文字 */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-bold tracking-tight text-primary">
          Exero
        </h1>
        <p className="text-sm text-muted-foreground">个人自动化助手</p>
      </div>

      {/* 彩虹渐变进度条（indeterminate 动画） */}
      <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="rainbow-progress h-full w-1/2 rounded-full" />
      </div>
    </div>
  );
}
