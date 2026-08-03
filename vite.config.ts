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
  build: {
    outDir: "dist",
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? ("esbuild" as const) : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
