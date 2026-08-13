<VersionBadge />

# UI 风格指南

Exero 插件 UI 遵循 **Win11 Fluent Design** 设计语言。本指南帮助插件开发者打造与主程序风格统一的界面。

::: tip 为什么需要统一风格？
Exero 的"Open"宗旨允许插件自由发挥，但风格统一的插件能给用户"原生功能"般的体验。遵循本指南能让你的插件看起来像 Exero 自带功能，而非第三方拼凑。
:::

## 设计原则

| 原则 | 说明 |
|---|---|
| **Win11 Fluent Design** | 参考 Windows 11 系统应用的视觉风格 |
| **8px 网格系统** | 所有间距、尺寸为 8 的倍数（4px 用于微调） |
| **圆角 6-8px** | 卡片 8px，按钮/输入框 6px，小元素 4px |
| **200ms 动画过渡** | 兼容 30Hz 屏幕，避免眩晕 |
| **触控目标 ≥ 48px** | 适配 UHD 触屏，按钮/可点击元素不小于 48px |

## 色彩系统

### 深色主题（默认）

```css
:root {
  /* 背景层级 */
  --bg: #0a0f1a;                    /* 主背景 */
  --bg-card: rgba(255, 255, 255, 0.04);    /* 卡片背景 */
  --bg-card-hover: rgba(255, 255, 255, 0.08); /* 卡片 hover */
  --bg-active: rgba(0, 120, 212, 0.15);    /* 选中态背景 */

  /* 边框 */
  --border: rgba(255, 255, 255, 0.08);       /* 默认边框 */
  --border-strong: rgba(255, 255, 255, 0.15); /* 强调边框 */

  /* 文字 */
  --text: #e5e7eb;           /* 主文字 */
  --text-secondary: #9ca3af; /* 次要文字 */
  --text-muted: #6b7280;     /* 弱化文字 */

  /* 品牌色 */
  --primary: #0078D4;        /* Win11 蓝 */
  --primary-hover: #106EBE;
  --primary-active: #005a9e;

  /* 语义色 */
  --danger: #ef4444;
  --danger-hover: #dc2626;
}
```

### 浅色主题

跟随系统切换时，将上述变量替换为：

```css
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f3f3f3;
    --bg-card: rgba(0, 0, 0, 0.03);
    --bg-card-hover: rgba(0, 0, 0, 0.06);
    --bg-active: rgba(0, 120, 212, 0.08);
    --border: rgba(0, 0, 0, 0.08);
    --border-strong: rgba(0, 0, 0, 0.15);
    --text: #1a1a1a;
    --text-secondary: #616161;
    --text-muted: #9e9e9e;
    /* 品牌色保持不变 */
  }
}
```

::: warning 插件主题
Exero 主程序支持深色/浅色主题跟随系统。插件 iframe 内无法读取主程序主题状态，建议用 `@media (prefers-color-scheme: light)` 跟随系统设置。
:::

## 排版

| 元素 | 字体 | 字号 | 字重 |
|---|---|---|---|
| 正文 | Segoe UI + Microsoft YaHei | 0.875rem (14px) | 400 |
| 标题 | 同上 | 1rem~1.25rem (16~20px) | 600 |
| 辅助文字 | 同上 | 0.75rem (12px) | 400 |
| 标签/uppercase | 同上 | 0.75rem | 600 + `text-transform: uppercase; letter-spacing: 0.05em` |

```css
body {
  font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
}
```

::: tip 字体回退链
`Segoe UI`（Win11 系统字体）优先，`Microsoft YaHei`（微软雅黑）保证中文显示，`system-ui` 作为其他系统兜底。
:::

## 间距系统（8px 网格）

| 用途 | 值 | 示例 |
|---|---|---|
| 微间距 | 4px | 图标与文字间隙 |
| 紧凑间距 | 8px | 卡片内元素间距 |
| 标准间距 | 12px / 16px | 列表项 padding、区块间距 |
| 宽松间距 | 20px / 24px | 页面 padding、大区块间距 |
| 超宽间距 | 32px | 页面主区块间距 |

## 圆角

