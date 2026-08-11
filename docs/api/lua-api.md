<VersionBadge />

# Lua API

Lua 动作通过 LuaJIT 引擎在严格沙箱中执行，默认提供 5 个 `exero.*` 全局函数，参数通过 `args` 表访问。

::: tip 快速示例
```lua
local name = args.name or "World"
exero.log("Hello, " .. name)
exero.notify("info", "Greeting", "Hello, " .. name)
exero.set_result({ greeting = "Hello, " .. name })
```
:::

---

## 执行环境

| 项 | 值 | 说明 |
|---|---|---|
| 引擎 | LuaJIT（mlua crate） | JIT 编译，性能接近原生 |
| 默认沙箱 | 严格模式 | 禁用 io / require / os.execute 等危险 API |
| 超时 | 10 秒 | 超时后动作标为 `failed`，写 execution_logs |
| 字节码限制 | 无额外限制 | 受超时保护间接限制 |
| 全局变量隔离 | 每次执行新建 Lua 状态 | 不保留跨执行状态 |

---

## 核心 API

### `exero.log(msg)`

写入 Exero 日志系统（同时写入日志文件 `exero.log` 到 `%APPDATA%/Exero/logs/`）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `msg` | string | 日志内容 |

```lua
exero.log("开始处理任务")
exero.log(string.format("处理第 %d 条记录", i))
```

日志级别为 `INFO`，前缀 `[lua]`，可在日志系统中按前缀筛选。

---

### `exero.notify(level, title, body)`

发送 Exero 应用内通知（非 Windows Toast，显示在主窗口通知面板）。

| 参数 | 类型 | 必填 | 允许值 |
|---|---|---|---|
| `level` | string | ✅ | `"info"` / `"warning"` / `"error"` |
| `title` | string | ✅ | 通知标题 |
| `body` | string | ✅ | 通知正文 |

```lua
-- 成功通知
exero.notify("info", "任务完成", "已处理 " .. count .. " 个文件")

-- 错误通知
exero.notify("error", "任务失败", "网络连接超时")
```

::: tip 触发时间
通知立即发送（异步 emit），不等待脚本结束。
:::

---

### `exero.get_var(name, global?)`

读取变量。支持**局部变量**（当前 Flow 执行上下文）和**全局变量**（跨动作链共享）。

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `name` | string | — | 变量名 |
| `global` | boolean | `false` | `true` 读取全局变量，`false` 读取局部变量 |

**返回**：变量值（支持 string / number / boolean / table / nil）。未定义的变量返回 `nil`。

```lua
-- 读取局部变量（上一个动作 set_var 写入的值）
local input = exero.get_var("input_data")

-- 读取全局变量（跨 Flow 执行持久化到执行结束）
local total = exero.get_var("total_count", true)

-- 读取后判空
local count = exero.get_var("count") or 0
```

---

### `exero.set_var(name, value, global?)`

设置变量。默认写入局部变量。

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `name` | string | — | 变量名 |
| `value` | any | — | 变量值（支持 string / number / boolean / table） |
| `global` | boolean | `false` | `true` 写入全局共享池，`false` 写入局部 |

```lua
-- 写入局部变量：当前 Flow 后续动作可读取
exero.set_var("processed_data", { status = "ok", items = items })

-- 写入全局变量：同一 Flow 内所有动作可共享
exero.set_var("total_count", total, true)
```

::: warning 生命周期
局部变量和全局变量均在**单次 Flow 执行结束后丢弃**，不会持久化到数据库。
需要持久化请用动作包自有的数据库逻辑（Rust 动作）或外部文件（需 `io` 权限）。
:::

---

### `exero.set_result(value)`

设置脚本返回值，作为 `ActionResult.output` 供后续动作和执行日志使用。

| 参数 | 类型 | 说明 |
|---|---|---|
| `value` | any | 返回值（支持 Lua 所有可 JSON 序列化类型） |

