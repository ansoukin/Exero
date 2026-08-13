# 动作包开发指南

> Exero V0.4.0-Beta5 · 动作包（`pack_type: action`）开发文档

动作包是 Exero 扩展系统的基础形态，通过 `manifest.json` 声明一组动作，注册到 Flow 编辑器作为可视化积木。动作包支持两种执行器：**Rust**（调用内置高性能执行器）和 **Lua**（执行 LuaJIT 脚本）。

---

## 目录

- [快速入门](#快速入门)
- [Manifest 字段参考](#manifest-字段参考)
- [Lua 动作开发](#lua-动作开发)
- [Rust 动作开发](#rust-动作开发)
- [打包与发布](#打包与发布)
- [完整示例](#完整示例)

---

## 快速入门

5 分钟创建一个 Hello World 动作包。

### 1. 创建目录结构

```
my-action-pack/
├── manifest.json
└── scripts/
    └── hello.lua
```

### 2. 编写 manifest.json

```json
{
  "id": "my-action-pack",
  "version": "1.0.0",
  "name": "我的动作包",
  "description": "Hello World 示例动作包",
  "author": "Your Name",
  "exero_api_version": "0.4.0",
  "pack_type": "action",
  "actions": [
    {
      "id": "hello",
      "executor_type": "lua",
      "executor_id": "scripts/hello.lua",
      "label": "Hello",
      "category": "lua",
      "icon": "Code",
      "default_params": { "name": "World" },
      "ports": {
        "inputs": [{ "id": "trigger", "position": "top" }],
        "outputs": [{ "id": "done", "position": "bottom" }]
      },
      "summarize_template": "Hello {name}",
      "description": "向指定对象打招呼",
      "permissions": [],
      "params": [
        {
          "name": "name",
          "label": "称呼",
          "type": "string",
          "default": "World",
          "options": [],
          "required": false
        }
      ]
    }
  ]
}
```

### 3. 编写 Lua 脚本

```lua
-- scripts/hello.lua
local name = args.name or "World"
exero.log("Hello, " .. name)
exero.notify("info", "Hello", "Hello, " .. name)
exero.set_result({ message = "Hello, " .. name })
```

### 4. 打包安装

将目录压缩为 `.exero-pack`（zip 格式），在 Exero 的「设置 → 扩展包」中导入安装。安装后「Flow 编辑器」动作目录会出现 "Hello" 积木。

---

## Manifest 字段参考

### ExtensionPackManifest（根结构）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 扩展包唯一标识（建议小写 + 连字符，如 `my-pack`） |
| `version` | string | 是 | SemVer 版本号（如 `1.0.0`） |
| `name` | string | 是 | 显示名（中文） |
| `description` | string | 否 | 描述 |
| `author` | string | 否 | 作者 |
| `exero_api_version` | string | 是 | 所需 Exero API 版本（当前 `0.4.0`） |
| `pack_type` | string | 否 | 扩展包类型，动作包为 `action`（默认） |
| `rust_library` | string | 否 | Rust .dll 相对路径（仅 Rust 动作需要，见下文） |
| `actions` | ActionManifest[] | 否 | 动作声明列表 |
| `sidebar` | SidebarManifest | 否 | 侧边栏入口（**动作包不支持**，仅插件可用） |
| `ui` | UiManifest | 否 | 插件 UI 声明（**动作包不支持**，仅插件可用） |

### ActionManifest（动作声明）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 动作唯一标识（扩展包内唯一） |
| `executor_type` | string | 是 | 执行器类型：`rust` 或 `lua` |
| `executor_id` | string | 是 | Rust：对应 ActionType 枚举名（如 `LaunchProgram`）；Lua：脚本相对路径（如 `scripts/hello.lua`） |
| `label` | string | 是 | 动作显示名 |
| `category` | string | 是 | 类别：`app` / `media` / `system` / `notification` / `control` / `lua` |
| `icon` | string | 否 | lucide-react 图标名（默认 `Code`） |
| `default_params` | object | 否 | 创建节点时的初始参数 |
| `ports` | PortsManifest | 否 | 端口配置 |
| `summarize_template` | string | 否 | 参数摘要模板（如 `{path}`，前端解析为节点卡片摘要） |
| `description` | string | 否 | 动作描述 |
| `permissions` | string[] | 否 | Lua 沙箱权限声明（仅 Lua 动作） |
| `params` | ScriptParam[] | 否 | Lua 脚本参数定义（仅 Lua 动作，前端据此生成表单） |

### PortsManifest（端口配置）

```json
{
  "inputs": [{ "id": "trigger", "position": "top" }],
  "outputs": [{ "id": "done", "position": "bottom" }]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `inputs` | PortManifest[] | 输入端口列表 |
| `outputs` | PortManifest[] | 输出端口列表 |

### PortManifest（端口）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 端口唯一标识（React Flow handle id） |
| `position` | string | 是 | 位置：`top` / `bottom` / `left` / `right` |
| `label` | string | 否 | 显示名（用于 IfElse 的 then/else 标签） |

### ScriptParam（Lua 参数定义）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 参数名（Lua 通过 `args.xxx` 访问） |
| `label` | string | 是 | 显示标签 |
| `type` | string | 是 | 参数类型：`string` / `number` / `boolean` / `select` |
| `default` | any | 否 | 默认值 |
| `options` | string[] | 否 | `select` 类型的可选项 |
| `required` | boolean | 否 | 是否必填（默认 `false`） |

---

## Lua 动作开发

Lua 动作通过 LuaJIT 沙箱执行，提供 5 个核心 API。

### 核心 API

#### `exero.log(msg)`

写日志到 Exero 日志系统。

```lua
exero.log("开始执行任务")
```

#### `exero.notify(level, title, body)`

发送应用内通知。

- `level`：`"info"` / `"warning"` / `"error"`
- `title`：通知标题
- `body`：通知正文

```lua
exero.notify("info", "任务完成", "已处理 10 个文件")
```

#### `exero.get_var(name, global?)`

读取变量。默认读取局部变量（当前 Flow 执行上下文），`global=true` 读取全局变量（跨动作链共享）。

```lua
local count = exero.get_var("count")
local total = exero.get_var("total", true)
```

#### `exero.set_var(name, value, global?)`

设置变量。默认设置局部变量，`global=true` 设置全局变量。

```lua
exero.set_var("count", count + 1)
exero.set_var("total", 100, true)
```

#### `exero.set_result(value)`

设置脚本返回值，作为 ActionResult.output。

```lua
exero.set_result({ status = "ok", data = { 1, 2, 3 } })
```

### 参数访问

通过 `args` 表访问 manifest `params` 声明的参数：

```lua
local name = args.name       -- string 参数
local count = args.count     -- number 参数
local enabled = args.enabled -- boolean 参数
local mode = args.mode       -- select 参数
```

### 可用标准库

严格沙箱下可用：`string` / `table` / `math` / `os.date` / `os.time` / `os.clock`。

需要 `os.execute` / `io` 等宽松权限时，在 manifest `permissions` 中声明：

```json
{
  "permissions": ["io", "os.execute"]
}
```

### 完整 Lua 示例

```lua
-- scripts/counter.lua
-- 演示变量系统：跨动作链累加计数器
local increment = args.increment or 1
local reset = args.reset or false

if reset then
    exero.set_var("counter", 0, true)
    exero.log("计数器已重置")
else
    local current = exero.get_var("counter", true) or 0
    local new_value = current + increment
    exero.set_var("counter", new_value, true)
    exero.log("计数器: " .. new_value)
end

exero.set_result({ counter = exero.get_var("counter", true) })
```

---

## Rust 动作开发

Rust 动作分两种模式：

### 模式 1：内置 ActionType（无需 .dll）

如果动作对应 Exero 内置的 ActionType（如 `LaunchProgram` / `KillProcess` / `SetVolume` 等），直接在 manifest 声明，无需编写任何 Rust 代码：

```json
{
  "id": "launch-notepad",
  "executor_type": "rust",
  "executor_id": "LaunchProgram",
  "label": "启动记事本",
  "category": "app",
  "icon": "AppWindow",
  "default_params": { "path": "notepad.exe" },
  "ports": {
    "inputs": [{ "id": "trigger", "position": "top" }],
    "outputs": [{ "id": "done", "position": "bottom" }]
  },
  "summarize_template": "{path}"
}
```

**内置 ActionType 列表**（executor_id）：

| executor_id | 说明 | category |
|---|---|---|
| `LaunchProgram` | 启动程序 | app |
| `KillProcess` | 结束进程 | app |
| `SetVolume` | 设置系统音量 | media |
| `MuteVolume` | 静音/取消静音 | media |
| `Shutdown` | 关机 | system |
| `Restart` | 重启 | system |
| `Sleep` | 休眠 | system |
| `Lock` | 锁屏 | system |
| `Notify` | 系统通知 | notification |
| `Delay` | 延时 | control |

### 模式 2：自定义 .dll 动作（需要 exero-plugin-sdk）

如果需要自定义逻辑，编写 Rust .dll。详见 [插件开发指南](./plugin-guide.md)（动作包也可使用 .dll，但通常推荐用插件形态）。

动作包使用 .dll 时，manifest 需声明 `rust_library`：

```json
{
  "id": "my-action-pack",
  "pack_type": "action",
  "rust_library": "my_pack.dll",
  "actions": [
    {
      "id": "custom-action",
      "executor_type": "rust",
      "executor_id": "custom-action",
      "label": "自定义动作",
      "category": "lua",
      "icon": "Code",
      "default_params": {},
      "ports": {
        "inputs": [{ "id": "trigger", "position": "top" }],
        "outputs": [{ "id": "done", "position": "bottom" }]
      },
      "summarize_template": "Custom"
    }
  ]
}
```

---

## 打包与发布

### 打包

将扩展包目录压缩为 `.exero-pack`（zip 格式），要求 `manifest.json` 位于压缩包根目录。

```powershell
# PowerShell 打包示例
Compress-Archive -Path my-action-pack\* -DestinationPath my-action-pack.exero-pack -Force
```

### 发布到市场

1. 将 `.exero-pack` 文件放入仓库 `Market/action-packs/` 目录
2. 运行 `scripts/build-packs.ps1` 重新生成 `market-index.json`
3. 推送到 GitHub 仓库

```powershell
# 项目根目录执行
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1
```

### 安装方式

- **市场安装**：Exero 内「扩展市场」页面直接安装
- **本地导入**：「设置 → 扩展包」导入本地 `.exero-pack` 文件

---

## 完整示例

参考项目内置动作包：

- **Lua 动作包**：`scripts/lua-scripts-pack.json`（Hello World / 计数器 / 系统时间）
- **Rust 动作包**：`action-packs/` 目录下的内置动作包

### 目录结构示例

```
my-action-pack/
├── manifest.json
├── scripts/
│   ├── hello.lua
│   ├── counter.lua
│   └── system-info.lua
└── README.md（可选）
```

---

## 下一步

- 开发完整功能页面（含 UI + 侧边栏入口）：参阅 [插件开发指南](./plugin-guide.md)
- 了解 Exero 整体架构：参阅 [架构概览](./architecture.md)
