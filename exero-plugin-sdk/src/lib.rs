//! Exero Plugin SDK（Beta5 · Phase 2）
//!
//! 用于开发 Exero 扩展包的 Rust 动作和插件。
//! 通过 `declare_actions!` 宏自动生成 C ABI 导出函数，
//! Exero 主程序通过 libloading 加载 .dll 并调用这些函数。
//!
//! # 快速入门
//!
//! 1. 创建新的 Cargo 项目（crate-type = cdylib）：
//!    ```toml
//!    [lib]
//!    crate-type = ["cdylib"]
//!
//!    [dependencies]
//!    exero-plugin-sdk = "0.1"
//!    serde_json = "1"
//!    ```
//!
//! 2. 编写动作处理函数并用 `declare_actions!` 注册：
//!    ```rust,no_run
//!    use exero_plugin_sdk::{declare_actions, Params};
//!    use serde_json::json;
//!
//!    fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
//!        Ok(json!({ "message": "Hello from Rust!" }))
//!    }
//!
//!    fn add(params: Params) -> Result<serde_json::Value, String> {
//!        let a: i64 = params.get("a")?;
//!        let b: i64 = params.get("b")?;
//!        Ok(json!({ "sum": a + b }))
//!    }
//!
//!    declare_actions! {
//!        "say_hello" => say_hello,
//!        "add" => add,
//!    }
//!    ```
//!
//! 3. 编译为 .dll：`cargo build --release --target x86_64-pc-windows-msvc`
//!
//! 4. 将 .dll 和 manifest.json 打包为 .exero-pack（zip），通过 Exero 市场安装
//!
//! # C ABI 接口
//!
//! `declare_actions!` 宏生成以下 4 个导出函数（无需手动编写）：
//! - `exero_pack_init() -> i32`：加载时调用，返回 0 表示成功
//! - `exero_pack_cleanup()`：卸载时调用
//! - `exero_execute_action(action_id, params_json) -> *const c_char`：执行动作
//! - `exero_last_error() -> *const c_char`：获取最近一次错误信息
//!
//! # 动作返回值约定
//!
//! - 成功：返回 `Ok(serde_json::Value)`，序列化为 JSON 字符串返回给 Exero
//! - 失败：返回 `Err(String)`，错误信息通过 `exero_last_error` 获取

/// 动作参数封装
///
/// 包装 Exero 传入的 JSON 参数，提供类型安全的访问方法。
pub struct Params {
    value: serde_json::Value,
}

impl Params {
    /// 从 JSON 值创建参数
    pub fn new(value: serde_json::Value) -> Self {
        Self { value }
    }

    /// 获取必填参数
    ///
    /// 参数缺失或类型不匹配时返回 Err。
    pub fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<T, String> {
        let val = self
            .value
            .get(key)
            .ok_or_else(|| format!("缺少参数: {}", key))?;
        serde_json::from_value(val.clone())
            .map_err(|e| format!("参数 {} 类型错误: {}", key, e))
    }

    /// 获取可选参数
    ///
    /// 参数缺失或类型不匹配时返回 None。
    pub fn get_optional<T: serde::de::DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.value
            .get(key)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }

    /// 获取原始 JSON 值
    pub fn raw(&self) -> &serde_json::Value {
        &self.value
    }
}

