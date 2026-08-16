<VersionBadge />

# 架构概览

本文档面向需要深入理解 Exero 内部机制的开发者。读完本文档，你将理解 Exero 的整体架构、扩展系统设计、插件宿主层、数据流和关键设计决策。

## 技术栈

| 层次 | 技术 | 说明 |
|---|---|---|
| 应用框架 | Tauri v2 | 跨平台桌面应用框架，Rust 后端 + WebView2 前端 |
| 后端语言 | Rust (stable, edition 2021) | x64，MSVC 工具链 |
| 前端框架 | React 18 + TypeScript | Vite 构建，shadcn/ui + Radix + Tailwind CSS |
| 可视化编辑器 | React Flow (@xyflow/react) | 拖拽连线式工作流编辑器 |
| 动画 | framer-motion | 页面切换/微交互统一动画体系（Beta9 起替代手写 CSS keyframes） |
| 通知 | sonner | 应用内 Toast 通知 |
| 图表 | recharts | 性能页趋势折线、首页迷你图 |
| 数据库 | SQLite (rusqlite + refinery) | WAL 模式，便携式存储 |
| Lua 引擎 | LuaJIT (mlua crate) | 严格沙箱，10 秒超时 |
| 动态库加载 | libloading + C ABI | 运行时加载 .dll，extern "C" 接口 |
| 硬件传感器 | LibreHardwareMonitorLib 子进程 | GPU 使用率/温度/显存 + CPU 温度（ExeroMonitor.exe） |
| 状态管理 | Zustand | 轻量级状态管理 |
| 包管理器 | pnpm | corepack 管理 |

## 整体架构

```
┌─ Exero 主窗口 (React SPA) ──────────────────────────────────┐
│                                                              │
│  ┌─ Sidebar ──┐  ┌─ 主内容区 ──────────────────────────────┐ │
│  │ 首页        │  │  页面：                                 │ │
│  │ 时间轴      │  │  1. 首页（任务工作流+系统状态+最近记录）│ │
│  │ 快捷指令    │  │  2. 时间轴（日/周四视图，校园/日常模式）│ │
│  │ 扩展市场    │  │  3. 快捷指令（Flow 编辑器+执行日志）    │ │
│  │ 性能优化    │  │  4. 性能优化（四卡片+进程管理）         │ │
│  │ 设置        │  │  5. 设置（外观/通用/扩展/插件/更新/…） │ │
│  │ ─────────  │  │  6. 更新历史（二级页面）                │ │
│  │ 📌 插件入口 │  └────────────────────────────────────────┘ │
│  └────────────┘                                              │
│                                                              │
│  ┌─ 扩展系统 ──────────────────────────────────────────────┐ │
│  │  ActionExecutorRegistry (动作执行器注册表)               │ │
│  │  ├── 内置 20 种 ActionType                               │ │
│  │  ├── Lua 执行器 (LuaJIT 沙箱)                            │ │
│  │  └── Rust 执行器 (libloading .dll + C ABI)              │ │
│  │                                                          │ │
│  │  ExtensionPackRegistry (扩展包注册表)                    │ │
│  │  ├── builtin: <exe_dir>/data/action-packs/              │ │
│  │  ├── user: %APPDATA%/Exero/action-packs/                │ │
│  │  └── custom: settings extension_pack.user_dir           │ │
│  │                                                          │ │
│  │  RustLibraryRegistry (Rust .dll 注册表)                  │ │
│  │  └── LoadLibrary + exero_pack_init + exero_execute_action│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 插件宿主层 PluginHostLayer（Beta9 常驻） ──────────────┐ │
│  │  每个存活插件一个 iframe（plugin.localhost 协议）        │ │
│  │  ├── 活跃插件 absolute 覆盖主内容区                      │ │
│  │  ├── 非活跃插件 display:none 保活（音频/定时器继续）     │ │
│  │  ├── 桥接脚本注入 (window.exero.invoke/storage)          │ │
│  │  └── postMessage ↔ execute_plugin_action → .dll          │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Rust 后端 (Tauri Commands) ─────────────────────────────────┐
│  数据库层 (rusqlite + refinery)                              │
│  ├── 流程数据 5 表 (flows/actions/triggers/logs/settings)   │
│  └── 课程数据 5 表 (semesters/periods/templates/courses/...) │
│                                                              │
│  触发器调度器 (tokio)                                        │
│  ├── Cron 定时触发（时间触发积木生成）                       │
│  ├── 课表触发 CourseStart（课前N分钟/课中/课后）             │
│  ├── 系统事件触发 (开机/关机/USB/网络/进程)                  │
│  └── 手动触发 (首页/托盘)                                    │
│                                                              │
│  动作执行引擎                                                │
│  ├── 顺序执行 + 条件分支 + 循环 + 变量传递                   │
│  ├── 容错策略 (继续/停止/回滚/通知)                          │
│  └── 动作超时 (Lua 默认 10s)                                 │
│                                                              │
│  传感器子系统 sensors/（Beta9）                              │
│  ├── bridge.rs: ExeroMonitor.exe 子进程管理（stdin/stdout） │
│  └── reader.rs: GPU/CPU 温度 JSON 轮询读取                   │
│                                                              │
│  窗口效果                                                    │
│  ├── Effect::Acrylic 系统级 DWM 模糊（Win11 DWMSB/Win10 降级）│
│  └── DWMWCP_ROUND 物理圆角 + WebView2 透明背景               │
└────────────────────────────────────────────────────────────┘
```

