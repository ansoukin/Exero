<VersionBadge />

# 调试与排错

本文档汇总扩展开发中最常见的问题及定位方法。遇到问题时按「日志 → 最小复现 → 隔离验证」三步排查。

## 日志位置与查看

### Exero 日志文件

| 系统 | 路径 |
|---|---|
| Windows | `%APPDATA%\Exero\logs\exero.log`（按日滚动） |

日志使用 `tracing_appender::rolling::daily` 切割，文件名 `exero.log`（当日）、`exero.2026-08-10.log`（历史）。

### 关键字过滤

打开日志后用 Ctrl+F 搜索以下前缀快速定位：

| 关键词 | 含义 |
|---|---|
| `[lua]` | Lua 脚本输出（`exero.log` 写入） |
| `extension_pack` | 扩展包加载 / 解析 / 注册相关 |
| `rust_library` | .dll 加载 / 卸载 / 执行相关 |
| `plugin` | 插件 UI 加载 / 桥接相关 |
| `market` | 扩展市场下载 / 安装 / 更新相关 |
| `exero_execute_action` | Rust .dll 动作执行调用点 |
| `action failed` | 动作执行失败（含错误信息） |

### 设置日志级别（可选）

开发期可临时在 `src-tauri/src/logging.rs` 中调整过滤器：
```rust
// 开发期改为 debug，看到更多扩展系统信息
.filter(LevelFilter::DEBUG)
```

---

## 动作包排错

### Manifest 解析失败

**症状**：导入扩展包后日志中 `Failed to parse manifest from ...`，动作面板无新增积木。

