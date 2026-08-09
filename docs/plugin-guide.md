# 插件开发指南

> Exero V0.4.0-Beta5 · 插件（`pack_type: plugin`）开发文档

插件是 Exero 扩展系统的高级形态，相比动作包提供完整功能页面：**iframe UI + 侧边栏入口 + Rust .dll 动作**。插件通过 Tauri 自定义协议加载前端资源，通过桥接 API 与主程序通信。

---

## 目录

- [快速入门](#快速入门)
- [Manifest 字段参考](#manifest-字段参考)
- [Rust .dll 开发（exero-plugin-sdk）](#rust-dll-开发exero-plugin-sdk)
- [前端 iframe 开发](#前端-iframe-开发)
- [桥接 API](#桥接-api)
- [打包与发布](#打包与发布)
- [完整示例：Hello Plugin](#完整示例hello-plugin)

---

## 快速入门

创建一个最小可用的插件，包含侧边栏入口、iframe 页面、Rust 动作。

### 1. 创建项目结构

```
my-plugin/
├── Cargo.toml          # Rust crate 配置
├── src/
│   └── lib.rs          # Rust 动作（.dll）
├── manifest.json       # 插件 manifest
└── index.html          # 插件前端页面
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
  "description": "我的第一个 Exero 插件",
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

### 5. 编写前端页面

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body>
  <button id="btn">Call Rust</button>
  <div id="result"></div>
  <script>
    document.getElementById('btn').addEventListener('click', async () => {
      const result = await window.exero.invoke('say_hello', {});
      document.getElementById('result').textContent = JSON.stringify(result);
    });
  </script>
</body>
</html>
```

### 6. 编译打包

```powershell
# 编译 .dll
cargo build --release

# 打包为 .exero-pack（zip 格式，manifest.json 位于根目录）
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

安装后在 Exero 侧边栏会出现 "My Plugin" 入口，点击进入插件页面，"Call Rust" 按钮调用 .dll 返回结果。

---

## Manifest 字段参考

### ExtensionPackManifest（根结构）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 插件唯一标识 |
| `version` | string | 是 | SemVer 版本号 |
| `name` | string | 是 | 显示名 |
| `description` | string | 否 | 描述 |
| `author` | string | 否 | 作者 |
| `exero_api_version` | string | 是 | 所需 Exero API 版本（`0.4.0`） |
| `pack_type` | string | 是 | **必须为 `plugin`** |
| `rust_library` | string | 是 | **插件必填**，Rust .dll 相对路径（如 `my_plugin.dll`） |
| `actions` | ActionManifest[] | 否 | 动作声明（同时注册为 Flow 积木） |
| `sidebar` | SidebarManifest | 是 | **插件必填**，侧边栏入口声明 |
| `ui` | UiManifest | 是 | **插件必填**，前端入口声明 |

### SidebarManifest（侧边栏入口）

```json
{
  "id": "my-plugin",
  "label": "My Plugin",
  "icon": "Puzzle",
  "page_type": "web"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 入口唯一标识（建议与插件 id 一致） |
| `label` | string | 是 | 入口显示名 |
| `icon` | string | 是 | lucide-react 图标名（如 `Puzzle`） |
| `page_type` | string | 否 | 页面类型，插件固定为 `web`（iframe 页面） |

### UiManifest（前端入口）

```json
{
  "entry": "index.html"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entry` | string | 是 | 前端入口文件相对路径 |

### ActionManifest（动作声明）

插件的动作声明结构与动作包一致，详见 [动作包指南 · ActionManifest](./action-pack-guide.md#actionmanifest动作声明)。

插件动作的 `executor_type` 固定为 `rust`，`executor_id` 对应 `declare_actions!` 宏中注册的动作 id。

---

## Rust .dll 开发（exero-plugin-sdk）

### Params 结构

`Params` 封装 Exero 传入的 JSON 参数，提供类型安全的访问方法。

```rust
use exero_plugin_sdk::Params;

fn my_action(params: Params) -> Result<serde_json::Value, String> {
    // 获取必填参数（缺失或类型错误时返回 Err）
    let name: String = params.get("name")?;

    // 获取可选参数（缺失或类型错误时返回 None）
    let count: Option<i64> = params.get_optional("count");

    // 获取原始 JSON
    let raw = params.raw();

    Ok(serde_json::json!({ "echo": name }))
}
```

| 方法 | 签名 | 说明 |
|---|---|---|
| `get<T>` | `(&self, key: &str) -> Result<T, String>` | 获取必填参数 |
| `get_optional<T>` | `(&self, key: &str) -> Option<T>` | 获取可选参数 |
| `raw` | `(&self) -> &serde_json::Value` | 获取原始 JSON |

### declare_actions! 宏

声明动作注册表，自动生成 C ABI 导出函数。

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

fn add(params: Params) -> Result<serde_json::Value, String> {
    let a: i64 = params.get("a")?;
    let b: i64 = params.get("b")?;
    Ok(json!({ "sum": a + b }))
}

declare_actions! {
    "say_hello" => say_hello,
    "add" => add,
}
```

**语法**：

```rust
declare_actions! {
    "action_id" => handler_fn,
    ...
}
```

- 键：动作 id（字符串字面量，对应 manifest `actions[].id`）
- 值：处理函数路径，签名为 `fn(Params) -> Result<serde_json::Value, String>`

### 生成的 C ABI 函数

宏自动生成以下 4 个导出函数，无需手动编写：

| 函数 | 签名 | 说明 |
|---|---|---|
| `exero_pack_init` | `() -> i32` | 加载时调用，返回 0 表示成功 |
| `exero_pack_cleanup` | `()` | 卸载时调用 |
| `exero_execute_action` | `(action_id: *const c_char, params_json: *const c_char) -> *const c_char` | 执行动作，返回 JSON 字符串，NULL 表示出错 |
| `exero_last_error` | `() -> *const c_char` | 获取最近一次错误信息，NULL 表示无错误 |

### 返回值约定

- **成功**：返回 `Ok(serde_json::Value)`，序列化为 JSON 字符串返回给 Exero
- **失败**：返回 `Err(String)`，错误信息通过 `exero_last_error` 获取

### 线程安全

返回字符串通过 `thread_local` 存储，Exero 在调用后立即复制为 Rust String，下次调用会覆盖旧值。跨线程调用时每个线程有独立的 thread_local 缓冲区。

### 编译

```powershell
# 设置 CARGO_TARGET_DIR（防止污染回收站）
$env:CARGO_TARGET_DIR="C:\cargo-target-dominate"

# 编译为 .dll
cargo build --release
```

产物位于 `C:\cargo-target-dominate\release\my_plugin.dll`。

---

## 前端 iframe 开发

### 加载机制

Exero 通过 Tauri 自定义协议加载插件前端：

- 协议：`plugin` URI scheme
- 访问格式（Windows）：`http://plugin.localhost/{pack_id}/{file_path}`
- 示例：`http://plugin.localhost/my-plugin/index.html`

插件前端文件位于插件安装目录，由 Exero 主程序通过协议服务。所有相对路径的资源（CSS/JS/图片）都通过同一协议加载。

### 桥接脚本注入

Exero 在返回 HTML 文件时，**自动在 `</head>` 前注入桥接脚本**，提供 `window.exero.invoke` 接口。插件开发者无需手动引入任何脚本。

### iframe 沙箱权限

插件 iframe 的 sandbox 配置：

```
allow-scripts allow-forms allow-popups allow-modals
```

- 允许执行脚本、表单提交、弹窗、模态框
- **不**允许 `allow-same-origin`（防止插件访问 Exero 主窗口 DOM）
- **不**允许 `allow-top-navigation`（防止插件篡改主窗口）

---

## 桥接 API

### `window.exero.invoke(actionId, params)`

调用插件 Rust .dll 中的动作。

**参数**：

- `actionId`：string，动作 id（对应 `declare_actions!` 注册的 id）
- `params`：object，传递给动作的参数

**返回**：`Promise<any>`，解析为动作返回的 JSON 结果

**示例**：

```javascript
// 调用无参数动作
const result = await window.exero.invoke('say_hello', {});
console.log(result); // { message: "Hello from Rust!" }

// 调用带参数动作
const sum = await window.exero.invoke('add', { a: 1, b: 2 });
console.log(sum); // { sum: 3 }
```

**错误处理**：

```javascript
try {
  const result = await window.exero.invoke('my_action', { ... });
} catch (e) {
  console.error('动作执行失败:', e.message);
}
```

### 通信协议

桥接 API 基于 `postMessage` 实现跨域通信：

```
iframe -> 主窗口：
  postMessage({ type: 'exero-invoke', id, actionId, params })

主窗口 -> iframe：
  postMessage({ type: 'exero-result', id, result | error })
```

- `id`：随机生成的请求 ID，用于关联请求与响应
- 支持并发调用，每个请求独立 Promise

---

## 打包与发布

### 打包

将插件所有文件压缩为 `.exero-pack`（zip 格式），要求 `manifest.json` 位于压缩包根目录。

```powershell
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

### 发布到市场

1. 将 `.exero-pack` 文件放入仓库 `Market/plugins/` 目录
2. 运行 `scripts/build-packs.ps1` 重新生成 `market-index.json`
3. 推送到 GitHub 仓库

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1
```

### 安装方式

- **市场安装**：Exero 内「扩展市场」页面，切换到"插件"筛选标签安装
- **本地导入**：「设置 → 扩展包」导入本地 `.exero-pack` 文件

安装后插件自动出现在侧边栏（icon + label），点击进入插件 iframe 页面。

---

## 完整示例：Hello Plugin

完整示例位于 `examples/hello-plugin/`。

### 文件结构

```
examples/hello-plugin/
├── Cargo.toml
├── src/
│   └── lib.rs
├── manifest.json
└── index.html
```

### Cargo.toml

```toml
[package]
name = "hello-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
exero-plugin-sdk = { path = "../../exero-plugin-sdk" }
serde_json = "1"
```

### src/lib.rs

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

### manifest.json

```json
{
  "id": "hello-plugin",
  "version": "0.1.0",
  "name": "Hello Plugin",
  "description": "Exero 官方示例插件",
  "author": "Exero",
  "exero_api_version": "0.4.0",
  "pack_type": "plugin",
  "rust_library": "hello_plugin.dll",
  "sidebar": {
    "id": "hello-plugin",
    "label": "Hello",
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

### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /></head>
<body>
  <h1>Hello Plugin</h1>
  <button id="btn">Call Rust</button>
  <div id="result">等待调用...</div>
  <script>
    document.getElementById('btn').addEventListener('click', async () => {
      const resultEl = document.getElementById('result');
      try {
        const result = await window.exero.invoke('say_hello', {});
        resultEl.textContent = JSON.stringify(result);
      } catch (e) {
        resultEl.textContent = '错误: ' + e.message;
      }
    });
  </script>
</body>
</html>
```

### 编译与打包

```powershell
# 1. 设置 CARGO_TARGET_DIR
$env:CARGO_TARGET_DIR="C:\cargo-target-dominate"

# 2. 编译 .dll
cd examples\hello-plugin
cargo build --release

# 3. 打包（项目根目录执行）
cd e:\Project\Exero
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1
```

打包后生成 `Market/plugins/hello-plugin.exero-pack`，包含 manifest.json + index.html + hello_plugin.dll。

---

## 下一步

- 开发纯动作包（无 UI）：参阅 [动作包开发指南](./action-pack-guide.md)
- 了解 Exero 整体架构：参阅 [SPEC.md](./SPEC.md)
