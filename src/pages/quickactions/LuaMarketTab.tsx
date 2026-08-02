/**
 * Lua 脚本市场 Tab 占位（Phase 5 实现）
 *
 * SPEC 3.5 页面 3 第 4 Tab：
 * - 直连 GitHub 仓库浏览/安装/更新/卸载脚本
 * - Phase 4 仅占位，Phase 5 接入 mlua + GitHub 后实现
 */
export function LuaMarketTab() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p className="text-sm font-medium">Lua 脚本市场</p>
        <p className="mt-1 text-xs">Phase 5 实现（mlua 集成 + GitHub 仓库直连）</p>
      </div>
    </div>
  );
}