## 扩展系统架构

### 两种扩展形态对比

| | 动作包 (Action Pack) | 插件 (Plugin) |
|---|---|---|
| **pack_type** | `"action"` | `"plugin"` |
| **后端语言** | Rust (.dll) 或 Lua (.lua) | 必须 Rust (.dll) |
| **UI 页面** | 无 | 有 (iframe) |
| **侧边栏入口** | 无 | 有（独占） |
| **Flow 积木** | 有 | 可选（附带动作） |
| **后台持久运行** | 无 | 有（默认开启，可配置） |
| **适用场景** | 纯动作扩展 | 完整功能页面 |

### 触发与执行流程

```
时间触发积木（重复规则/课表触发）→ 前端生成 Cron / CourseStart 配置
  → triggers 表（set_triggers）
  → Trigger 调度器（Cron 循环 / 课表 next_fire_time 计算）
  → 到点加载 AutomationFlow
  → 按 actions 顺序执行
    → ActionExecutorRegistry 查找执行器
      ├── 内置 ActionType (LaunchProgram/SetVolume/Shutdown...)
      ├── Lua 执行器 (LuaJIT 沙箱执行 .lua)
      └── Rust 执行器 (libloading 调用 .dll 导出函数)
    → 返回 ActionResult (output + status)
    → 容错策略判断 (继续/停止/回滚/通知)
  → 写入 execution_logs
```

时间触发积木（Beta9）在 Flow 编辑器中作为「控制流」分组的起点节点，前端提供重复规则选择器（每天/每周/每 N 天/指定日期）和课表触发配置（选课程 + 课前 N 分钟/课中/课后），由前端转换为 Cron 表达式或 CourseStart 参数传给后端——用户无需接触 Cron 语法。

### 插件宿主层与持久运行（Beta9）

插件 iframe 不再随页面切换卸载，而是由常驻宿主层 `PluginHostLayer` 管理（类似 Chrome 扩展的后台页）：

```
用户点击侧边栏插件入口
  → PluginActivator 挂载，向 pluginHost store 注册插件
  → PluginHostLayer 渲染该插件的 iframe（首次加载）
    → iframe src="http://plugin.localhost/{pack_id}/{entry}"
    → Tauri 自定义协议读取 HTML + 注入桥接脚本
  → 该 iframe absolute 覆盖主内容区展示

用户切换到其他页面
  → iframe 改为 display:none（不卸载、src 不变）
  → 音频播放 / 定时器 / 后台任务继续运行
  → 再次进入插件页时瞬时恢复（无重新加载）

用户离开插件页（keep_alive 开启，默认）
  → 插件继续存活，占用保持
用户离开插件页（keep_alive 关闭）
  → iframe 销毁，下次进入重新加载
```

