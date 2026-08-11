<VersionBadge />

# 动作包开发指南

动作包是 Exero 扩展系统的基础形态，通过 `manifest.json` 声明一组动作，注册到 Flow 编辑器作为可视化积木。支持两种执行器：**Rust**（调用内置 ActionType）和 **Lua**（执行 LuaJIT 脚本）。

::: tip 选择哪种执行器？
- 纯逻辑运算/脚本处理 → **Lua**（简单，无需编译）
- 需要操作系统级功能 → **Rust**（高性能，完整系统权限）
:::

## 目录结构

最小动作包只需 2 个文件：

```
my-action-pack/
├── manifest.json      # 声明文件（必填）
└── scripts/
    └── hello.lua      # Lua 脚本（Rust 执行器不需要）
```

## Manifest 编写

`manifest.json` 是扩展包的入口，声明元信息、动作列表、参数定义。

### 最小示例（Lua）

```json
{
  "id": "my-action-pack",
  "version": "1.0.0",
  "name": "我的动作包",
  "description": "Hello World 示例",
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
      "params": [
        {
          "name": "name",
          "label": "称呼",
          "type": "string",
          "default": "World",
          "required": false
        }
      ]
    }
  ]
}
```

完整字段说明请查阅 [Manifest 字段参考](/api/manifest)。

## Lua 动作开发

Lua 动作通过 LuaJIT 沙箱执行，默认提供 5 个核心 API，参数通过 `args` 表访问。

### 核心 API

| API | 签名 | 说明 |
|---|---|---|
| `exero.log` | `(msg: string) -> void` | 写入 Exero 日志系统 |
| `exero.notify` | `(level, title, body) -> void` | 发送应用内通知 |
| `exero.get_var` | `(name, global?) -> any` | 读取变量（局部/全局） |
| `exero.set_var` | `(name, value, global?) -> void` | 设置变量 |
| `exero.set_result` | `(value) -> void` | 设置返回值（作为 ActionResult.output） |

### 完整示例：计数器

```lua
-- scripts/counter.lua
-- 演示变量系统：跨动作链全局累加
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

### 沙箱权限

默认严格沙箱可用：`string` / `table` / `math` / `os.date` / `os.time` / `os.clock`。

需要 `os.execute` / `io` 等宽松权限时，在 manifest `permissions` 中声明：

```json
{ "permissions": ["io", "os.execute"] }
```

::: warning 超时保护
Lua 脚本默认 10 秒超时，超时后动作状态标为 `failed`。宽松权限不会延长超时。
:::

## Rust 动作开发（两种模式）

### 模式 1：引用内置 ActionType（无代码）

如果动作对应 Exero 内置的 ActionType，无需编写 Rust 代码，直接在 manifest 声明：

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

常用内置 ActionType 列表：

| executor_id | 说明 | category |
|---|---|---|
| `LaunchProgram` | 启动程序 | app |
| `KillProcess` | 结束进程 | app |
| `SetVolume` | 设置系统音量 | media |
| `MuteVolume` | 静音/取消静音 | media |
| `Shutdown` / `Restart` / `Sleep` / `Lock` | 系统操作 | system |
| `Notify` | 系统通知 | notification |
| `Delay` | 延时等待 | control |

完整 20 种 ActionType 列表请查阅 [内置动作类型](/api/action-types)。

### 模式 2：自定义 .dll 动作

需要自定义逻辑时使用 `exero-plugin-sdk` 编写 Rust .dll。详见 [Rust SDK 参考](/api/sdk)。

动作包使用 .dll 时，manifest 需声明 `rust_library`：

```json
{
  "id": "my-action-pack",
  "pack_type": "action",
  "rust_library": "my_pack.dll",
  "actions": [{
    "id": "custom-action",
    "executor_type": "rust",
    "executor_id": "custom-action",
    "..."
  }]
}
```

::: tip 建议
动作包 + 自定义 .dll 的组合功能上等价于"无 UI 插件"。如果未来计划添加 UI 页面，直接用 [插件形态](/guides/plugin) 更合适。
:::

## 打包与安装

### 打包

将目录压缩为 `.exero-pack`（zip 格式），`manifest.json` 必须位于压缩包根目录。

```powershell
Compress-Archive -Path my-action-pack\* -DestinationPath my-action-pack.exero-pack -Force
```

### 安装

- **市场安装**：Exero 内「扩展市场」页面安装
- **本地导入**：「设置 → 扩展包」导入本地 `.exero-pack`

发布到市场的流程请查阅 [构建与发布](/build-and-publish)。

## 下一步

- 扩展为完整功能页面 → [插件开发指南](/guides/plugin)
- Manifest 完整字段 → [Manifest 参考](/api/manifest)
- Lua 完整 API → [Lua API 参考](/api/lua-api)
