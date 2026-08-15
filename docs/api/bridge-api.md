<VersionBadge />

# 桥接 API

插件页面（iframe）与 Exero 主程序通信的 JavaScript 接口。Exero 自动在每个插件 HTML 页面的 `</head>` 前注入桥接脚本，开发者无需手动引入任何 JS 文件。

::: tip 页面切换不影响通信（Beta9）
插件由常驻宿主层（`PluginHostLayer`）管理，切换页面不卸载 iframe——桥接连接、页面状态、播放中的媒体在页面切换后均保持。详见[插件生命周期](/guides/plugin#生命周期与持久运行-beta9)。
:::

## 快速示例

```javascript
// 调用插件 Rust .dll 中的 "add" 动作
try {
  const result = await window.exero.invoke('add', { a: 1, b: 2 });
  console.log(result); // { sum: 3 }
} catch (e) {
  console.error('调用失败:', e.message);
}
```

## API 列表

### `window.exero.invoke(actionId, params)`

调用插件 Rust .dll 中通过 `declare_actions!` 注册的动作。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `actionId` | string | ✅ | 动作 ID（与 `declare_actions!` 中注册的键一致，同时需在 manifest `actions[].id` 声明） |
| `params` | object | ✅ | 传给 Rust 动作的参数对象。Rust 端用 `Params::get(key)` 读取 |

**返回**：`Promise<any>`
- 成功 resolve：Rust 动作返回的 `serde_json::Value` 反序列化结果
- 失败 reject：`Error` 对象，`message` 包含 Rust 端的 `Err(String)`

**错误处理**：

```javascript
try {
  const result = await window.exero.invoke('my_action', { foo: 'bar' });
  console.log('成功:', result);
} catch (e) {
  // 可能的错误来源：
  // 1. 未知的 actionId → "unknown action: xxx"
  // 2. 参数缺失/类型错误 → "缺少参数: xxx" / "参数 xxx 类型错误: ..."
  // 3. Rust 业务逻辑错误 → Err(String) 内容
  // 4. .dll 未加载或崩溃
  console.error('失败:', e.message);
}
```

### `window.exero.storage.*`（宿主存储 API）

读写宿主持久化存储。因为插件 iframe 的 sandbox **不开放 `allow-same-origin`**，浏览器 localStorage / Cookie / IndexedDB 全部不可用（opaque origin）。为此 Exero 提供宿主管控的键值存储：数据由主程序后端代为落盘，**按插件（pack_id）隔离**，插件之间互不可见。

| 方法 | 说明 | 返回 |
|---|---|---|
| `await window.exero.storage.set(key, value)` | 写入键值，`value` 为任意 JSON（数组/对象/字符串/数字/布尔） | `Promise<void>` |
| `await window.exero.storage.get(key)` | 读取键值，不存在返回 `null` | `Promise<any>` |
| `await window.exero.storage.remove(key)` | 删除键（键不存在也成功） | `Promise<void>` |
| `await window.exero.storage.clear()` | 清空当前插件的全部数据 | `Promise<void>` |
| `await window.exero.storage.keys()` | 列出当前插件的全部键 | `Promise<string[]>` |

```javascript
// 保存设置
await window.exero.storage.set('volume', 0.8);
await window.exero.storage.set('playlist', [
  { path: 'C:/music/a.mp3', title: '歌名' }
]);

// 读取设置（不存在返回 null）
const volume = await window.exero.storage.get('volume'); // 0.8
const list = await window.exero.storage.get('playlist');

// 删除 / 清空 / 列键
await window.exero.storage.remove('volume');
await window.exero.storage.keys();   // ['playlist']
await window.exero.storage.clear();  // 全部清空
```

::: tip 存储特性
- **隔离**：每个插件独立存储空间，键名不冲突，无法读取其他插件数据。
- **持久化**：数据保存在宿主导航数据目录 `%APPDATA%/Exero/plugin-data/{pack_id}.json`，退出/重启不丢失。
- **容量**：适合 JSON 元数据（设置、列表、缓存索引）。**不要存放大体积二进制/图片**——图片建议用 `local-file` 协议按路径加载。
- **同步语义**：`set` 返回前数据已落盘。
:::

---

## 底层通信协议（postMessage）

`window.exero.invoke` 是对 `postMessage` 的 Promise 封装。通常无需直接使用，但在调试时可通过 DevTools 观察。

### 请求帧（iframe → 主窗口）

```javascript
// 动作调用
window.parent.postMessage({
  type: 'exero-invoke',
  id: 'xxx',          // 随机请求 ID（用于关联响应）
  actionId: 'add',
  params: { a: 1, b: 2 }
}, '*');

// 存储操作
window.parent.postMessage({
  type: 'exero-storage',
  id: 'xxx',
  op: 'set',          // get | set | remove | clear | keys
  key: 'volume',
  value: 0.8
}, '*');
```

### 响应帧（主窗口 → iframe）

```javascript
// 成功
iframe.contentWindow.postMessage({
  type: 'exero-result',
  id: 'xxx',
  result: { sum: 3 }
}, '*');

// 失败
iframe.contentWindow.postMessage({
  type: 'exero-result',
  id: 'xxx',
  error: '缺少参数: a'
}, '*');
```

- 并发请求独立处理，每个请求有独立 Promise
- `id` 由桥接脚本生成（自增整数），响应通过 `id` 关联到对应 Promise
- `targetOrigin: "*"`：插件 iframe sandbox 无 `allow-same-origin`，origin 无实际意义

---

## iframe 沙箱属性

插件 iframe 的 sandbox 配置（硬编码于 PluginHostLayer.tsx）：

```
allow-scripts allow-forms allow-popups allow-modals
```

| 权限 | 状态 | 说明 |
|---|---|---|
| `allow-scripts` | ✅ | 允许执行 JavaScript（桥接 API 依赖） |
| `allow-forms` | ✅ | 允许表单提交 |
| `allow-popups` | ✅ | 允许 `window.open()` 打开弹窗 |
| `allow-modals` | ✅ | 允许 `alert/confirm/prompt` 模态框 |
| `allow-same-origin` | ❌ | **禁止**。防止插件访问 Exero 主窗口 DOM、Cookie、LocalStorage |
| `allow-top-navigation` | ❌ | **禁止**。防止插件修改主窗口 URL 或跳转走 |

::: warning DOM 隔离
由于 `allow-same-origin` 被移除，iframe 与主窗口处于不同 origin。`window.parent`、`window.top` 可访问（postMessage 通信），但 `window.parent.document` 等跨域 API 会抛 SecurityError。
:::

::: tip 需要持久化数据？
`allow-same-origin` 被禁止后，浏览器 localStorage / Cookie / IndexedDB 在 iframe 内**全部不可用**（opaque origin）。如果插件需要保存数据，请使用 [宿主存储 API](#window-exero-storage-宿主存储-api)（`window.exero.storage.*`），由主程序代为落盘且按插件隔离——无需也**不应该**为此放开 `allow-same-origin`。
:::

---

## 前端资源加载

插件前端文件通过 Tauri 自定义 **`plugin` 协议**服务：

| 环境 | URL 格式 | 示例 |
|---|---|---|
| Windows | `http://plugin.localhost/{pack_id}/{path}` | `http://plugin.localhost/hello-plugin/index.html` |
| 其他 | `plugin://{pack_id}/{path}` | `plugin://hello-plugin/index.html` |

- 所有相对路径资源（CSS/JS/图片）自动走同一协议
- 桥接脚本在返回 HTML 时注入到 `</head>` 前（仅对 `.html` 响应生效）
- **文件命名建议**：入口固定 `index.html`，资源放 `assets/` 子目录避免与入口冲突

### 本地文件加载（local-file 协议）

iframe sandbox 禁止 `file:///` 访问，插件如需加载本地文件（音频/图片/视频等），使用 `local-file` 协议：

| 环境 | URL 格式 | 示例 |
|---|---|---|
| Windows | `http://local-file.localhost/{url-encoded-path}` | `http://local-file.localhost/C%3A%5CUsers%5Cmusic%5Csong.mp3` |

```javascript
// 加载本地音频
audio.src = 'http://local-file.localhost/' + encodeURIComponent(filePath);

// 加载本地图片
img.src = 'http://local-file.localhost/' + encodeURIComponent(imagePath);
```

::: warning 路径编码
务必使用 `encodeURIComponent()` 编码文件路径。Windows 路径中的 `:` 和 `\` 会导致 URL 解析错误。
:::

---

## 桥接脚本注入（实现细节）

桥接脚本在 Rust 端通过 `inject_bridge_script` 函数注入到 HTML 响应。等效于：

```html
<script>
(function() {
  const pending = new Map();
  window.exero = {
    _post(msg) {
      const id = String(++pending.size);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        msg.id = id;
        window.parent.postMessage(msg, '*');
      });
    },
    invoke(actionId, params) {
      return this._post({ type: 'exero-invoke', actionId, params: params || {} });
    },
    storage: {
      get: (key) => window.exero._post({ type: 'exero-storage', op: 'get', key }),
      set: (key, value) => window.exero._post({ type: 'exero-storage', op: 'set', key, value }),
      remove: (key) => window.exero._post({ type: 'exero-storage', op: 'remove', key }),
      clear: () => window.exero._post({ type: 'exero-storage', op: 'clear' }),
      keys: () => window.exero._post({ type: 'exero-storage', op: 'keys' }),
    }
  };

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'exero-result') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if ('error' in d) p.reject(new Error(d.error));
    else p.resolve(d.result);
  });
})();
</script>
```

---

## 调试技巧

1. **DevTools 查看 postMessage**：在插件 iframe 内右键 → 检查，切换到 Console
2. **日志桥接请求**：临时在页面 console 里运行 `monitorEvents(window, 'message')` 观察通信
3. **超时问题**：Rust 动作执行时间无硬上限，但主程序 UI 会卡住等待返回，建议长耗时动作拆分为异步 + 轮询

---

## 数据流全景

### 动作调用（invoke）

```
插件前端 (iframe)
  │  window.exero.invoke('add', {a:1, b:2})
  │  ── postMessage({type:'exero-invoke', id:1, actionId:'add', params:{a:1,b:2}}) ──▶
  │                                                                                      │
  ▼                                                                                      ▼