keep_alive 按插件独立配置，持久化在 settings 表（键 `plugin.keep_alive.{pack_id}`）。用户可在「设置 → 插件」切换开关、清理插件缓存（宿主存储数据）或强制停止插件。

### 插件 UI 桥接流程

```
用户在插件页面调用 window.exero.invoke(actionId, params)
  → 桥接脚本 postMessage({ type: 'exero-invoke', id, actionId, params })
  → PluginHostLayer 监听 message 事件
  → 调用 Tauri 命令 execute_plugin_action(pack_id, action_id, params)
  → RustLibraryRegistry::execute (C ABI 调用 .dll)
  → postMessage({ type: 'exero-result', id, result|error })
  → 桥接脚本 resolve Promise
```

存储 API（`window.exero.storage.*`）同链路，落到 `%APPDATA%/Exero/plugin-data/{pack_id}.json`，按插件隔离。

### Rust .dll C ABI 接口

SDK 的 `declare_actions!` 宏自动生成 4 个导出函数：

| 函数 | 签名 | 说明 |
|---|---|---|
| `exero_pack_init` | `() -> i32` | 加载时调用，返回 0 表示成功 |
| `exero_pack_cleanup` | `() -> void` | 卸载时调用 |
| `exero_execute_action` | `(action_id, params_json) -> *const c_char` | 执行动作，返回 JSON 字符串 |
| `exero_last_error` | `() -> *const c_char` | 获取最近一次错误信息 |

::: warning 安全模型
.dll 加载无沙箱隔离，可完全访问系统（与 Lua 宽松沙箱同级风险）。用户自担风险安装第三方插件。.dll 必须编译为 `x86_64-pc-windows-msvc` 目标。
:::

## 窗口效果体系（Beta9）

主窗口视觉采用「系统级模糊 + CSS 质感层」分工：

| 层 | 实现 | 说明 |
|---|---|---|
| 模糊层 | Tauri `Effect::Acrylic`（Rust 侧 `set_effects`） | 系统级 DWM 模糊，模糊的就是桌面壁纸本身。Win11 22H2+ 走 DWMSB 系统 backdrop，Win10/旧 Win11 自动降级 ACCENT |
| 圆角 | DWMWCP_ROUND 物理圆角 + CSS clip-path 双保险 | DWM 沿窗口圆角裁剪系统亚克力；CSS 裁剪 WebView 内容 |
| 着色层 | CSS 半透明 `--alpha-*` 变量（`[data-acrylic="true"]`） | 背景 0.88 / 侧边栏 0.85 / 卡片 0.80 分层透明度 |
| 噪点/光影 | SVG feTurbulence 纹理 + inset box-shadow | 亚克力质感 |
| 开关 | settings `theme.acrylic_enabled` | 低性能机器可关闭，回退纯色背景 |

::: warning 为什么不用 CSS backdrop-filter 模糊壁纸
Chromium 的 backdrop image 只包含同一 WebView 渲染树内元素背后的内容。窗口全透明后元素"背后"是空的，`blur()` 模糊的是"空气"——物理上无法触及 DWM 合成器中的桌面壁纸。弹层（popover/dropdown）例外：其背后是渲染树内的实际页面内容，`backdrop-filter` 有效。
:::

外观定制（密度/字体/图标风格/LiquidGlass）通过 settings 表的 `theme.density`、`theme.font_family`、`theme.font_size`、`theme.icon_style`、`theme.liquid_glass` 等键持久化，由前端 `applyAppearance` 写入 html data 属性驱动 CSS。

## 传感器子系统（Beta9）

性能页 GPU 数据来自 LibreHardwareMonitorLib 子进程方案：