```lua
-- 返回表（自动序列化为 JSON 对象）
exero.set_result({
  status = "success",
  count = #items,
  items = items
})

-- 返回标量
exero.set_result(42)
```

::: tip 重复调用
多次调用以**最后一次**为准。若未调用，`ActionResult.output` 为 `null`。
:::

---

## 参数访问（args 表）

脚本可通过全局表 `args` 访问 manifest `actions[].params[]` 定义的参数。

```lua
-- manifest: "params": [
--   { "name": "path", "label": "路径", "type": "string" },
--   { "name": "count", "label": "数量", "type": "number", "default": 10 },
--   { "name": "enabled", "label": "启用", "type": "boolean" }
-- ]

local path = args.path             -- string
local count = args.count or 10     -- number (default 兜底)
local enabled = args.enabled       -- boolean (nilable)
local mode = args.mode or "fast"   -- 未定义的参数名返回 nil
```

---

## 标准库可用性

### 严格沙箱（默认）

| 库/函数 | 状态 | 说明 |
|---|---|---|
| `string.*` | ✅ | 字符串处理全套 |
| `table.*` | ✅ | 表操作全套 |
| `math.*` | ✅ | 数学函数全套 |
| `os.date` / `os.time` / `os.clock` | ✅ | 日期、时间戳、CPU 耗时 |
| `os.execute` / `os.exit` / `io.*` | ❌ | 危险 API，移除 |
| `require` / `package` / `loadfile` / `dofile` | ❌ | 模块加载，移除 |
| `debug.*` | ❌ | 调试库，移除 |

### 宽松沙箱（声明 permissions）

在 manifest `actions[].permissions` 中声明需要的权限：

```json
{ "permissions": ["io", "os.execute"] }
```

| permission 值 | 启用的 API |
|---|---|
| `"io"` | `io.*` 全套（文件读写） |
| `"os.execute"` | `os.execute`（执行系统命令） |
| `"os.exit"` | `os.exit`（退出 Lua 状态） |
| `"os"` | `os.execute` + `os.exit` + 其他 `os.*` |

::: danger 安全风险
宽松沙箱权限允许访问本地文件和执行系统命令。
- 官方市场审核时会严格限制
- 用户安装时会显示权限警告
- 除非确有必要，保持默认严格沙箱
:::

---

## 常见用法示例

### 计数器（跨动作累加）

```lua
-- Step 1（Flow 第一个动作，初始化或累加）
local inc = args.increment or 1
local current = exero.get_var("counter", true) or 0
local new = current + inc
exero.set_var("counter", new, true)
exero.log("计数器: " .. new)
exero.set_result({ counter = new })
```

### 条件分支结果传递

```lua
-- 检查某个条件，结果供下一个 IfElse 动作读取
local data = exero.get_var("input_data") or {}
local valid = data.count ~= nil and data.count > 0
exero.set_var("is_valid", valid)
```

### 写入本地文件（需 io 权限）

```lua
-- permissions: ["io"]
local f = io.open("output.txt", "w")
if f then
    f:write("Hello, Exero!\n")
    f:write("时间: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
    f:close()
    exero.notify("info", "写入成功", "output.txt")
else
    exero.notify("error", "写入失败", "无法打开文件")
end
```

---

## 错误与调试

| 错误场景 | 处理方式 |
|---|---|
| Lua 语法错误 | `exero_last_error` 返回语法错误信息，动作 `failed` |
| 运行时错误（nil 索引等） | 错误信息写入日志，动作 `failed` |
| 10 秒超时 | VM 被中断，动作 `failed`，错误信息包含 "timeout" |
| 参数类型不匹配 | Rust 端在参数传递时做 nil 保护，类型不匹配自动降级为 nil |

调试技巧：
1. 大量使用 `exero.log()` 打点
2. 先在纯 Lua 环境验证脚本逻辑（或用 `lua` CLI 去掉 `exero.*` 调用后测试）
3. 脚本简单化：复杂逻辑拆分为多个动作，便于定位
