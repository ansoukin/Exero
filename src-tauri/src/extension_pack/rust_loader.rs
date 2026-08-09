//! Rust .dll 动态加载器（Beta5 · Phase 2）
//!
//! 使用 libloading 运行时加载扩展包的 Rust 动态库（.dll），
//! 通过 C ABI 接口调用，保证 ABI 稳定性（Rust 自身 ABI 不稳定）。
//!
//! C ABI 接口（由 exero-plugin-sdk 宏自动生成，用户不直接编写）：
//! - `exero_pack_init() -> i32`：加载时调用，返回 0 表示成功
//! - `exero_pack_cleanup()`：卸载时调用（可选符号）
//! - `exero_execute_action(action_id, params_json) -> *const c_char`：执行动作
//! - `exero_last_error() -> *const c_char`：获取最近一次错误信息（可选符号）
//!
//! 安全模型（SPEC 6.5.2）：
//! - .dll 加载无沙箱隔离，可完全访问系统（与 Lua 宽松沙箱同级风险）
//! - .dll 必须编译为 `x86_64-pc-windows-msvc` 目标
//! - .dll 内部状态由 .dll 自身负责线程安全
//!
//! 内存约定：
//! - `exero_execute_action` 返回的 `const char*` 由 .dll 内部分配并持有所有权
//! - 调用方（本模块）立即复制为 Rust String，不负责释放原指针
//! - 若 .dll 使用 malloc 分配返回字符串且不释放，内存泄漏由 .dll 负责

use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::path::Path;

use libloading::Library;
use parking_lot::RwLock;

use crate::error::{AppError, Result};

// C ABI 函数类型签名
type ExeroPackInitFn = unsafe extern "C" fn() -> i32;
type ExeroPackCleanupFn = unsafe extern "C" fn();
type ExeroExecuteActionFn = unsafe extern "C" fn(*const c_char, *const c_char) -> *const c_char;
type ExeroLastErrorFn = unsafe extern "C" fn() -> *const c_char;

/// Rust .dll 动态库注册表
///
/// 按 `pack_id` 索引已加载的 .dll，提供加载/卸载/执行接口。
/// 由 AppState 持有，在扩展包加载时调用。
///
/// 线程安全：`RwLock<HashMap>` 保护并发访问，读操作（execute）不阻塞彼此。
/// .dll 内部的线程安全由 .dll 自身负责（SPEC 约定）。
pub struct RustLibraryRegistry {
    /// pack_id -> 已加载的 .dll 库
    libraries: RwLock<HashMap<String, Library>>,
}

impl RustLibraryRegistry {
    /// 创建空注册表
    pub fn new() -> Self {
        Self {
            libraries: RwLock::new(HashMap::new()),
        }
    }

    /// 加载 .dll 并调用 `exero_pack_init`
    ///
    /// 若 `pack_id` 已存在则先卸载旧的再加载新的（用于更新场景）。
    pub fn load(&self, pack_id: &str, dll_path: &Path) -> Result<()> {
        // 先卸载已存在的（避免重复加载导致 .dll 文件占用）
        if self.libraries.read().contains_key(pack_id) {
            self.unload(pack_id)?;
        }

        tracing::info!(
            "加载 Rust 动态库: pack_id={} path={}",
            pack_id,
            dll_path.display()
        );

        // libloading 0.8: Library::new 标记为 unsafe（加载外部 .dll 是 inherently unsafe）
        let library = unsafe { Library::new(dll_path) }
            .map_err(|e| AppError::Other(format!("加载 .dll 失败: {}", e)))?;

        // 调用 exero_pack_init（必须符号）
        let init_fn: libloading::Symbol<ExeroPackInitFn> =
            unsafe { library.get(b"exero_pack_init\0") }
                .map_err(|e| AppError::Other(format!("找不到 exero_pack_init 符号: {}", e)))?;

        let init_result = unsafe { init_fn() };
        if init_result != 0 {
            // 尝试获取错误信息
            let err_msg = Self::get_last_error_of(&library).unwrap_or_else(|| {
                format!("exero_pack_init 返回非零值: {}", init_result)
            });
            return Err(AppError::Other(format!(
                "Rust 动态库初始化失败 (pack_id={}): {}",
                pack_id, err_msg
            )));
        }

        self.libraries.write().insert(pack_id.to_string(), library);
        tracing::info!("Rust 动态库加载成功: pack_id={}", pack_id);
        Ok(())
    }