/// 声明动作注册表并生成 C ABI 导出函数
///
/// # 语法
///
/// ```ignore
/// declare_actions! {
///     "action_id" => handler_fn,
///     ...
/// }
/// ```
///
/// - 键：动作 id（字符串字面量，对应 manifest.json 中 `actions[].id`）
/// - 值：处理函数路径，签名为 `fn(Params) -> Result<serde_json::Value, String>`
///
/// # 生成的函数
///
/// - `exero_pack_init` / `exero_pack_cleanup` / `exero_execute_action` / `exero_last_error`
///
/// # 线程安全
///
/// 返回字符串通过 thread_local 存储，Exero 在调用后立即复制为 Rust String，
/// 下次调用会覆盖旧值。跨线程调用时每个线程有独立的 thread_local 缓冲区。
#[macro_export]
macro_rules! declare_actions {
    ($($action_id:literal => $handler:path),* $(,)?) => {
        /// 线程本地：上次执行结果（返回给 Exero 的 JSON 字符串）
        thread_local! {
            static EXERO_LAST_RESULT: std::cell::RefCell<Option<std::ffi::CString>> =
                std::cell::RefCell::new(None);
            static EXERO_LAST_ERROR: std::cell::RefCell<Option<std::ffi::CString>> =
                std::cell::RefCell::new(None);
        }

        /// 记录错误信息到 thread_local
        fn exero_set_error(msg: String) {
            let c_str = std::ffi::CString::new(msg)
                .unwrap_or_else(|_| std::ffi::CString::new("error").unwrap());
            EXERO_LAST_ERROR.with(|e| {
                *e.borrow_mut() = Some(c_str);
            });
        }

        /// 加载时调用，返回 0 表示成功
        #[no_mangle]
        pub extern "C" fn exero_pack_init() -> i32 {
            0
        }

        /// 卸载时调用
        #[no_mangle]
        pub extern "C" fn exero_pack_cleanup() {}

        /// 执行动作
        ///
        /// - `action_id`：动作标识（对应 manifest actions[].id）
        /// - `params_json`：JSON 格式的参数字符串
        /// - 返回：JSON 格式的结果字符串，NULL 表示出错（用 exero_last_error 获取）
        #[no_mangle]
        pub unsafe extern "C" fn exero_execute_action(
            action_id: *const std::os::raw::c_char,
            params_json: *const std::os::raw::c_char,
        ) -> *const std::os::raw::c_char {
            use std::ffi::CStr;

            // 解析 action_id
            if action_id.is_null() {
                exero_set_error("action_id is null".to_string());
                return std::ptr::null();
            }
            let action_id_str = match CStr::from_ptr(action_id).to_str() {
                Ok(s) => s,
                Err(e) => {
                    exero_set_error(format!("action_id UTF-8 error: {}", e));
                    return std::ptr::null();
                }
            };

            // 解析 params_json
            let params_value = if params_json.is_null() {
                serde_json::Value::Object(serde_json::Map::new())
            } else {
                match CStr::from_ptr(params_json).to_str() {
                    Ok(s) => match serde_json::from_str::<serde_json::Value>(s) {
                        Ok(v) => v,
                        Err(e) => {
                            exero_set_error(format!("params JSON parse error: {}", e));
                            return std::ptr::null();
                        }
                    },
                    Err(e) => {
                        exero_set_error(format!("params UTF-8 error: {}", e));
                        return std::ptr::null();
                    }
                }
            };

            let params = $crate::Params::new(params_value);

            // 路由到 handler
            let result: Result<serde_json::Value, String> = match action_id_str {
                $($action_id => $handler(params),)*
                _ => Err(format!("unknown action: {}", action_id_str)),
            };

            match result {
                Ok(output) => {
                    let json = match serde_json::to_string(&output) {
                        Ok(s) => s,
                        Err(e) => {
                            exero_set_error(format!("result serialize error: {}", e));
                            return std::ptr::null();
                        }
                    };
                    let c_str = match std::ffi::CString::new(json) {
                        Ok(s) => s,
                        Err(e) => {
                            exero_set_error(format!("result contains null byte: {}", e));
                            return std::ptr::null();
                        }
                    };
                    let ptr = c_str.as_ptr();
                    EXERO_LAST_RESULT.with(|r| {
                        *r.borrow_mut() = Some(c_str);
                    });
                    ptr
                }
                Err(e) => {
                    exero_set_error(e);
                    std::ptr::null()
                }
            }
        }

        /// 获取最近一次错误信息
        ///
        /// 返回 NULL 表示无错误信息。
        #[no_mangle]
        pub extern "C" fn exero_last_error() -> *const std::os::raw::c_char {
            EXERO_LAST_ERROR.with(|e| {
                let borrow = e.borrow();
                match &*borrow {
                    Some(c_str) => c_str.as_ptr(),
                    None => std::ptr::null(),
                }
            })
        }
    };
}