| 元素 | 圆角 |
|---|---|
| 卡片/面板 | 8px |
| 按钮/输入框 | 6px |
| 小标签/badge | 4px |
| 圆形元素 | 50% |

## 动画规范

```css
:root {
  --transition: 200ms ease;
  --ease-fluent: cubic-bezier(0.16, 1, 0.3, 1); /* Win11 Fluent 缓动 */
}
```

| 属性 | 时长 | 说明 |
|---|---|---|
| background / color | 200ms | hover/active 颜色过渡 |
| opacity / transform | 200ms | 图标切换、元素显隐 |
| width / height | 100ms linear | 进度条、音量条实时更新 |
| 旋转动效 | 400ms | 模式切换等强调性动画 |

::: warning 兼容 30Hz 屏幕
避免高频闪烁、快速位移。200ms 是安全上限，复杂动画拆解为多段 200ms 过渡。
:::

## 触控目标

所有可点击元素（按钮、链接、列表项）的最小尺寸为 **48×48px**：

```css
/* ✅ 正确：按钮 48px */
.btn { width: 48px; height: 48px; }

/* ✅ 正确：列表项 padding 撑开触控区 */
.list-item { min-height: 48px; padding: 8px 12px; }

/* ❌ 错误：纯文字链接无 padding，难以点击 */
.link { /* 无 padding */ }
```

## 组件设计示例

### 按钮

```css
/* 主要按钮 */
.btn-primary {
  padding: 8px 16px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition);
  min-height: 36px;
}
.btn-primary:hover { background: var(--primary-hover); }
.btn-primary:active { background: var(--primary-active); }

/* 次要按钮（图标按钮） */
.btn-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text);
  cursor: pointer;
  transition: all var(--transition);
}
.btn-icon:hover { background: var(--bg-card-hover); color: var(--primary); }
```

### 卡片/列表项

```css
.card {
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: background var(--transition);
}
.card:hover { background: var(--bg-card-hover); }
.card.active { background: var(--bg-active); border-color: var(--primary); }
```

### 进度条/滑块

```css
/* 关键：用伪元素扩大点击区域 */
.progress-bar {
  height: 6px;
  background: var(--border-strong);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  transition: height var(--transition);
}
/* 透明区域扩大点击范围，解决细进度条难以拖拽的问题 */
.progress-bar::before {
  content: '';
  position: absolute;
  top: -8px; left: 0; right: 0; bottom: -8px;
}
.progress-bar:hover { height: 8px; }
.progress-filled {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 100ms linear;
}
```

### 输入框

```css
.input {
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color var(--transition);
  min-height: 36px;
}
.input:focus {
  outline: none;
  border-color: var(--primary);
}
```

## 图标规范

使用内联 SVG（lucide 风格），`stroke-width: 2`，`viewBox: 0 0 24 24`：

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="..."/>
</svg>
```

| 场景 | 尺寸 |
|---|---|
| 顶部栏标题图标 | 20×20px |
| 按钮内图标 | 16~24px |
| 列表项缩略图占位 | 20×20px |
| 空状态大图标 | 80×80px（opacity: 0.3） |

## iframe sandbox 注意事项

插件 iframe sandbox **不含 `allow-same-origin`**，以下操作会被拦截：

| 禁止操作 | 替代方案 |
|---|---|
| `localStorage` / `sessionStorage` | Rust .dll 持久化 |
| `file:///` 加载本地文件 | [`local-file` 协议](/api/bridge-api#本地文件加载-local-file-协议) |
| `fetch('file:///...')` | Rust .dll 读取 |
| `window.parent.document` | `postMessage` 通信 |

详见 [桥接 API - iframe 沙箱](/api/bridge-api#iframe-沙箱属性)。

## 沉浸式 UI

manifest 中设置 `hide_header: true` 可隐藏 iframe 上方标题栏，插件自行管理全部 UI：

```json
{
  "hide_header": true
}
```

::: warning 隐藏标题栏后
插件需自行提供返回按钮等导航。无导航的沉浸式插件会让用户无法返回设置页。
:::

## 参考实现

- **音乐播放器插件**（`examples/music-player/`）：完整演示本指南的所有规范，包括双栏布局、歌词滚动、按钮动画、进度条交互