    /// 卸载 .dll 并调用 `exero_pack_cleanup`
    ///
    /// `exero_pack_cleanup` 为可选符号，不存在时跳过。
    /// Library drop 时触发 Windows `FreeLibrary`。
    pub fn unload(&self, pack_id: &str) -> Result<()> {
        let library = self.libraries.write().remove(pack_id);
        if let Some(lib) = library {
            tracing::info!("卸载 Rust 动态库: pack_id={}", pack_id);
            // 调用 exero_pack_cleanup（可选符号，不存在则跳过）
            if let Ok(cleanup_fn) = unsafe {
                lib.get::<ExeroPackCleanupFn>(b"exero_pack_cleanup\0")
            } {
                unsafe { cleanup_fn() };
            }
            // lib 在此处 drop，触发 FreeLibrary
            drop(lib);
        }
        Ok(())
    }

    /// 卸载所有 .dll（应用退出时调用）
    pub fn unload_all(&self) {
        let pack_ids: Vec<String> = self.libraries.read().keys().cloned().collect();
        for pack_id in pack_ids {
            let _ = self.unload(&pack_id);
        }
    }

    /// 执行动作
    ///
    /// 调用 .dll 的 `exero_execute_action`，返回 JSON 结果字符串。
    /// 返回 NULL 时通过 `exero_last_error` 获取错误信息。
    pub fn execute(&self, pack_id: &str, action_id: &str, params_json: &str) -> Result<String> {
        let libraries = self.libraries.read();
        let library = libraries.get(pack_id).ok_or_else(|| {
            AppError::Other(format!("未加载的 Rust 动态库: pack_id={}", pack_id))
        })?;

        let execute_fn: libloading::Symbol<ExeroExecuteActionFn> =
            unsafe { library.get(b"exero_execute_action\0") }.map_err(|e| {
                AppError::Other(format!("找不到 exero_execute_action 符号: {}", e))
            })?;

        // Rust 字符串 -> C 字符串（不能包含内部 null 字节）
        let action_c = CString::new(action_id)
            .map_err(|e| AppError::Other(format!("action_id 包含内部 null 字节: {}", e)))?;
        let params_c = CString::new(params_json)
            .map_err(|e| AppError::Other(format!("params_json 包含内部 null 字节: {}", e)))?;

        // 调用 .dll 函数
        let result_ptr = unsafe { execute_fn(action_c.as_ptr(), params_c.as_ptr()) };

        if result_ptr.is_null() {
            let err_msg = Self::get_last_error_of(library).unwrap_or_else(|| {
                "exero_execute_action 返回 NULL 且无错误信息".to_string()
            });
            return Err(AppError::ActionExecution(format!(
                "Rust 动作执行失败 (pack_id={} action_id={}): {}",
                pack_id, action_id, err_msg
            )));
        }

        // C 字符串 -> Rust String（复制，原指针由 .dll 持有）
        let result_str = unsafe { CStr::from_ptr(result_ptr) }
            .to_str()
            .map_err(|e| AppError::Other(format!("结果字符串 UTF-8 转换失败: {}", e)))?
            .to_string();

        Ok(result_str)
    }

    /// 检查指定 pack_id 的 .dll 是否已加载
    pub fn is_loaded(&self, pack_id: &str) -> bool {
        self.libraries.read().contains_key(pack_id)
    }

    /// 获取 .dll 的最近错误信息（内部辅助）
    ///
    /// `exero_last_error` 为可选符号，不存在时返回 None。
    fn get_last_error_of(library: &Library) -> Option<String> {
        let error_fn: libloading::Symbol<ExeroLastErrorFn> =
            unsafe { library.get(b"exero_last_error\0") }.ok()?;

        let error_ptr = unsafe { error_fn() };
        if error_ptr.is_null() {
            return None;
        }

        let error_str = unsafe { CStr::from_ptr(error_ptr) }
            .to_str()
            .ok()?
            .to_string();
        Some(error_str)
    }
}

impl Default for RustLibraryRegistry {
    fn default() -> Self {
        Self::new()
    }
}