| 检查项 | 验证方法 |
|---|---|
| 是合法 JSON | 粘贴到 [jsonlint.com](https://jsonlint.com) 校验 |
| 无 BOM | VS Code 右下角显示"UTF-8"而非"UTF-8 with BOM" |
| 所有 `✅ 必填` 字段存在 | 对照 [Manifest 参考](/api/manifest) |
| `actions[].ports` 结构完整 | IfElse/Loop 需特殊端口配置，见 [IfElse 端口模板](/api/action-types.html#ifelse条件分支) |

---

### Lua 脚本报错

**症状**：Flow 执行时动作 status = `failed`，或变量读不到。

常见错误表：

| 错误 | 原因 | 解决 |
|---|---|---|
| `attempt to index nil value 'xxx'` | `args.xxx` 未定义（manifest 未声明或 default 没设） | 加兜底：`local x = args.x or "默认值"` |
| `attempt to call field 'log' (a nil value)` | `exero` 库没注入（脚本非通过 Exero 执行） | 只能在 Exero 执行环境测试 |
| Script timeout | 死循环或超过 10 秒 | 简化逻辑，拆成多个动作，大循环加 `exero.log` 观测 |
| Permission denied | `io.open` 报无权限，但 manifest 声明了 `permissions: ["io"]` | 检查是 actions[].permissions（不是根级），且 lua_sandbox_strict=true（默认） |

**调试 Lua 的推荐流程**：
1. 脚本开头先 `exero.log(serpent.block(args))` 打印参数（需本地实现 serpent dump 或手写）
2. 每步后 `exero.log("Step A done, count=" .. count)`
3. 失败时看 execution_logs 表的 error 字段（可通过执行日志面板查看）

---

## 插件排错

### Rust .dll 编译失败

| 错误 | 解决 |
|---|---|
| `error[E0463]: can't find crate for exero_plugin_sdk` | Cargo.toml `dependency.path` 算错了。从 Cargo.toml 所在目录相对算到 `exero-plugin-sdk\Cargo.toml` 的父目录 |
| `crate-type must be cdylib` | Cargo.toml 少了 `[lib] crate-type = ["cdylib"]` |
| `could not find native static library` | 编译产物目录被其他进程占用。关闭正在运行的 Exero（会锁定已加载 .dll）后重试 |

---

### .dll 加载失败

**症状**：日志 `Failed to load rust library ...`。

**定位步骤**：
1. 验证 `.dll` 是 x64：`dumpbin /headers my_plugin.dll | findstr "machine"` → `8664` (x64)。不是的话加 `--target x86_64-pc-windows-msvc`
2. 确认 Rust 工具链 MSVC ABI：`rustup show`，`stable-x86_64-pc-windows-msvc (default)`
3. 没有缺失依赖：Dependency Walker / `dumpbin /imports` 查看依赖（通常只是 kernel32 + msvcrt + vcruntime）
4. 关闭正在运行的 Exero 再试（同一进程同一 dll 只能加载 1 次，热更新需重启）
5. 确认 manifest `rust_library` 路径和文件名完全一致（`hello_plugin.dll` 不是 `hello-plugin.dll`）

---

### 插件页面空白 / 无法加载

**症状**：点击侧边栏插件页面显示一片空白，或报错"plugin.localhost 无法访问"。

| 检查项 | 定位方法 |
|---|---|
| 插件安装成功 | 「设置 → 扩展包」列表是否能看到 |
| pack_type = "plugin" | manifest 确认 |
| `ui.entry` 指向文件存在 | 解压 .exero-pack，找 entry 文件 |
| 入口 HTML 合法 | 拖到浏览器直接打开能否正常渲染 |
| iframe sandbox 限制 | 页面用到了跨 origin DOM 访问或 top 导航会被拦截；页面 HTML 中去掉对 `window.top` 的访问 |

**DevTools 调试插件 iframe**：

Windows 上可用 Microsoft Edge DevTools Preview 或 Tauri 自带 DevTools（F12 打开主窗口后，iframe 会在 Sources 下以 `http://plugin.localhost/...` 域列出）。

---

### 桥接 invoke 失败

**症状**：`window.exero.invoke(...)` catch 到错误。

常见错误：

| 错误信息 | 原因 | 解决 |
|---|---|---|
| `unknown action: xxx` | actionId 与 `declare_actions!` 键不一致（大小写敏感） | 严格匹配键名 |
| `缺少参数: xxx` | Rust 端 `params.get("xxx")?` 必填但前端没传 | 加 `get_optional` 或前端传参 |
| actionId 正确但仍 unknown | manifest `actions[].id` 没声明此动作，但 invoke 调用了 | 两种方案：在 manifest actions[] 中补声明；或改用 `execute_plugin_action` 直接走 pack_id + action_id 路由（不受 manifest 限制，但推荐始终声明） |
| .dll crash（错误信息缺内容） | Rust 动作 panic | 用 `std::panic::catch_unwind` 包裹 handler 或加日志到动作开头、结尾 |

**DevTools 观察 postMessage 通信**：
```javascript
// 在插件页面 console 临时运行
monitorEvents(window, 'message')
window.exero.invoke('my_action', { foo: 'bar' })
// Console 应看到 1 次 outgoing + 1 次 incoming message
```

---

## 插件运行排错

### 切换页面后插件停止运行（如音乐停了）

Beta9 起插件默认持久运行（keep-alive）。若切页后停止：

1. 「设置 → 插件」检查该插件的「退出页面后保持运行」开关是否被关闭
2. 是否点了「强制停止」——下次进入会重新加载（预期行为）
3. keep-alive 关闭属于用户选择，插件侧无法覆盖；需要连续工作的功能请引导用户开启该开关

### 插件页面状态丢失

keep-alive 关闭或强制停止会销毁 iframe。未及时写入宿主存储的数据会丢失——持久化请随时调用 `window.exero.storage.set()`，不要只在 `beforeunload` 里保存。

---

## 性能页排错

### GPU 卡片显示 "--" / "LHM 未就绪"

GPU 数据来自 LibreHardwareMonitor 子进程（`resources/monitor/ExeroMonitor.exe`，源码见仓库 `monitor/` 子项目）：

| 检查项 | 定位方法 |
|---|---|
| 子进程资源齐全 | 安装目录 `resources/monitor/` 下应有 ExeroMonitor.exe + LibreHardwareMonitorLib.dll 等依赖；缺失时从完整安装包重装 |
| .NET Framework 4.8+ | 系统需具备（Win10/11 默认已装） |
| 首次轮询 | 子进程刚启动时第一次读取可能为空，等几秒第二次轮询起正常 |
| 日志 | 搜索 `ExeroMonitor` / `sensors` 关键字 |

CPU/内存/存储数据来自 sysinfo（不依赖子进程），GPU 失败不影响这三项。

---

## 扩展市场排错

### 市场列表为空 / 加载失败

1. 网络不可用：浏览器访问 `https://github.com/ansoukin/Exero/blob/main/Market/market-index.json?raw=true` 看能否下载；GitHub 不通时 Exero 自动尝试 Gitee 备源（`gitee.com/ansoukin/Exero`）
2. market-index.json 含 UTF-8 BOM：`Format-Hex Market\market-index.json | Select-Object -First 1`，首字节是 `EF BB BF` 就是有 BOM → 用 `build-packs.ps1` 重新生成
3. 三级源（GitHub → Gitee → ghproxy）均失效：Exero 自动降级离线模式，可用已安装包

### 安装后版本没变

- 已安装的同 id 扩展包只有在新版本号（SemVer 比较）更高时才会被更新
- 开发测试本地安装时：先「卸载」再「导入」，避免版本号重复被忽略

---

## 数据库 / 执行日志排错

### 查看执行详情

数据库文件：`%APPDATA%\Exero\exero.db`（SQLite），用 DB Browser for SQLite 打开：

```sql
-- 最近 5 次 Flow 执行及其所有动作详情
SELECT f.name AS flow, e.status, e.started_at, e.finished_at,
       a.label AS action, a.type, el.status AS action_status, el.error
FROM execution_logs el
JOIN actions a ON a.id = el.action_id
JOIN automation_flows f ON f.id = el.flow_id
ORDER BY el.started_at DESC
LIMIT 50;
```

---

## 最小化问题复现

遇到 bug 推荐最小化：

1. **最小动作包**：1 manifest + 1 最简 Lua 脚本（只是 `exero.log("OK")`），排除代码影响
2. **最小插件**：只 `say_hello` 的 hello-plugin 派生版
3. **最小 Flow**：Flow 编辑器里只有 1 个测试节点 + 手动触发，排除其他节点干扰

缩小范围后，在群里提问或提 Issue 时附上最小化包 + 日志片段，90% 的问题能快速定位。
