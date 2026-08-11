<VersionBadge />

# 插件开发指南

插件是 Exero 扩展系统的高级形态，提供 **iframe UI 页面 + 侧边栏入口 + Rust .dll 动作** 三件套。插件通过 Tauri 自定义协议加载前端资源，通过 postMessage 桥接 API 与主程序通信。

::: tip 插件 vs 动作包
- 只需 Flow 积木 → [动作包](/guides/action-pack)
- 需要侧边栏入口 + 完整功能页面 → 插件（本文档）
:::

## 目录结构

```
my-plugin/
├── Cargo.toml          # Rust crate 配置
├── src/
│   └── lib.rs          # Rust 动作实现（.dll）
├── manifest.json       # 插件 manifest
├── index.html          # 插件前端入口
└── assets/             # 可选：CSS/JS/图片资源
```

## Rust .dll 开发

### 1. Cargo.toml

```toml
[package]
name = "my-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]   # 编译为 Windows .dll

[dependencies]
exero-plugin-sdk = { path = "../../src-tauri/crates/exero-plugin-sdk" }
serde_json = "1"
```

::: warning 路径注意
`exero-plugin-sdk` 相对路径取决于你的插件目录位置。官方示例 `examples/hello-plugin` 用 `../../src-tauri/crates/exero-plugin-sdk`。
:::

### 2. 编写动作

`Params` 提供类型安全的 JSON 参数访问，`declare_actions!` 宏自动生成 C ABI 导出函数。

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

fn add(params: Params) -> Result<serde_json::Value, String> {
    let a: i64 = params.get("a")?;      // 必填参数，缺失返回 Err
    let b: i64 = params.get("b")?;
    Ok(json!({ "sum": a + b }))
}

declare_actions! {
    "say_hello" => say_hello,
    "add" => add,
}
```

宏自动生成 4 个 C ABI 导出函数，无需手动编写：

| 导出函数 | 说明 |
|---|---|
| `exero_pack_init` | 加载时调用，返回 0 = 成功 |
| `exero_pack_cleanup` | 卸载时调用 |
| `exero_execute_action` | 执行动作，返回 JSON 字符串 |
| `exero_last_error` | 获取最近一次错误 |

详细 SDK 用法请查阅 [Rust SDK 参考](/api/sdk)。

### 3. 编译

::: danger CARGO_TARGET_DIR
编译前必须设置环境变量，防止 cargo 增量清理污染回收站：
:::

```powershell
$env:CARGO_TARGET_DIR="C:\cargo-target-dominate"
cargo build --release
```

产物：`C:\cargo-target-dominate\release\my_plugin.dll`（crate name 中的 `-` 自动转为 `_`）。

## Manifest 编写

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
    "id": "my-plugin",
    "label": "My Plugin",
    "icon": "Puzzle",
    "page_type": "web"
  },
  "ui": {
    "entry": "index.html"
  },
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

插件特有字段（相对动作包）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `pack_type` | 是 | 必须为 `"plugin"` |
| `rust_library` | 是 | .dll 相对路径 |
| `sidebar` | 是 | 侧边栏入口（lucide-react 图标） |
| `ui.entry` | 是 | 前端入口 HTML 路径 |

完整字段说明请查阅 [Manifest 参考](/api/manifest)。

## 前端 iframe 开发

### 加载机制

Exero 通过 Tauri 自定义协议加载插件前端：
- 访问地址：`http://plugin.localhost/{pack_id}/{file_path}`
- 示例：`http://plugin.localhost/my-plugin/index.html`

所有相对路径资源（CSS/JS/图片）都通过同一协议服务。

### 桥接脚本自动注入

Exero 会自动在 HTML 的 `</head>` 前注入桥接脚本，无需手动引入。注入后可使用：

```javascript
window.exero.invoke(actionId, params)  // Promise<any>
```

### iframe 沙箱

```
allow-scripts allow-forms allow-popups allow-modals
```

- ✅ 脚本、表单、弹窗、模态框
- ❌ `allow-same-origin`（防止访问主窗口 DOM）
- ❌ `allow-top-navigation`（防止篡改主窗口导航）

### 前端页面示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>My Plugin</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
    button { padding: 8px 16px; cursor: pointer; }
    .result { margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>My Plugin</h1>
  <div>
    <input type="number" id="a" value="1" /> +
    <input type="number" id="b" value="2" />
    <button id="btn">计算</button>
  </div>
  <div id="result" class="result">等待调用...</div>

  <script>
    document.getElementById('btn').addEventListener('click', async () => {
      const a = parseInt(document.getElementById('a').value);
      const b = parseInt(document.getElementById('b').value);
      const resultEl = document.getElementById('result');
      try {
        const result = await window.exero.invoke('add', { a, b });
        resultEl.textContent = '结果: ' + JSON.stringify(result);
      } catch (e) {
        resultEl.textContent = '错误: ' + e.message;
      }
    });
  </script>
</body>
</html>
```

桥接 API 详情请查阅 [桥接 API 参考](/api/bridge-api)。

## 打包发布

### 打包前准备

确保以下文件在插件目录根层级：
- `manifest.json`
- `my_plugin.dll`（从 `C:\cargo-target-dominate\release\` 复制过来）
- `index.html` + 所有前端资源

```powershell
# 复制 .dll 到插件目录
Copy-Item C:\cargo-target-dominate\release\my_plugin.dll .\my-plugin\

# 打包为 .exero-pack（zip 格式）
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

### 安装验证

- **市场安装**：Exero 内「扩展市场 → 插件」标签安装
- **本地导入**：「设置 → 扩展包」导入 `.exero-pack`

安装后侧边栏出现 `My Plugin` 入口，点击进入页面。

完整发布流程请查阅 [构建与发布](/build-and-publish)。

## 参考示例

官方示例：`examples/hello-plugin/`（1 个 Rust 动作 + 按钮页面）

## 下一步

- [桥接 API 完整参考](/api/bridge-api)
- [Rust SDK 完整参考](/api/sdk)
- [Manifest 完整参考](/api/manifest)
- [调试与排错](/troubleshooting)
