/**
 * 扩展市场页面（Beta3 · 侧边栏独立主页面）
 *
 * 从快捷指令页 Tab 独立为侧边栏主页面，位于「快捷指令」下方。
 * 直连 GitHub 仓库 ansoukin/Exero 的 action-packs/ 目录，
 * 浏览 / 安装 / 更新 / 卸载 .exero-pack 扩展包。
 *
 * 网络策略：github.com 主 -> ghproxy 镜像后备 -> 离线模式（仅已安装）。
 */

import { Store } from "lucide-react";

import { ExtensionMarketTab } from "@/pages/quickactions/ExtensionMarketTab";

/**
 * 扩展市场主页面
 *
 * 复用 ExtensionMarketTab 组件（原快捷指令页 Tab），外层包裹页面标题。
 * ExtensionMarketTab 内部已实现完整的列表/安装/更新/卸载逻辑。
 */
export default function ExtensionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6 density-aware">
      {/* 顶部标题 */}
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">扩展市场</h1>
      </div>

      {/* 市场列表（复用 Tab 组件） */}
      <div className="flex-1 overflow-hidden">
        <ExtensionMarketTab />
      </div>
    </div>
  );
}
