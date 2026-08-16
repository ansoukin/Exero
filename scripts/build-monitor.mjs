/**
 * monitor 传感器子项目构建脚本（B9 第三阶段收尾）
 *
 * 把 ExeroMonitor（C# + LibreHardwareMonitorLib）挂进 Tauri 构建链：
 * 1. dotnet build monitor/ExeroMonitor.csproj -c Release（增量编译，二次起 <1s）
 * 2. 复制产物到 src-tauri/resources/monitor/（排除 .pdb 调试符号）
 *
 * 由 package.json 的 build:monitor 调用，tauri.conf.json 的
 * beforeBuildCommand / beforeDevCommand 串联执行——
 * 源码更新后 pnpm tauri build/dev 自动重编，产物永不落旧版。
 *
 * 前置要求：本机安装 .NET SDK（dotnet 8.x 可编译 net48 目标）。
 * NuGet 依赖（LHM 0.9.6 等）首次自动还原，产物二进制不入库（.gitignore）。
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const csproj = path.join(root, "monitor", "ExeroMonitor.csproj");
const binDir = path.join(root, "monitor", "bin", "Release", "net48");
const outDir = path.join(root, "src-tauri", "resources", "monitor");

// 1. 增量编译（dotnet 自身按时间戳跳过未改动文件）
console.log("[monitor] dotnet build ExeroMonitor (Release)...");
execSync(`dotnet build "${csproj}" -c Release`, { stdio: "inherit" });

if (!fs.existsSync(binDir)) {
  console.error(`[monitor] 构建产物目录不存在: ${binDir}`);
  process.exit(1);
}

// 2. 复制产物（排除 .pdb）
fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const file of fs.readdirSync(binDir)) {
  if (file.endsWith(".pdb")) continue;
  fs.copyFileSync(path.join(binDir, file), path.join(outDir, file));
  count++;
}
console.log(`[monitor] 已复制 ${count} 个文件到 src-tauri/resources/monitor/`);
