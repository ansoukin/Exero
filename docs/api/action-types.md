<VersionBadge />

# 内置动作类型参考

Exero 提供 21 种内置 ActionType，分为 6 大类。通过 manifest `"executor_type": "rust"` + `"executor_id": "<ActionType 变体名>"` 直接引用，无需编写任何代码。

::: tip 自定义？
内置类型不能满足业务需求时，写一个 Rust .dll 自定义动作。详见 [Rust SDK 参考](/api/sdk)。
:::

---

## 应用与文件类（AppAndFile）

### LaunchProgram（启动程序）

启动外部可执行程序。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `path` | string | ✅ | 可执行文件路径或命令（如 `"notepad.exe"`、`"C:\\App\\app.exe"`） |
| `args` | string[] | | 命令行参数数组（如 `["/max"]`） |
| `working_dir` | string | | 工作目录 |

```json
{
  "executor_type": "rust", "executor_id": "LaunchProgram",
  "default_params": {
    "path": "notepad.exe",
    "args": [],
    "working_dir": ""
  }
}
```

---

### KillProcess（关闭进程）

按进程名或 PID 结束进程。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `process_name` | string | | 进程名（不带 `.exe`，如 `"chrome"`） |
| `pid` | number | | 进程 ID。指定 pid 时忽略 process_name |
| `force` | boolean | | `true`=强行终止（任务管理器"结束任务"），默认 `true` |

---

### OpenUrl（打开网页）

用系统默认浏览器打开 URL。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 网页地址（如 `"https://exero.dev"`） |

---

### OpenFile（打开文件）

用系统默认程序打开文件/文件夹。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `path` | string | ✅ | 文件或文件夹路径 |

---

## 媒体与输入类（MediaAndInput）

### SetVolume（调节音量）

设置系统主音量。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `volume` | number | ✅ | 音量百分比 0-100 |

---

### PlaySound（播放声音）

播放本地音频文件。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `path` | string | ✅ | 音频文件路径（支持 wav/mp3） |
| `volume` | number | | 音量百分比 0-100，默认 100 |

---

### SimulateKey（模拟按键）

向当前活动窗口发送键盘按键。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | ✅ | 虚拟键名（如 `"A"`、`"Enter"`、`"F5"`、`"Ctrl+C"`） |
| `modifiers` | string[] | | 修饰键组合（`"ctrl"` / `"shift"` / `"alt"` / `"win"`） |

---

## 系统与电源类（SystemAndPower）

### Shutdown（关机）

关闭计算机。无参数。

---

### Reboot（重启）

重启计算机。无参数。

---

### LockScreen（锁屏）

锁定当前用户会话（Win+L 等价）。无参数。

---

### Hibernate（休眠）

进入休眠/睡眠状态。无参数。

---

### Logoff（注销）

注销当前用户。无参数。

---

### CleanTempFiles（清理临时文件）

清理系统临时目录（`%TEMP%`、`C:\Windows\Temp`）。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `include_user_temp` | boolean | | 是否包含用户 Temp 目录，默认 `true` |
| `include_windows_temp` | boolean | | 是否包含 Windows Temp 目录，默认 `true` |

---

### SwitchPowerPlan（切换电源计划）

切换 Windows 电源计划。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `plan` | string | ✅ | `"高性能"` / `"平衡"` / `"节能"` 或 GUID |

---

## 通知类（Notification）

### ShowToast（Toast 通知）

发送 Windows Toast 通知（右下角）。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | ✅ | 通知标题 |
| `message` | string | ✅ | 通知正文 |
| `icon_path` | string | | 自定义图标路径 |

---

### ShowInAppNotification（应用内通知）

发送 Exero 主窗口内通知（右上角滑入）。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `level` | string | ✅ | `"info"` / `"warning"` / `"error"` / `"success"` |
| `title` | string | ✅ | 通知标题 |
| `body` | string | ✅ | 通知正文 |

---

## 控制流类（ControlFlow）

### IfElse（条件分支）

根据条件执行不同分支。需要 2 个输出端口：

```json
{
  "ports": {
    "inputs": [{ "id": "trigger", "position": "top" }],
    "outputs": [
      { "id": "then", "position": "right", "label": "满足" },
      { "id": "else", "position": "left",  "label": "不满足" }
    ]
  }
}
```

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `condition` | string | ✅ | 条件表达式（如 `"{var_a} > 10"`），支持变量插值 |

---

### Loop（循环）

重复执行循环体。需要 2 个输出端口：

```json
{
  "ports": {
    "inputs": [
      { "id": "trigger",   "position": "top" },
      { "id": "iteration", "position": "left", "label": "循环体返回" }
    ],
    "outputs": [
      { "id": "done",       "position": "bottom", "label": "完成" },
      { "id": "iteration",  "position": "right",  "label": "迭代" }
    ]
  }
}
```

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `times` | number | ✅ | 循环次数（正整数） |

---

### SetVariable（变量赋值）

在 Flow 执行上下文中写入局部变量（下一个动作可读）。

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 变量名 |
| `value` | any | ✅ | 变量值（支持字符串/数字/布尔/对象） |
| `global` | boolean | | `true` 写入全局共享池，默认 `false` |

---

## Lua 脚本类

### LuaScript（内联 Lua 脚本）

Flow 编辑器内置 Lua 节点（用户手写内联脚本，非扩展包加载）。参数与扩展包 Lua 动作一致：脚本内容通过 `content` 字段传入。

::: tip 扩展包 Lua 动作 vs 内联 LuaScript
- 扩展包 Lua：manifest `executor_type = "lua"`，脚本文件在 `.exero-pack` 内
- 内置 `LuaScript`：Flow 节点直接写脚本，参数通过 `content` 传递。普通用户用，扩展包开发者忽略
:::

### Extension（扩展动作）

框架层内部变体，格式为 `Extension("pack_id:action_id")`。
Exero 加载扩展包时自动映射，**用户和扩展开发者无需直接使用此枚举**。

---

## 速查表（按类别）

| 类别 | 动作（executor_id） |
|---|---|
| 应用与文件 | `LaunchProgram`、`KillProcess`、`OpenUrl`、`OpenFile` |
| 媒体与输入 | `SetVolume`、`PlaySound`、`SimulateKey` |
| 系统与电源 | `Shutdown`、`Reboot`、`LockScreen`、`Hibernate`、`Logoff`、`CleanTempFiles`、`SwitchPowerPlan` |
| 通知 | `ShowToast`、`ShowInAppNotification` |
| 控制流 | `IfElse`、`Loop`、`SetVariable` |
| 脚本 | `LuaScript`、`Extension`（内部） |

---

## Manifest 引用模板（动作包）

写动作包引用内置 ActionType 时复制下列模板（以 LaunchProgram 为例）：

```json
{
  "id": "launch-notepad",
  "executor_type": "rust",
  "executor_id": "LaunchProgram",
  "label": "启动记事本",
  "category": "app",
  "icon": "AppWindow",
  "default_params": { "path": "notepad.exe", "args": [] },
  "ports": {
    "inputs": [{ "id": "trigger", "position": "top" }],
    "outputs": [{ "id": "done", "position": "bottom" }]
  },
  "summarize_template": "启动 {path}"
}
```
