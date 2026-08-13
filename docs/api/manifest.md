<VersionBadge />

# Manifest 字段参考

本文档是 `manifest.json` 的完整字段参考，适用于**动作包**（`pack_type: action`）和**插件**（`pack_type: plugin`）。

::: tip 快速上手
想先看最小示例？跳到 [快速入门 → Manifest 编写](/guides/action-pack.html#manifest-编写)。
:::

## 根结构 ExtensionPackManifest

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `id` | string | ✅ | — | 扩展包唯一标识。仅小写字母、数字、`-`、`_`（如 `my-pack`、`hello-plugin`）。市场索引以 id 作为主键，修改 id 被视为新包 |
| `version` | string | ✅ | — | SemVer 版本号（如 `1.0.0`、`0.2.1-beta`）。市场用此判断可更新 |
| `name` | string | ✅ | — | 显示名（中文优先，用于侧边栏、市场卡片、设置列表） |
| `description` | string | | `""` | 一句话描述 |
| `author` | string | | `""` | 作者名或组织名 |
| `exero_api_version` | string | ✅ | — | 所需 Exero API 版本。当前为 `"0.4.0"`。版本不匹配时加载被拒绝 |
| `pack_type` | string | | `"action"` | 扩展包类型：`"action"`（动作包）或 `"plugin"`（插件） |
| `rust_library` | string | | 无 | Rust .dll 相对路径（如 `"my_pack.dll"`）。插件**必填**；动作包在需要自定义 Rust 动作时必填 |
| `actions` | ActionManifest[] | | `[]` | 动作声明列表。动作注册为 Flow 编辑器的可视化积木 |
| `sidebar` | SidebarManifest | | 无 | 侧边栏入口。**插件必填**，动作包不支持 |
| `ui` | UiManifest | | 无 | 前端入口声明。**插件必填**，动作包不支持 |
| `hide_header` | boolean | | `false` | 是否隐藏插件 iframe 上方的标题栏（插件名称+版本号信息条）。`true` 时插件需自行管理全部 UI（包括返回按钮等导航） |

---

## ActionManifest（动作声明）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `id` | string | ✅ | — | 动作唯一标识（扩展包内唯一） |
| `executor_type` | string | ✅ | — | 执行器类型：`"rust"` 或 `"lua"` |
| `executor_id` | string | ✅ | — | 执行器标识，含义取决于 executor_type（见下表） |
| `label` | string | ✅ | — | 动作显示名（中文） |
| `category` | string | ✅ | — | 类别：`app` / `media` / `system` / `notification` / `control` / `lua` |
| `icon` | string | | `"Code"` | lucide-react 图标名（如 `"AppWindow"`、`"Volume2"`） |
| `default_params` | object | | `{}` | 创建节点时的初始参数值 |
| `ports` | PortsManifest | | `{inputs:[],outputs:[]}` | 输入输出端口配置（见下节） |
| `summarize_template` | string | | `""` | 参数摘要模板（如 `"启动 {path}"`），变量用 `{param_name}` 占位 |
| `description` | string | | `""` | 动作描述，在节点详情面板显示 |
| `permissions` | string[] | | `[]` | Lua 沙箱权限声明（仅 Lua 动作）：`"io"`、`"os.execute"` 等 |
| `params` | ScriptParam[] | | `[]` | Lua 脚本参数定义（仅 Lua 动作），前端据此生成参数表单 |

### executor_id 含义映射

| executor_type | executor_id 含义 | 示例 |
|---|---|---|
| `rust`（无 rust_library） | 内置 ActionType 枚举变体名 | `"LaunchProgram"`、`"SetVolume"` |
| `rust`（有 rust_library） | `declare_actions!` 宏中注册的动作 id | `"say_hello"`、`"add"` |
| `lua` | 脚本相对路径 | `"scripts/hello.lua"` |

---

## PortsManifest（端口配置）

```json
{
  "inputs": [{ "id": "trigger", "position": "top" }],
  "outputs": [
    { "id": "done", "position": "bottom" },
    { "id": "then", "position": "right", "label": "满足" }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `inputs` | PortManifest[] | 输入端口列表 |
| `outputs` | PortManifest[] | 输出端口列表 |

### PortManifest

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 端口唯一标识（React Flow handle id） |
| `position` | string | ✅ | 位置：`top` / `bottom` / `left` / `right` |
| `label` | string | | 显示名（IfElse 的 then/else 标签、Loop 的 break/continue 标签） |

::: tip 惯例
- 触发入口用 `{ id: "trigger", position: "top" }`
- 成功出口用 `{ id: "done", position: "bottom" }`
- IfElse 分支用 `then`（right）和 `else`（left），两个 output
- Loop 出口用 `done`（bottom）和 `iteration`（right，循环体入口），2 个 output + 1 个 input
:::

---

## ScriptParam（Lua 参数定义）

前端根据此结构动态生成参数表单控件。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `name` | string | ✅ | — | 参数名（Lua 通过 `args.xxx` 访问） |
| `label` | string | ✅ | — | 表单显示标签 |
| `type` | string | ✅ | — | 参数类型：`string` / `number` / `boolean` / `select` |
| `default` | any | | 对应类型的零值 | 默认值 |
| `options` | string[] | | `[]` | `select` 类型的可选项 |
| `required` | boolean | | `false` | 是否必填 |

---

## SidebarManifest（侧边栏入口）

**插件独占能力**，动作包不支持。

```json
{
  "id": "my-plugin",
  "label": "My Plugin",
  "icon": "Puzzle",
  "page_type": "web"
}
```

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `id` | string | ✅ | — | 入口唯一标识（建议与插件 id 一致） |
| `label` | string | ✅ | — | 侧边栏显示名 |
| `icon` | string | ✅ | — | lucide-react 图标名（如 `"Puzzle"`、`"Calculator"`） |
| `page_type` | string | | `"detail"` | 页面类型：插件固定使用 `"web"`（iframe 页面） |

---

## UiManifest（插件前端入口）

```json
{ "entry": "index.html" }
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entry` | string | ✅ | 前端入口文件相对路径。iframe 加载为 `http://plugin.localhost/{pack_id}/{entry}` |

---

## PackType 枚举

| JSON 值 | 说明 |
|---|---|
| `"action"` | 动作包：提供 Flow 积木，可附带 Lua/Rust 动作 |
| `"plugin"` | 插件：提供侧边栏入口 + iframe UI + Rust .dll（可附带 Flow 积木） |

---

## ExecutorType 枚举

> Beta8 起：解析**大小写不敏感**，`"rust"`/`"Rust"`、`"lua"`/`"Lua"` 均被接受（历史包曾用大写）。建议统一使用小写。

| JSON 值 | 说明 |
|---|---|
| `"rust"` | 调用 Rust 执行器（内置 ActionType 或自定义 .dll） |
| `"lua"` | 执行 LuaJIT 脚本 |

---

## 版本兼容性

| 字段 | 引入版本 | 说明 |
|---|---|---|
| `pack_type: "plugin"` | Beta5 Phase3 | 插件形态 |
| `sidebar` / `ui` | Beta5 Phase3 | 插件专属字段 |
| `rust_library` | Beta5 | 自定义 .dll 动作支持 |
| `actions[].params` | Beta5 | Lua 参数表单定义 |
| `actions[].permissions` | Beta5 | Lua 沙箱权限声明 |
