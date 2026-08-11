<VersionBadge />

# SPEC 关键决策摘要

> 面向 AI 协作助手和资深开发者的 **5 分钟速读版 SPEC**。读完本文档即可掌握核心设计决策，无需每次通读 1700+ 行 SPEC.md。缺细节再去 SPEC.md 对应章节查阅。

---

## 1. 项目定位与目标

| 项 | 决策 |
|---|---|
| 项目原名 | Dominate（后更名 Exero） |
| 当前版本 | V0.4.0-Beta6（最后一个 Beta，下一个 Stable） |
| 目标用户 | Windows 桌面用户（学生 / 上班族 / 高级用户） |
| 核心理念 | 时间轴双模式（校园/日常）+ 快捷指令 Flow 编辑器 + 扩展市场 |
| 技术选型理由 | Tauri v2 低内存（< 50MB）/ Rust 安全高性能 / React 生态丰富 |

---

## 2. 应用架构

### 2.1 五大页面

| 页面 | 功能 |
|---|---|
| Dashboard 首页 | 系统状态概览 + 即将到来的日程 + 快捷手动触发入口 |
| 时间轴 | 日 / 周 / 月 / 年 四视图；**校园模式**（课表驱动）和**日常模式**（事件驱动）一键切换 |
| 快捷指令 | Flow 编辑器（React Flow）+ 执行日志面板 + 触发器配置 |
| 性能优化 | 硬件监控（CPU/RAM/DISK/TEMP）+ 进程管理 + 电源计划切换 |
| 设置 | 外观 / 通用 / 扩展包 / 更新 / 关于 / 帮助 6 个子页 |

### 2.2 前后端通信

- **Tauri Commands**（非 HTTP）：前端 `invoke('xxx_cmd', payload)` → Rust `#[tauri::command]`
- **事件**：Rust `app_handle.emit()` → 前端 `listen()`（通知、执行进度、系统事件）
- **协议**：`plugin` 自定义协议（`http://plugin.localhost/`）服务插件前端资源

---

## 3. 数据库

| 项 | 决策 |
|---|---|
| 数据库 | SQLite（rusqlite + refinery 迁移工具） |
| 模式 | WAL（Write-Ahead Logging），提升并发读写 |
| 文件路径 | `%APPDATA%\Exero\exero.db` |
| 编码 | UTF-8 |

### 3.1 10 张核心表

**流程数据（5 张）**：
1. `automation_flows` - 快捷指令元数据
2. `actions` - Flow 动作块（params JSON / React Flow position / fault_strategy）
3. `triggers` - 触发器（Cron / 系统事件 / 手动）
4. `execution_logs` - 每次动作执行记录（含 error 字段）
5. `settings` - 设置 KV 表（key/value/type）

**课程数据（5 张，Beta4 解耦）**：
1. `semesters` - 学期定义
2. `class_periods` - 节次时间表（节次号+开始时间+结束时间）
3. `weekly_templates` - 周课表模板（普通周 / 特殊周）
4. `courses` - 课程实体（归属周模板，字段含 period_index 和 time 互斥）
5. `schedule_overrides` - 临时调课记录（单次生效）

> **courses 双字段设计**：`period_index`（课表节次号）和 `time`（精确时间戳）同时存储，拖拽改时间时两个字段互斥更新（改 period_index → 重新算 time，改 time → period_index 置 null）。

---

## 4. Flow 执行引擎

### 4.1 执行模型

```
触发（Cron/系统事件/手动）
  → 加载 Flow + actions 排序（BFS 生成拓扑序列）
  → 顺序执行每一个动作
    → 取 action.params（JSON）+ 填入变量
    → ActionExecutorRegistry::lookup 找执行器
    → 执行 → ActionResult(output, status)
    → 若 failed，按 fault_strategy 处理（Continue/Stop/Rollback/Notify）
  → 写 execution_logs
```

### 4.2 21 种 ActionType（6 大类 + 扩展）

完整列表：[内置动作类型参考](/api/action-types)

| 类别 | 动作数 | 典型 |
|---|---|---|
| 应用与文件 | 4 | LaunchProgram / KillProcess / OpenUrl / OpenFile |
| 媒体与输入 | 3 | SetVolume / PlaySound / SimulateKey |
| 系统与电源 | 7 | Shutdown / Reboot / LockScreen / Hibernate / Logoff / CleanTempFiles / SwitchPowerPlan |
| 通知 | 2 | ShowToast / ShowInAppNotification |
| 控制流 | 3 | IfElse（2 out）/ Loop（2 out + 2 in 迭代回环）/ SetVariable |
| 脚本 | 2 | LuaScript（用户内联）/ Extension(String)（框架内部） |

### 4.3 容错策略（FaultStrategy）

动作失败后的 4 种处理方式：
- `Continue`（默认）：跳过，继续
- `Stop`：整个 Flow 中止
- `Rollback`：对已启动的副作用动作反向执行（如已启动的程序关闭）
- `Notify`：发应用内通知给用户决定

---

## 5. 扩展系统（核心！Beta5 重设计）

### 5.1 两种形态