PluginHostLayer (React 主窗口，常驻)
  │  extensionPackCommands.executePluginAction('my-plugin', 'add', {a:1, b:2})
  │  ── Tauri IPC → Rust 后端 ──▶
  ▼
RustLibraryRegistry::execute
  │  C ABI 调用 .dll：exero_execute_action("add", "{\"a\":1,\"b\":2}")
  │  ← JSON 字符串 "{\"sum\":3}" 或 NULL（exero_last_error() 取错误）
  ▼
PluginHostLayer
  │  postMessage({type:'exero-result', id:1, result:{sum:3}}) ◀── 结果
  │
  ▼
插件前端 Promise.resolve({sum:3})
```

### 存储 API（storage）

```
插件前端 (iframe)
  │  await window.exero.storage.set('volume', 0.8)
  │  ── postMessage({type:'exero-storage', id:2, op:'set', key:'volume', value:0.8}) ──▶
  │
  ▼
PluginHostLayer (React 主窗口，常驻)
  │  extensionPackCommands.pluginStorageSet('my-plugin', 'volume', 0.8)
  │  ── Tauri IPC → Rust 后端 ──▶
  ▼
PluginStorage::set
  │  更新内存缓存 + 写盘 %APPDATA%/Exero/plugin-data/my-plugin.json
  ▼
PluginHostLayer
  │  postMessage({type:'exero-result', id:2, result:null}) ◀── 完成
  │
  ▼
插件前端 Promise.resolve()
```