```
src-tauri/resources/monitor/          # 打包资源（.NET 子进程 + 依赖 DLL）
├── ExeroMonitor.exe                 # C# 子进程，调 LibreHardwareMonitorLib.dll
└── *.dll                             # LHM + .NET 依赖

src-tauri/src/sensors/
├── bridge.rs                         # 子进程 spawn/stdin/stdout JSON 通信管理
└── reader.rs                         # 读取 API（GPU 使用率/温度/显存、CPU 温度）
```

- 覆盖 NVIDIA / AMD / Intel GPU；子进程独立于主进程，崩溃不影响主程序
- 依赖 .NET Framework 4.8+（Win10/11 默认已装）
- 找不到子进程或读取失败时静默降级，性能页 GPU 卡片显示占位提示

## 数据库架构

### 流程数据（5 表）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `automation_flows` | 快捷指令 | id, name, icon, enabled |
| `actions` | 动作块 | id, flow_id, type, params, order, parent_id, fault_strategy |
| `triggers` | 触发器 | id, flow_id, type (Cron/CourseStart/...), params, enabled |
| `execution_logs` | 执行日志 | id, flow_id, action_id, status, started_at, finished_at, error |
| `settings` | 设置 | key, value, type |

### 课程数据（5 表，与流程数据解耦）

| 表 | 用途 |
|---|---|
| `semesters` | 学期定义 |
| `class_periods` | 节次时间表 |
| `weekly_templates` | 周课表模板（普通周/特殊周） |
| `courses` | 课程实体（归属周模板，含 week_pattern 单双周） |
| `schedule_overrides` | 临时调课记录（单次生效） |

课表触发（CourseStart）基于这 5 张表计算下一次触发时间：按星期 + 周次模式（all/odd/even/指定周）过滤课程，结合触发时机（Before 减 N 分钟 / During 开始时刻 / After 结束时刻）得出本地时间并转 UTC 调度。

## 扩展包加载策略

### 三目录扫描（优先级从高到低）

1. **builtin**：`<exe_dir>/data/action-packs/`（只读）
2. **user**：`%APPDATA%/Exero/action-packs/`（可写）
3. **custom**：settings `extension_pack.user_dir`（可选）

同名扩展包先加载的优先（builtin > user > custom）。

### 市场分发

```
Market/
├── market-index.json          # 元数据索引（list_market_packs 只下载此文件）
├── action-packs/              # 动作包 .exero-pack
└── plugins/                   # 插件 .exero-pack
```

网络后备（三级）：GitHub 直连 → Gitee 备源（GitHub Actions 自动同步）→ ghproxy 镜像 → 离线模式（仅已安装）。应用更新下载走同样的三级降级。

## 关键设计决策摘要

| 决策 | 原因 |
|---|---|
| C ABI 而非 Rust ABI | Rust 自身 ABI 不稳定，C ABI 保证兼容性 |
| iframe + postMessage | 天然隔离，插件崩溃不影响主程序 |
| 不允许 `allow-same-origin` | 防止插件访问 Exero 主窗口 DOM |
| 常驻 iframe 宿主层（Beta9） | 类 Chrome 扩展的持久运行：切页不卸载，音频/定时器继续 |
| 系统级 Acrylic 而非 CSS 模糊 | CSS backdrop-filter 物理上模糊不到桌面壁纸（渲染树限制） |
| LuaJIT 而非标准 Lua | 性能最优，对自动化脚本几乎无损耗 |
| market-index.json 索引 | 只下载 1 个文件而非逐个下载 zip，减少网络请求 |
| 三目录扫描 | builtin（内置）+ user（用户安装）+ custom（自定义路径） |
| courses 表同时存 period_index 和 time | 拖拽时两个字段互斥更新，兼顾课表定位和精确时间 |
| 前端生成 Cron 而非用户填写 | 时间触发积木用可视化选择器，杜绝用户手写错误表达式 |
| LHM 子进程而非集成 | .NET 库无法直接进 Rust，子进程隔离且崩溃可降级 |

> 完整的内部设计 SPEC 属于内部开发文档，不随文档发布。本套文档已涵盖开发者所需全部知识。
