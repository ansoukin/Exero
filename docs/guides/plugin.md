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
exero-plugin-sdk = { path = "../../exero-plugin-sdk" }
serde_json = "1"
```

::: warning 路径注意
`exero-plugin-sdk` 相对路径取决于你的插件目录位置。官方示例 `examples/hello-plugin` 用 `../../exero-plugin-sdk`（SDK 在项目根目录 `exero-plugin-sdk/`）。
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

```powershell
cargo build --release
```

产物：`target\release\my_plugin.dll`（crate name 中的 `-` 自动转为 `_`）。可选：将 `CARGO_TARGET_DIR` 指向项目外固定目录，让多个插件共享编译缓存。

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
  "hide_header": false,
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
| `sidebar` | 是 | 侧边栏入口（[图标三源](#图标三源)） |
| `ui.entry` | 是 | 前端入口 HTML 路径 |
| `hide_header` | 否 | `true` 时隐藏 iframe 上方标题栏（插件名称+版本号信息条），默认 `false`。设为 `true` 后插件需自行管理全部 UI（包括返回按钮等导航） |
| `actions` | 否 | 附带的 Flow 积木动作。纯页面插件（如音乐播放器）可不声明 |

完整字段说明请查阅 [Manifest 参考](/api/manifest)。

## 图标三源

`sidebar.icon` 与 `actions[].icon` 字段支持三种图标来源（Beta9 起）：

| 写法 | 来源 | 示例 |
|---|---|---|
| `"Music"` | lucide 图标名（默认，Exero 内置图标库，无需打包资源） | `"Puzzle"`、`"Code"` |
| `"segoe:E8B7"` | Segoe 系统图标字体码点（Win11 Segoe Fluent Icons，Win10 自动回退 Segoe MDL2 Assets） | `"segoe:E713"`（设置齿轮） |
| `"img:icons/logo.svg"` | 扩展包目录内的图片文件（SVG/PNG/ICO 随包分发） | `"img:assets/icon.png"` |

- lucide 名大小写敏感，完整列表见 [lucide.dev/icons](https://lucide.dev/icons)
- `segoe:` 后跟十六进制码点，查阅微软 [Fluent Icons 字形表](https://learn.microsoft.com/windows/apps/design/style/segoe-fluent-icons-font)
- `img:` 路径相对扩展包根目录，随 `.exero-pack` 一起分发，加载时由后端重写为 `plugin.localhost` URL

## 前端 iframe 开发

### 加载机制

Exero 通过 Tauri 自定义协议加载插件前端：
- 访问地址：`http://plugin.localhost/{pack_id}/{file_path}`
- 示例：`http://plugin.localhost/my-plugin/index.html`

所有相对路径资源（CSS/JS/图片）都通过同一协议服务。

### 桥接脚本自动注入

Exero 会自动在 HTML 的 `</head>` 前注入桥接脚本，无需手动引入。注入后可使用：

```javascript
window.exero.invoke(actionId, params)  // Promise<any> 调用 .dll 动作
window.exero.getTheme()                // Promise<"light"|"dark"> 查询当前生效主题
window.exero.onTheme(cb)               // 订阅明暗变化（cb 收到 "light"|"dark"）
window.exero.storage.set(key, value)   // Promise<void> 宿主持久化存储
window.exero.storage.get(key)          // Promise<any>
window.exero.storage.remove(key)       // Promise<void>
window.exero.storage.clear()           // Promise<void> 清空当前插件数据
window.exero.storage.keys()            // Promise<string[]>
```

### iframe 沙箱

```
allow-scripts allow-forms allow-popups allow-modals
```

- ✅ 脚本、表单、弹窗、模态框
- ❌ `allow-same-origin`（防止访问主窗口 DOM）
- ❌ `allow-top-navigation`（防止篡改主窗口导航）

::: warning sandbox 限制与开发注意事项
由于 iframe sandbox **不含 `allow-same-origin`**，以下操作会被浏览器拦截：