| | 动作包 `pack_type: action` | 插件 `pack_type: plugin` |
|---|---|---|
| 侧边栏入口 | ❌ | ✅（sidebar 独占） |
| iframe UI | ❌ | ✅（ui.entry） |
| Flow 积木 | ✅（actions[]） | ✅（可选附带） |
| Rust .dll | 可选（自定义动作） | 必选（rust_library 强制） |
| Lua 脚本 | ✅ | ✅（actions[] 支持 lua executor_type） |

### 5.2 三目录扫描（优先级 builtin > user > custom）

1. `builtin` = `<exe_dir>/data/action-packs/`（只读）
2. `user` = `%APPDATA%/Exero/action-packs/`（用户安装）
3. `custom` = settings `extension_pack.user_dir`（可选自定义路径）

### 5.3 Rust .dll 接口（C ABI）

SDK 用 `declare_actions!` 宏自动生成 4 个导出函数：
- `exero_pack_init() -> i32`（返回 0 = 成功）
- `exero_pack_cleanup()`
- `exero_execute_action(action_id, params_json) -> *const c_char`（NULL = 出错）
- `exero_last_error() -> *const c_char`

完整细节：[Rust SDK 参考](/api/sdk)

### 5.4 Lua 沙箱

- 引擎：LuaJIT（mlua crate）
- 默认严格沙箱：移除 io/require/package/os.execute
- 宽松沙箱：manifest `actions[].permissions[]` 声明启用
- 超时：10 秒硬编码（Beta6）
- 5 个核心 API：`exero.log/notify/get_var/set_var/set_result`（通过 `args` 表访问参数）

### 5.5 插件 UI 桥接（postMessage）

```
iframe window.exero.invoke(id, params)
  → postMessage({type:'exero-invoke', id, actionId, params})
  → PluginPage 收到
  → invoke('execute_plugin_action', packId, actionId, params)
  → RustLibraryRegistry::execute
  → postMessage({type:'exero-result', id, result|error})
  → Promise resolve/reject
```

**iframe sandbox**：`allow-scripts allow-forms allow-popups allow-modals`（**无** `allow-same-origin`、**无** `allow-top-navigation`）

---

## 6. 触发器系统

### 6.1 三类 TriggerType

| 类别 | 触发器 |
|---|---|
| 时间类 | Cron（5 字段 cron 表达式）、CourseStart（课前N分钟 / 课中 / 课后N分钟） |
| 系统事件 | SystemBoot / Shutdown / UserLogin / LockScreen / UsbPlug / Unplug / NetworkChange / ProcessStart / Stop |
| 手动类 | Manual（首页按钮 + 托盘菜单 + 快捷键） |

### 6.2 调度

- tokio runtime 常驻
- Cron：cron crate 解析表达式 + tokio::time::sleep 循环
- 系统事件：WMI 订阅 + Win32 钩子（Beta6 已有部分实现）

---

## 7. 扩展市场

| 项 | 决策 |
|---|---|
| 分发机制 | GitHub raw（`ansoukin/Exero` main 分支） |
| 索引文件 | `Market/market-index.json`（**无 BOM UTF-8**）— 只下载 1 个文件展示列表 |
| 动作包目录 | `Market/action-packs/*.exero-pack` |
| 插件目录 | `Market/plugins/*.exero-pack` |
| 网络后备 | github.com → ghproxy 镜像 → 离线 |
| 安装方法 | 市场安装 / 本地导入（设置 → 扩展包） |

完整流程：[构建与发布](/build-and-publish)

---

## 8. 性能 / 内存 / 启动目标

| 指标 | Beta6 目标 | 现状（Beta6 release build） |
|---|---|---|
| 安装包大小 | < 30 MB | 约 22 MB |
| 启动时间 | < 3 s | 约 1.8 s |
| 空闲内存 | < 100 MB | 约 50~70 MB |
| 扩展包 50+ 启动影响 | < 200 ms | 基准测试通过 |

---

## 9. AI 协作开发规则（SPEC §9.6 重点）

这是 AI 助手必须遵守的核心规则，原文引用：

1. **不懂就问**：宁可多问不要假设
2. **AI 只能修改明确涉及的模块**：不要"顺便"改无关代码
3. **每次改动必须测试**：不测试不提交
4. **核心架构改动必须文档更新同步**：SPEC + API 文档 + 版本徽章
5. **硬约束必须遵守**：CARGO_TARGET_DIR / cargo 手动执行 / 不轻易 pnpm add / git push 手动
6. **版本号管理**：Beta 阶段大改升 Beta，小改不升；Stable 阶段 SemVer 严格

---

## 10. 文档导航建议

第一次读本文档后，针对不同任务的推荐下一步：

| 你要做的事 | 下一步阅读 |
|---|---|
| 写一个动作包 | [动作包开发指南](/guides/action-pack) → [Lua API](/api/lua-api) |
| 写一个插件 | [插件开发指南](/guides/plugin) → [Rust SDK](/api/sdk) → [桥接 API](/api/bridge-api) |
| 引用内置动作 | [内置动作类型参考](/api/action-types) |
| 发布到市场 | [构建与发布](/build-and-publish) |
| 遇到问题 | [调试与排错](/troubleshooting) → [FAQ](/faq) |
| 改 Exero 核心代码 | 先读 [架构概览](/architecture) → 再读 SPEC.md 对应章节 |
