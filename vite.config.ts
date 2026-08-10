import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri 推荐配置：固定端口 1420，避免监听 src-tauri 目录变化
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // 显式绑定 127.0.0.1，与 tauri.conf.json 的 devUrl 保持一致
    // Vite 5 默认绑定 localhost，部分环境下 Tauri 等待 127.0.0.1 会超时
    host: host || "127.0.0.1",
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  optimizeDeps: {
    // 只扫描根 index.html，排除 docs/index.html 干扰
    entries: ["index.html"],
    // 预声明所有懒加载页面的依赖，避免首次访问时重新优化导致整页刷新
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "zustand",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "lucide-react",
      "react-markdown",
      "remark-gfm",
      "@xyflow/react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-slot",
      "@tauri-apps/api",
      "@tauri-apps/plugin-autostart",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      "@tauri-apps/plugin-notification",
      "@tauri-apps/plugin-opener",
      "@tauri-apps/plugin-shell",
      "@tauri-apps/plugin-store",
      "cron-parser",
    ],
  },
  build: {
    outDir: "dist",
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? ("esbuild" as const) : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
