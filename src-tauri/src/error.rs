//! 错误处理模块
//!
//! 定义应用统一错误类型，结合 anyhow 与 thiserror 提供灵活的错误处理。

use thiserror::Error;

/// 应用统一错误类型
///
/// 使用 thiserror 派生 Error trait，提供类型化错误，
/// 同时通过 `#[from]` 自动转换底层错误。
#[derive(Debug, Error)]
pub enum AppError {
    /// 数据库错误
    #[error("数据库错误: {0}")]
    Database(#[from] rusqlite::Error),

    /// 数据库迁移错误
    #[error("数据库迁移错误: {0}")]
    Migration(#[from] refinery::Error),

    /// 序列化错误
    #[error("序列化错误: {0}")]
    Serde(#[from] serde_json::Error),

    /// IO 错误
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    /// Tauri 错误
    ///
    /// 注意：不使用 `#[from] tauri::Error`，因为 `tauri::Error` 部分变体包含
    /// `Box<dyn StdError + 'static>`（未约束 Send+Sync），会导致整个 `AppError`
    /// 无法跨线程传递（spawn_blocking / tokio::spawn 等场景需要 Send）。
    /// 改为存储字符串形式，手动实现 `From<tauri::Error>`。
    #[error("Tauri 错误: {0}")]
    Tauri(String),

    /// 时间解析错误
    #[error("时间解析错误: {0}")]
    Chrono(#[from] chrono::ParseError),

    /// Cron 表达式错误
    #[error("Cron 表达式错误: {0}")]
    Cron(#[from] cron::error::Error),

    /// Lua 错误
    ///
    /// 注意：不使用 `#[from] mlua::Error`，因为 `mlua::Error` 部分变体包含
    /// `Arc<dyn StdError + 'static>`（未约束 Send+Sync），会导致整个 `AppError`
    /// 无法跨线程传递（spawn_blocking / tokio::spawn 等场景需要 Send）。
    /// 改为存储字符串形式，手动实现 `From<mlua::Error>`。
    #[error("Lua 错误: {0}")]
    LuaError(String),

    /// Windows API 错误
    #[error("Windows API 错误: {0}")]
    Windows(String),

    /// 动作执行错误
    #[error("动作执行错误: {0}")]
    ActionExecution(String),

    /// 触发器错误
    #[error("触发器错误: {0}")]
    Trigger(String),

    /// 参数错误
    #[error("参数错误: {0}")]
    InvalidArgument(String),

    /// 未找到资源
    #[error("未找到资源: {0}")]
    NotFound(String),

    /// Lua 脚本错误
    #[error("Lua 脚本错误: {0}")]
    Lua(String),

    /// 其他错误（兜底）
    #[error("{0}")]
    Other(String),
}

/// 应用统一 Result 类型别名
pub type Result<T> = std::result::Result<T, AppError>;

/// 将任意错误转换为 AppError::Other
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Other(err.to_string())
    }
}

/// 手动将 `tauri::Error` 转换为 `AppError::Tauri(String)`
///
/// 避免 `#[from]` 导致 `AppError` 失去 `Send + Sync` 约束。
impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::Tauri(err.to_string())
    }
}

/// 手动将 `mlua::Error` 转换为 `AppError::LuaError(String)`
///
/// 避免 `#[from]` 导致 `AppError` 失去 `Send + Sync` 约束
/// （`mlua::Error` 包含 `Arc<dyn StdError + 'static>` 未约束 Send+Sync）。
impl From<mlua::Error> for AppError {
    fn from(err: mlua::Error) -> Self {
        AppError::LuaError(err.to_string())
    }
}

/// 手动将 `reqwest::Error` 转换为 `AppError::Other(String)`
///
/// Phase 5：Lua 脚本市场需要 HTTP 请求 GitHub API。
/// 采用 String 包装策略（与 tauri::Error / mlua::Error 一致），
/// 避免 `#[from]` 可能引入的 Send+Sync 约束问题。
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Other(format!("HTTP 请求错误: {}", err))
    }
}

/// 为 Tauri 命令提供序列化支持
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