1. **`file:///` 协议**：无法通过 `audio.src = 'file:///C:/...'` 等方式加载本地文件
2. **`fetch('file:///...')`**：无法用 fetch 读取本地文件
3. **localStorage / sessionStorage**：sandbox 禁止访问，持久化数据请用[宿主存储 API](#桥接脚本自动注入)（`window.exero.storage.*`）
4. **XMLHttpRequest**：无法直接请求本地文件

**解决方案**：使用 `local-file` 协议（见下方说明）
:::

### 明暗模式适配（Beta9）

插件默认**自动跟随软件明暗**：宿主通过 postMessage 向插件推送当前生效主题，iframe 不会重载（保活不断）。用户也可在 **设置 → 插件 → 外观明暗** 中为单个插件强制指定浅色/深色（覆盖应用主题）。

**宿主推送时机**：iframe 加载完成、应用切换明暗、设置页手动配置变化。

**插件侧适配**：

```javascript
// 1. 初始主题
const theme = await window.exero.getTheme(); // "light" | "dark"
applyTheme(theme);

// 2. 订阅变化（应用切换 / 用户手动指定都会触发）
window.exero.onTheme((theme) => applyTheme(theme));

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme; // 或切换自己的 class
}
```

::: tip 推荐 CSS 变量方案
```css
:root { --bg: #f9fbfd; --fg: #1a2233; }
[data-theme="dark"] { --bg: #0b0f17; --fg: #e6eaf2; }
body { background: var(--bg); color: var(--fg); }
```
:::

### 本地文件访问（local-file 协议）

由于 iframe sandbox 禁止 `file:///` 访问，Exero 提供 `local-file` 自定义 URI scheme，让插件能加载本地文件（如音频、图片、视频等）。

**访问格式**（Windows）：

```
http://local-file.localhost/{url-encoded-file-path}
```

**示例**：

```javascript
// 播放本地音频文件
const audioPath = 'C:\\Users\\music\\song.mp3';
audio.src = 'http://local-file.localhost/' + encodeURIComponent(audioPath);

// 显示本地图片
const imgPath = 'D:\\Photos\\cover.jpg';
img.src = 'http://local-file.localhost/' + encodeURIComponent(imgPath);
```

**支持的 MIME 类型**：mp3/wav/flac/ogg/m4a/aac（音频），png/jpeg/gif/bmp/webp/svg（图片），以及所有 `plugin://` 协议支持的类型。

::: tip 路径编码
务必使用 `encodeURIComponent()` 编码文件路径，否则 Windows 路径中的 `:` 和 `\` 会导致 URL 解析错误。
:::

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

## 生命周期与持久运行（Beta9）

插件 iframe 由常驻宿主层（`PluginHostLayer`）管理，生命周期类似 Chrome 扩展的后台页：

| 事件 | 行为 |
|---|---|
| 首次打开插件页 | iframe 创建并加载，注册到宿主层 |
| 切换到其他页面 | iframe 隐藏（`display:none`）但**不卸载**——音频播放、定时器、后台任务继续 |
| 再次进入插件页 | 瞬时恢复显示，无重新加载 |
| 离开插件页（keep-alive 开，默认） | 插件继续存活 |
| 离开插件页（keep-alive 关） | iframe 销毁，下次进入重新加载 |
| 用户「强制停止」 | iframe 立即销毁（设置 → 插件） |

对开发者的意义：

- **有状态体验免费获得**：播放器切页不停歌、监控插件后台持续采集，无需自己实现保活
- **初始化逻辑放页面加载时一次执行即可**：iframe src 全生命周期稳定，React/主窗口重渲染不会重载你的页面
- **感知销毁**：keep-alive 关闭或强制停止时 iframe 被移除，`beforeunload` 等常规页面卸载语义适用；需要持久化的数据务必及时写入 `window.exero.storage`（见上方存储 API），不要只在卸载时保存
- keep-alive 是**用户侧设置**（设置 → 插件，按插件独立开关），插件无法强制改变，设计时两种模式都要能正确工作

## 打包发布

### 打包前准备

确保以下文件在插件目录根层级：
- `manifest.json`
- `my_plugin.dll`（从 `target\release\` 复制过来）
- `index.html` + 所有前端资源

```powershell
# 复制 .dll 到插件目录
Copy-Item target\release\my_plugin.dll .\my-plugin\

# 打包为 .exero-pack（zip 格式）
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

### 安装验证

- **市场安装**：Exero 内「扩展市场 → 插件」标签安装
- **本地导入**：「设置 → 扩展包」导入 `.exero-pack`

安装后侧边栏出现 `My Plugin` 入口，点击进入页面。

完整发布流程请查阅 [构建与发布](/build-and-publish)。

## 参考示例

官方示例：
- `examples/hello-plugin/`：入门示例（1 个 Rust 动作 + 按钮页面）
- `examples/music-player/`：音乐播放器（纯页面插件，无动作积木；文件选择 + 元数据读取 + 封面提取 + local-file 协议播放 + hide_header + 持久运行典范——切页音乐不停）

## 下一步

- [桥接 API 完整参考](/api/bridge-api)
- [Rust SDK 完整参考](/api/sdk)
- [Manifest 完整参考](/api/manifest)
- [调试与排错](/troubleshooting)
