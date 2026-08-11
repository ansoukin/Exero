<VersionBadge />

# Rust SDK 参考（exero-plugin-sdk）

`exero-plugin-sdk` crate 提供 `Params` 类型和 `declare_actions!` 宏，用于编写 Exero 扩展包的 Rust `.dll` 动作。

Crate 位置：`e:\Project\Exero\exero-plugin-sdk\`

---

## 在 Cargo.toml 中引入

```toml
[lib]
crate-type = ["cdylib"]    # 编译为 Windows .dll（C ABI）

[dependencies]
exero-plugin-sdk = { path = "../../exero-plugin-sdk" }
serde_json = "1"
```

::: tip path 计算
相对路径从插件 `Cargo.toml` 所在目录到 `exero-plugin-sdk` crate 根目录。常用参照：
- `examples/hello-plugin/Cargo.toml` → `../../exero-plugin-sdk`
- `Market/plugins/my-plugin/Cargo.toml` → `../../exero-plugin-sdk`
:::

---

## 类型 `Params`

封装 Exero 传入的 JSON 参数，提供类型安全的访问。

```rust
use exero_plugin_sdk::Params;

fn my_action(params: Params) -> Result<serde_json::Value, String> {
    // 必填：缺或类型错误时返回 Err(String)
    let path: String = params.get("path")?;

    // 可选：缺或类型错误时返回 None（不报错）
    let count: Option<i64> = params.get_optional("count");

    // 原始 JSON：完整访问
    let raw = params.raw();

    Ok(serde_json::json!({ "echo": path }))
}
```

### 方法表

| 方法 | 签名 | 说明 |
|---|---|---|
| `Params::new(value)` | `fn(Value) -> Self` | 从 `serde_json::Value` 创建（SDK 内部使用） |
| `params.get::<T>(key)` | `fn(&str) -> Result<T, String>` | 获取必填参数。T 需实现 `DeserializeOwned` |
| `params.get_optional::<T>(key)` | `fn(&str) -> Option<T>` | 获取可选参数，容错为 None |
| `params.raw()` | `fn() -> &Value` | 获取原始 JSON 引用，可手动访问嵌套字段 |

### 常用 T 类型

| Rust 类型 | 对应 JSON |
|---|---|
| `String` | 字符串 |
| `bool` | boolean |
| `i64` / `i32` / `u64` | 整数 |
| `f64` | 浮点数 |
| `serde_json::Value` | 任意 JSON（嵌套结构兜底） |
| `Vec<T>` | 数组 |
| 自定义 struct（加 `#[derive(Deserialize)]`） | 对象 |

::: tip 复杂对象
参数是嵌套结构时，用 `params.raw()` + `serde_json::from_value` 反序列化到自定义 struct 更清晰。
:::

---

## 宏 `declare_actions!`

声明动作注册表并**自动生成 C ABI 导出函数**。这是插件 SDK 的核心，手动写 C 导出函数易错且繁琐。

### 语法

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

fn add(params: Params) -> Result<serde_json::Value, String> {
    let a: i64 = params.get("a")?;
    let b: i64 = params.get("b")?;
    Ok(json!({ "sum": a + b }))
}

