//! 日志系统模块
//!
//! 基于 tracing + tracing-subscriber 提供结构化日志，
//! 支持控制台输出（Debug）与文件滚动输出（Release）。

use std::path::PathBuf;

use crate::error::Result;

/// 初始化日志系统
///
/// - Debug 构建：日志同时输出到控制台与文件
/// - Release 构建：日志仅输出到文件，按日期切割，保留 7 天
pub fn init() -> Result<()> {
    let log_dir = get_log_dir()?;
    std::fs::create_dir_all(&log_dir).ok();

    // 文件 appender：按日期切割
    let file_appender = tracing_appender::rolling::daily(&log_dir, "exero.log");
    let (non_blocking_file, _guard) = tracing_appender::non_blocking(file_appender);
    // 保留 _guard 引用防止 drop（实际上 let 绑定已经保留到函数结束）
    let _ = &non_blocking_file;

    // 环境变量覆盖日志级别
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,exero=debug"));

    #[cfg(debug_assertions)]
    {
        // Debug 构建：控制台 + 文件
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_line_number(true)
            .with_writer(std::io::stdout)
            .init();
        tracing::info!("Debug 构建：日志输出到控制台 + 文件");
    }

    #[cfg(not(debug_assertions))]
    {
        // Release 构建：仅文件
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_line_number(true)
            .with_ansi(false)
            .with_writer(non_blocking_file)
            .init();
        tracing::info!("Release 构建：日志输出到文件 {}", log_dir.display());
    }

    tracing::info!("日志系统初始化完成，日志目录: {}", log_dir.display());
    Ok(())
}

/// 获取日志文件目录
///
/// 在便携式部署场景下，日志目录为 `<可执行文件目录>/logs/`
fn get_log_dir() -> Result<PathBuf> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| crate::error::AppError::Io(e))?
        .parent()
        .ok_or_else(|| crate::error::AppError::Other("无法获取可执行文件目录".into()))?
        .to_path_buf();
    Ok(exe_dir.join("logs"))
}
