<VersionBadge />

# 桥接 API

插件页面（iframe）与 Exero 主程序通信的 JavaScript 接口。Exero 自动在每个插件 HTML 页面的 `</head>` 前注入桥接脚本，开发者无需手动引入任何 JS 文件。

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

---

## 底层通信协议（postMessage）

`window.exero.invoke` 是对 `postMessage` 的 Promise 封装。通常无需直接使用，但在调试时可通过 DevTools 观察。

### 请求帧（iframe → 主窗口）

```javascript
window.parent.postMessage({
  type: 'exero-invoke',
  id: 'xxx',          // 随机请求 ID（UUID/自增数，用于关联响应）
  actionId: 'add',
  params: { a: 1, b: 2 }
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

插件 iframe 的 sandbox 配置（硬编码于 [PluginPage.tsx](file:///e:/Project/Exero/src/pages/PluginPage.tsx#L189)）：

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

---

## 桥接脚本注入（实现细节）

桥接脚本在 Rust 端通过 `inject_bridge_script` 函数注入到 HTML 响应。等效于：

```html
<script>
(function() {
  const pending = new Map();
  let seq = 0;

  window.exero = {
    invoke(actionId, params) {
      const id = String(++seq);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.parent.postMessage({
          type: 'exero-invoke', id, actionId, params
        }, '*');
      });
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

```
插件前端 (iframe)
  │  window.exero.invoke('add', {a:1, b:2})
  │  ── postMessage({type:'exero-invoke', id:1, actionId:'add', params:{a:1,b:2}}) ──▶
  │                                                                                      │
  ▼                                                                                      ▼
PluginPage (React 主窗口)
  │  extensionPackCommands.executePluginAction('my-plugin', 'add', {a:1, b:2})
  │  ── Tauri IPC → Rust 后端 ──▶
  ▼
RustLibraryRegistry::execute
  │  C ABI 调用 .dll：exero_execute_action("add", "{\"a\":1,\"b\":2}")
  │  ← JSON 字符串 "{\"sum\":3}" 或 NULL（exero_last_error() 取错误）
  ▼
PluginPage
  │  postMessage({type:'exero-result', id:1, result:{sum:3}}) ◀── 结果
  │
  ▼
插件前端 Promise.resolve({sum:3})
```