declare_actions! {
    "hello" => hello,
    "add"   => add,
    // 支持尾逗号
}
```

| 位置 | 含义 |
|---|---|
| 键（字符串字面量） | 动作 ID，需与 manifest `actions[].id` 一致 |
| 值（函数路径） | 处理函数，签名为 `fn(Params) -> Result<Value, String>` |

---

## 自动生成的 C ABI 导出函数

宏 `declare_actions!` 自动生成并导出以下 4 个函数。**不要手动重写**。

### `exero_pack_init() -> i32`

| 项 | 说明 |
|---|---|
| 调用时机 | .dll 被 libloading 加载后立即调用 1 次 |
| 返回值 | `0` = 成功，非 `0` = 失败（SDK 默认恒返回 0） |
| 用途 | 预留初始化钩子：全局状态、日志、连接外部资源等 |

### `exero_pack_cleanup() -> void`

| 项 | 说明 |
|---|---|
| 调用时机 | .dll 卸载前调用 1 次（Exero 退出或用户卸载插件时） |
| 返回值 | 无 |
| 用途 | 预留清理钩子：释放线程、关闭句柄等 |

### `exero_execute_action(action_id: *const c_char, params_json: *const c_char) -> *const c_char`

执行动作的主入口。

| 参数 | 说明 |
|---|---|
| `action_id` | C 字符串（UTF-8）：动作 ID，对应宏中注册的键 |
| `params_json` | C 字符串（UTF-8 JSON）：参数对象。可传 NULL，视为 `{}` |

| 返回 | 说明 |
|---|---|
| 非 NULL `*const c_char` | JSON 字符串结果（成功）。Exero 读取后立即复制 |
| NULL | 执行出错。通过 `exero_last_error()` 获取错误信息 |

SDK 内部自动完成：
- UTF-8 校验
- JSON 反序列化 → `Params`
- 根据 `action_id` 路由到处理函数
- 成功结果序列化为 JSON → CString，存入 `thread_local`
- 错误信息存入 `thread_local` 错误缓冲区

### `exero_last_error() -> *const c_char`

| 项 | 说明 |
|---|---|
| 调用时机 | `exero_execute_action` 返回 NULL 后调用 |
| 返回 | NULL = 无错误；非 NULL = 错误字符串（UTF-8） |

---

## 线程安全模型

返回值通过 `thread_local!` 存储（SDK 宏内部实现）：

```rust
// 等价于宏生成的伪代码
thread_local! {
    static EXERO_LAST_RESULT: RefCell<Option<CString>> = RefCell::new(None);
    static EXERO_LAST_ERROR:  RefCell<Option<CString>> = RefCell::new(None);
}
```

| 特性 | 说明 |
|---|---|
| 每个线程独立缓冲区 | 多线程并发调用时互不干扰 |
| 同一线程下次调用覆盖 | Exero 在 `exero_execute_action` 返回后**立即**复制结果为 Rust String |
| 指针有效期 | 到下一次调用前有效。Exero 遵循"立即复制"约定 |

**禁止**的行为：
- 在 handler 中再发起 `exero_execute_action`（重入会覆盖缓冲区）
- 保存返回的 `*const c_char` 指针超过 1 个调用周期

---

## 约定与最佳实践

### 动作处理函数签名

```rust
fn handler(params: Params) -> Result<serde_json::Value, String>
//                                       ^^^^^          ^^^^^^
//                              成功返回 JSON     错误消息（任意字符串）
```

### 成功路径

返回 `Ok(serde_json::Value)`：
- 可序列化任意 JSON（对象、数组、字符串、null）
- 推荐结构：`{ status: "ok", data: ... }`（便于前端消费）

```rust
Ok(json!({
    "status": "ok",
    "data": {
        "files": files,
        "count": files.len()
    }
}))
```

### 错误路径

返回 `Err(String)`：
- 错误信息通过 `exero_last_error` 暴露
- 前端 `window.exero.invoke` reject 时拿到 `Error(message)`

```rust
// 推荐：带上下文，方便前端精确定位
return Err(format!(
    "找不到文件: {} (工作目录: {})",
    path,
    std::env::current_dir()?.display()
));
```

### .dll 目标

```powershell
$env:CARGO_TARGET_DIR="C:\cargo-target-dominate"
cargo build --release       # 默认目标 x86_64-pc-windows-msvc
```

- 必须 **x86_64-pc-windows-msvc** 目标（匹配 Exero 主程序架构）
- `crate-type = ["cdylib"]`（非 `staticlib`，非 `rlib`）
- 产物名：Cargo `name` 中的 `-` 自动转为 `_`（`hello-plugin` → `hello_plugin.dll`）

---

## 最小完整示例

```rust
// src/lib.rs
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn greeting(params: Params) -> Result<serde_json::Value, String> {
    let name: String = params.get("name").unwrap_or_else(|_| "World".to_string());
    Ok(json!({
        "message": format!("Hello, {}!", name),
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

fn divide(params: Params) -> Result<serde_json::Value, String> {
    let a: f64 = params.get("a")?;
    let b: f64 = params.get("b")?;
    if b.abs() < 1e-9 {
        return Err("除数不能为零".to_string());
    }
    Ok(json!({ "result": a / b }))
}

declare_actions! {
    "greeting" => greeting,
    "divide" => divide,
}
```

Cargo.toml 加 chrono 依赖（示例需要时间戳）：
```toml
chrono = { version = "0.4", features = ["serde"] }
```

---

## Manifest 对应关系

```json
{
  "rust_library": "hello_plugin.dll",
  "actions": [
    {
      "id": "greeting",
      "executor_type": "rust",
      "executor_id": "greeting",
      "..."
    },
    {
      "id": "divide",
      "executor_type": "rust",
      "executor_id": "divide",
      "..."
    }
  ]
}
```

| Manifest 字段 | Rust SDK 关联 |
|---|---|
| `actions[].id` | 必须匹配 `declare_actions!` 键 |
| `actions[].executor_type` | 固定 `"rust"` |
| `actions[].executor_id` | 建议与 `actions[].id` 相同（SDK 以 `actions[].id` 路由） |
| `rust_library` | `.dll` 路径，必须与 Cargo 产物一致（name 中的 `-` → `_`） |

---

## 下一步

- [插件开发指南 → Rust .dll 开发](/guides/plugin.html#rust-dll-开发)
- [Manifest 字段参考](/api/manifest)
- [调试与排错 → Rust .dll 调试](/troubleshooting)
