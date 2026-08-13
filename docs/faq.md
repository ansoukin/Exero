<VersionBadge />

# 常见问题 FAQ

## 扩展包选择

### 动作包还是插件？

| 需求 | 推荐形态 |
|---|---|
| 只需要 Flow 编辑器里的可视化积木 | 动作包（`pack_type: action`） |
| 需要侧边栏入口 + 独立功能页面 | 插件（`pack_type: plugin`） |
| 先积木，以后可能加 UI | 先用动作包，后续改为插件（manifest 改 pack_type + 补 sidebar/ui/rust_library） |

### Lua 还是 Rust？

| 场景 | 推荐执行器 |
|---|---|
| 字符串处理、循环、逻辑判断、轻量计算 | Lua |
| 调用 Win32 API / 文件系统 / 网络 / 高性能计算 | Rust（自定义 .dll） |
| 调内置系统功能（关机/音量/进程/通知） | 内置 ActionType（Rust，零代码） |

---

## 环境配置

### CARGO_TARGET_DIR 为什么要设？

Tauri 增量构建清理时会删除旧的 target 目录，删除的文件会进回收站。target 目录动辄几十 GB，回收站会爆。设置 `CARGO_TARGET_DIR=C:\cargo-target-dominate` 把目标目录放到受控位置（在沙箱外，清理时永久删除不进回收站）。

::: danger 所有终端会话都要设
这是环境变量，不是配置文件。每个新 PowerShell 窗口打开后要**重新设一次**。推荐加到 PowerShell profile：
```powershell
# $PROFILE 里加一行：
$env:CARGO_TARGET_DIR="C:\cargo-target-dominate"
```
:::

### 为什么 cargo 必须手动跑？

TRAE IDE 的 RunCommand 在 sandbox 中执行，sandbox 清理时会触发 cargo target 中的文件删除（导致回收站爆）。因此 cargo 命令一律在 **TRAE IDE 终端（非 sandbox）** 手动执行。

---

## Manifest 编写

### pack_type: "plugin" 能不能只作为 UI 不声明 actions？

可以。`actions[]` 不是插件必填（`sidebar` + `ui` 才是）。纯信息展示/配置面板类插件可以没有动作。

### 同一个扩展包可以同时有 Lua 和 Rust 动作吗？

可以。`actions[]` 里每个动作独立声明 `executor_type`：

```json
"actions": [
  { "id": "lua-a", "executor_type": "lua",  "executor_id": "scripts/a.lua" },
  { "id": "rust-b", "executor_type": "rust", "executor_id": "rust_action_in_dll" }
]
```

注意：要 Rust 动作的话 manifest 根必须声明 `rust_library: "xxx.dll"`。

### 怎么给图标？需要打包图片吗？

不需要。图标字段 `icon` 是 **lucide-react 图标名**（纯字符串），Exero 前端内置此图标库。图标名大小写敏感。常用名：`Code` `AppWindow` `Volume2` `Puzzle` `Calculator` `Clock` `Globe`。

