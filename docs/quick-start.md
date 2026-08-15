<VersionBadge />

# 快速入门

5 分钟创建你的第一个 Exero 扩展。Exero 支持两种扩展形态：**动作包**（提供 Flow 积木）和**插件**（提供完整 UI 页面）。

::: tip 选择哪种形态？
- 只需要添加 Flow 编辑器积木 → **动作包**（更简单，Lua 即可）
- 需要侧边栏入口 + 完整功能页面 → **插件**（需要 Rust .dll）
:::

## 前置条件

| 工具 | 版本要求 | 用途 |
|---|---|---|
| Rust 工具链 | stable, edition 2021 | 编译 .dll（插件必需，动作包可选） |
| Node.js | LTS | 运行打包脚本 |
| 代码编辑器 | 任意 | 推荐 VS Code / TRAE IDE |

::: tip 编译目录建议（可选）
建议将环境变量 `CARGO_TARGET_DIR` 指向项目外的固定目录（如 `C:\cargo-target`）：多个插件共享编译缓存、不污染插件源码目录。不设置也能编译，产物默认在插件目录的 `target/` 下。
:::

## 创建第一个动作包（Lua）

最简单的扩展，无需 Rust，一个 Lua 脚本 + manifest 即可。

### 1. 创建项目结构

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

### 3. 编写 Lua 脚本

```lua
-- scripts/hello.lua
local name = args.name or "World"
exero.log("Hello, " .. name)
exero.notify("info", "Hello", "Hello, " .. name)
exero.set_result({ message = "Hello, " .. name })
```

### 4. 打包安装

将目录压缩为 `.exero-pack`（zip 格式），在 Exero 的「设置 → 扩展包」中导入安装。

```powershell
Compress-Archive -Path my-action-pack\* -DestinationPath my-action-pack.exero-pack -Force
```

安装后「Flow 编辑器」动作目录会出现 "Hello" 积木。

## 创建第一个插件（Rust）

插件提供侧边栏入口 + iframe UI 页面 + Rust 后端动作。

### 1. 创建项目结构

```
my-plugin/
├── Cargo.toml
├── src/
│   └── lib.rs
├── manifest.json
└── index.html
```

### 2. 编写 Cargo.toml

```toml
[package]
name = "my-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
exero-plugin-sdk = { path = "../../exero-plugin-sdk" }
serde_json = "1"
```

### 3. 编写 Rust 动作

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

declare_actions! {
    "say_hello" => say_hello,
}
```

### 4. 编写 manifest.json

```json
{
  "id": "my-plugin",
  "version": "0.1.0",
  "name": "My Plugin",
  "description": "我的第一个插件",
  "author": "Your Name",
  "exero_api_version": "0.4.0",
  "pack_type": "plugin",
  "rust_library": "my_plugin.dll",
  "sidebar": {
    "label": "My Plugin",
    "icon": "Puzzle",
    "page_type": "web"
  },
  "ui": { "entry": "index.html" },
  "actions": [
    {
      "id": "say_hello",
      "executor_type": "rust",
      "executor_id": "say_hello",
      "label": "Say Hello",
      "category": "lua",
      "icon": "Code",
      "default_params": {},
      "ports": {
        "inputs": [{ "id": "trigger", "position": "top" }],
        "outputs": [{ "id": "done", "position": "bottom" }]
      },
      "summarize_template": "Say Hello"
    }
  ]
}
```

### 5. 编写前端页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /></head>
<body>
  <h1>My Plugin</h1>
  <button id="btn">Call Rust</button>
  <div id="result">等待调用...</div>
  <script>
    document.getElementById('btn').addEventListener('click', async () => {
      try {
        const result = await window.exero.invoke('say_hello', {});
        document.getElementById('result').textContent = JSON.stringify(result);
      } catch (e) {
        document.getElementById('result').textContent = '错误: ' + e.message;
      }
    });
  </script>
</body>
</html>
```

### 6. 编译打包

```powershell
# 编译 .dll（可选：先设置 CARGO_TARGET_DIR 指向项目外的固定目录）
cd my-plugin
cargo build --release

# 复制产物到插件目录根（crate name 中的 - 自动转为 _）
Copy-Item target\release\my_plugin.dll .

# 打包（项目根目录执行）
cd ..
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

安装后侧边栏会出现 "My Plugin" 入口，点击进入插件页面。

::: tip 插件在后台持续运行
Beta9 起插件默认**持久运行**：切换到其他页面后插件（如正在播放的音乐）继续工作，可在「设置 → 插件」按插件开关此行为或手动停止。详见[插件开发指南](/guides/plugin#生命周期与持久运行)。
:::

## 下一步

- [动作包开发指南](/guides/action-pack) - 完整的 Lua/Rust 动作开发
- [插件开发指南](/guides/plugin) - 完整的插件 UI + 后端开发
- [API 参考](/api/manifest) - Manifest 字段、桥接 API、Lua API、SDK
- [内置动作类型](/api/action-types) - 20 种内置 ActionType 列表
- [构建与发布](/build-and-publish) - 打包脚本、市场发布流程
