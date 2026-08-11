<VersionBadge />

# 架构概览

本文档面向需要深入理解 Exero 内部机制的开发者和 AI 协作助手。读完本文档，你将理解 Exero 的整体架构、扩展系统设计、数据流和关键设计决策。

## 技术栈

| 层次 | 技术 | 说明 |
|---|---|---|
| 应用框架 | Tauri v2 | 跨平台桌面应用框架，Rust 后端 + WebView 前端 |
| 后端语言 | Rust (stable, edition 2021) | LTSC 版本，x64 |
| 前端框架 | React 18 + TypeScript | Vite 构建，shadcn/ui + Radix + Tailwind CSS |
| 可视化编辑器 | React Flow (@xyflow/react) | 拖拽连线式工作流编辑器 |
| 数据库 | SQLite (rusqlite + refinery) | WAL 模式，便携式存储 |
| Lua 引擎 | LuaJIT (mlua crate) | 严格沙箱，10 秒超时 |
| 动态库加载 | libloading + C ABI | 运行时加载 .dll，extern "C" 接口 |
| 状态管理 | Zustand | 轻量级状态管理 |
| 包管理器 | pnpm | corepack 管理 |

## 整体架构

```
┌─ Exero 主窗口 (React SPA) ──────────────────────────────────┐
│                                                              │
│  ┌─ Sidebar ──┐  ┌─ 主内容区 ──────────────────────────────┐ │
│  │ 首页        │  │                                          │ │
│  │ 时间轴      │  │  5 大页面：                              │ │
│  │ 快捷指令    │  │  1. Dashboard（系统状态+任务预览）        │ │
│  │ 性能优化    │  │  2. 时间轴（日/周/月/年四视图）           │ │
│  │ 设置        │  │  3. 快捷指令（Flow 编辑器+执行日志）     │ │
│  │ ─────────  │  │  4. 性能优化（硬件监控+进程管理）         │ │
│  │ 📌 插件入口 │  │  5. 设置（外观/通用/更新/关于/帮助）     │ │
│  └────────────┘  └──────────────────────────────────────────┘ │
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
│  ┌─ 插件 UI ───────────────────────────────────────────────┐ │
│  │  PluginPage → iframe (http://plugin.localhost/{id}/)    │ │
│  │  ├── 桥接脚本注入 (window.exero.invoke)                  │ │
│  │  └── postMessage ↔ execute_plugin_action → .dll          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Rust 后端 (Tauri Commands) ─────────────────────────────────┐
│  数据库层 (rusqlite + refinery)                              │
│  ├── 流程数据 5 表 (flows/actions/triggers/logs/settings)   │
│  └── 课程数据 5 表 (semesters/periods/templates/courses/...) │
│                                                              │
│  触发器调度器 (tokio)                                        │
│  ├── Cron 定时触发                                           │
│  ├── 系统事件触发 (开机/关机/USB/网络/进程)                  │
│  └── 手动触发 (首页/托盘)                                    │
│                                                              │
│  动作执行引擎                                                │
│  ├── 顺序执行 + 条件分支 + 循环 + 变量传递                   │
│  ├── 容错策略 (继续/停止/回滚/通知)                          │
│  └── 动作超时 (Lua 默认 10s)                                 │
└──────────────────────────────────────────────────────────────┘
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
| **适用场景** | 纯动作扩展 | 完整功能页面 |

### 动作执行流程

```
用户触发 (Cron/系统事件/手动)
  → Trigger 调度器
  → 加载 AutomationFlow
  → 按 actions 顺序执行
    → ActionExecutorRegistry 查找执行器
      ├── 内置 ActionType (LaunchProgram/SetVolume/Shutdown...)
      ├── Lua 执行器 (LuaJIT 沙箱执行 .lua)
      └── Rust 执行器 (libloading 调用 .dll 导出函数)
    → 返回 ActionResult (output + status)
    → 容错策略判断 (继续/停止/回滚/通知)
  → 写入 execution_logs
```

### 插件 UI 桥接流程

```
用户点击侧边栏插件入口
  → PluginPage 组件加载
  → iframe src="http://plugin.localhost/{pack_id}/index.html"
  → Tauri 自定义协议处理器
    → 验证插件已安装 (ExtensionPackRegistry)
    → 读取 HTML 文件
    → 在 </head> 前注入桥接脚本 (inject_bridge_script)
    → 返回 HTML
  → iframe 渲染插件页面

用户在插件页面调用 window.exero.invoke(actionId, params)
  → 桥接脚本 postMessage({ type: 'exero-invoke', id, actionId, params })
  → PluginPage 监听 message 事件
  → 调用 Tauri 命令 execute_plugin_action(pack_id, action_id, params)
  → RustLibraryRegistry::execute (C ABI 调用 .dll)
  → postMessage({ type: 'exero-result', id, result|error })
  → 桥接脚本 resolve Promise
```

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

## 数据库架构

### 流程数据（5 表）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `automation_flows` | 快捷指令 | id, name, icon, enabled |
| `actions` | 动作块 | id, flow_id, type, params, order, parent_id, fault_strategy |
| `triggers` | 触发器 | id, flow_id, type, params, enabled |
| `execution_logs` | 执行日志 | id, flow_id, action_id, status, started_at, finished_at, error |
| `settings` | 设置 | key, value, type |

### 课程数据（5 表，与流程数据解耦）

| 表 | 用途 |
|---|---|
| `semesters` | 学期定义 |
| `class_periods` | 节次时间表 |
| `weekly_templates` | 周课表模板（普通周/特殊周） |
| `courses` | 课程实体（归属周模板） |
| `schedule_overrides` | 临时调课记录（单次生效） |

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

网络后备：github.com → ghproxy 镜像 → 离线模式（仅已安装）

## 关键设计决策摘要

| 决策 | 原因 |
|---|---|
| C ABI 而非 Rust ABI | Rust 自身 ABI 不稳定，C ABI 保证兼容性 |
| iframe + postMessage | 天然隔离，插件崩溃不影响主程序 |
| 不允许 `allow-same-origin` | 防止插件访问 Exero 主窗口 DOM |
| LuaJIT 而非标准 Lua | 性能最优，对自动化脚本几乎无损耗 |
| market-index.json 索引 | 只下载 1 个文件而非逐个下载 zip，减少网络请求 |
| 三目录扫描 | builtin（内置）+ user（用户安装）+ custom（自定义路径） |
| courses 表同时存 period_index 和 time | 拖拽时两个字段互斥更新，兼顾课表定位和精确时间 |

更多设计决策详见 [SPEC 摘要](/spec-summary)。