完整列表：[lucide.dev/icons](https://lucide.dev/icons)

---

## Lua 开发

### 能不能 require 其他 lua 文件？

默认沙箱禁用了 `require` + `package` + `dofile` + `loadfile`。方案：
1. 多个脚本写多个动作，通过 Flow 编排
2. 全局变量传值（`exero.set_var("data", data, true)`）
3. 放宽 `package` 权限（不推荐，官方市场大概率拒绝）

### Lua 变量的生命周期？

- **局部变量**（`exero.set_var("x", 1)`）：单次 Flow 执行期间，从第一个动作到最后一个动作
- **全局变量**（`exero.set_var("x", 1, true)`）：同上，但所有动作可读可写
- **执行结束**：全部丢弃，不落盘

需要持久化请：
- 通过 Rust .dll 写外部数据库/文件
- 或在 Flow 开头 SetVariable 初始化 + 结尾 IfElse → 写文件动作

### exero.set_result 返回值怎么在下一个动作读到？

通过**控制流的变量传递机制**（非 `exero.get_var`）：
- 在 React Flow 里：上一个动作节点 `output[done]` → 下一个动作节点 `input[trigger]` 连线
- Rust 执行引擎在执行下一个动作前，把上一个结果写入局部变量空间
- 下一个 Lua 动作可通过 `args` 特殊字段 `__prev_result`（如声明了映射）读取

最稳妥方案：上一个动作结束时 `exero.set_var("xxx", result)`，下一个动作开头 `local r = exero.get_var("xxx")`。

---

## 插件 UI

### 插件页面能用 Vue/React 构建吗？

可以。iframe 中可以放任意前端构建产物。只要：
1. 最终产物是纯静态文件（HTML/CSS/JS）
2. entry HTML 中不要假设可以访问主窗口的 DOM/Storage

推荐 Vite + React/Vue 构建后 `dist/` 内容全部进插件目录。

### 插件 CSS 能沿用 shadcn/ui 吗？

主窗口和插件 iframe 完全隔离（无 `allow-same-origin`），插件 CSS 需要自己带。可以把 shadcn/ui 打包产物放进插件的 `assets/` 目录，然后 HTML `<link rel="stylesheet" href="assets/shadcn.css">`。

### invoke 调用有超时限制吗？

前端 Promise 端没有超时（硬上限 = Rust 端没做超时）。但：
- 长耗时动作会卡住主窗口 UI（PluginPage 是同步 await）
- 推荐**长耗时拆异步**：Rust 端启动任务后立即返回 job_id，UI 轮询 `window.exero.invoke('get_status', {job_id})` 拿进度

---

## 市场分发

### market-index.json 能手动编辑吗？

能，但**必须存为无 BOM UTF-8**。Rust serde_json 不能解析带 BOM 的 JSON。

推荐：始终运行 `build-packs.ps1` 自动生成。手动编辑后用此命令检查：
```powershell
$bytes = [System.IO.File]::ReadAllBytes("$PWD\Market\market-index.json")
$bom = @(0xEF, 0xBB, 0xBF)
($bytes[0..2] -join ',') -eq ($bom -join ',')  # $false = 正确，$true = 有 BOM
```

### 我是第三方开发者，想发布到官方市场？

当前官方市场 = GitHub 仓库 ansoukin/Exero 的 `Market/` 目录。提交 PR 把 `.exero-pack` 加到对应目录并更新 index，CR 后合入即可。

未来（Beta7+）计划支持第三方市场源（多个 index.json URL 配置）。

---

## 版本兼容性

### 升级 Exero 后旧扩展包用不了？

检查：
1. 扩展包 `exero_api_version` 在新版本兼容区间内（Beta7 兼容所有 `0.4.x`）
2. Manifest 结构没变（Beta5 重构过一次扩展机制，`pack_type` 字段有变化）
3. 插件重新编译 .dll（Beta7 Rust MSRV 没升，但 linker 改动可能导致旧 dll 加载失败）

### 如何知道当前文档适用哪个 Exero 版本？

本套文档每页顶部都有 `适用版本：V0.4.0-Beta7` 徽章。前后端每次 Beta 变更时需同步更新徽章版本号和对应文档内容。

---

## 性能

### Lua 动作 10 秒超时能调吗？

Beta7 不支持（硬编码 `10_000` ms）。需要更长执行时间请写 Rust 动作。

### 插件 .dll 越大加载越慢？

是的。libloading `Library::new()` 加载后需做一次 C ABI 符号查找（4 个导出函数）。
- 经验：< 10MB 的 dll 加载 < 50ms
- 建议：不要把不需要的 crate（如 tokio runtime、clap、tracing）编进去

### 扩展包装多了启动会慢吗？

启动时扫描三目录（builtin/user/custom）+ 解析 manifest + .dll 加载。
- 50 个扩展包以内：< 200ms
- 50+ .dll 插件：每多 1 个 dll 约加 10~50ms，建议控制数量

---

## 安全

### .dll 插件是安全的吗？

.dll 加载**无沙箱**，可完全访问系统（与 Lua 宽松沙箱同级风险）。用户安装第三方插件时 Exero 会显示风险提示。官方市场的插件由 maintainer review 后合入。

### 插件能读取 Exero 的数据库吗？

间接可以（.dll 端自己开 rusqlite 连接读 SQLite 文件路径）。但 Beta7 不提供"官方数据库访问 API"——这是有意为之的隔离边界。如果确实需要：
- 读：自己找 `%APPDATA%\Exero\exero.db`
- 写：不推荐，可能写坏主程序状态。用 invoke 返回给主程序，主程序再写入

---

## 内部文档说明

Exero 的完整设计 SPEC（含各阶段评审记录）属于**内部开发文档**，不随这套面向开发者的 VitePress 文档发布，仅在 GitHub 仓库中保留历史备份。开发者无需阅读 SPEC，本套文档已涵盖全部开发所需知识。

