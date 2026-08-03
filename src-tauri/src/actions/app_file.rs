//! 应用与文件类动作执行器
//!
//! 包含：启动程序 / 关闭进程 / 打开网页 / 打开文件

use serde_json::Value;
use sysinfo::{Pid, ProcessesToUpdate, Signal, System};

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::{
    KillProcessParams, LaunchProgramParams, OpenFileParams, OpenUrlParams,
};
use crate::models::common::ActionType;

/// 启动程序执行器
pub struct LaunchProgramExecutor;

impl ActionExecutor for LaunchProgramExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::LaunchProgram
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: LaunchProgramParams = serde_json::from_value(params.clone())?;
        let path = ctx.interpolate(&p.path);
        let args = p.args.as_ref().map(|a| ctx.interpolate(a));

        tracing::info!("启动程序: {} args={:?}", path, args);

        // 使用 std::process::Command 启动（脱离父进程）
        let mut cmd = std::process::Command::new(&path);
        if let Some(args_str) = &args {
            // 简单按空格分割，复杂场景可考虑 shlex
            for arg in args_str.split_whitespace() {
                cmd.arg(arg);
            }
        }
        if let Some(workdir) = &p.working_dir {
            cmd.current_dir(ctx.interpolate(workdir));
        }

        // 启动后立即脱离（不等待）
        cmd.spawn().map_err(|e| {
            AppError::ActionExecution(format!("启动程序失败 {}: {}", path, e))
        })?;

        Ok(ActionResult::success(format!("已启动程序: {}", path)))
    }
}

/// 关闭进程执行器
pub struct KillProcessExecutor;

impl ActionExecutor for KillProcessExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::KillProcess
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: KillProcessParams = serde_json::from_value(params.clone())?;
        let target = ctx.interpolate(&p.target);

        tracing::info!("关闭进程: {} force={}", target, p.force);

        let mut system = System::new();
        system.refresh_processes(ProcessesToUpdate::All, true);

        // 解析目标：数字视为 PID，否则视为进程名
        let killed = if let Ok(pid) = target.parse::<u32>() {
            // 按 PID 关闭
            if let Some(process) = system.process(Pid::from_u32(pid)) {
                if p.force {
                    process.kill_with(Signal::Kill);
                } else {
                    process.kill();
                }
                tracing::info!("已结束进程 PID={}", pid);
                1
            } else {
                0
            }
        } else {
            // 按进程名关闭（可能匹配多个）
            let mut count = 0;
            for (pid, process) in system.processes() {
                let name = process.name().to_string_lossy().to_string();
                // 模糊匹配：支持 notepad 或 notepad.exe
                let name_lower = name.to_lowercase();
                let target_lower = target.to_lowercase();
                if name_lower == target_lower
                    || name_lower == format!("{}.exe", target_lower)
                    || name_lower.replace(".exe", "") == target_lower
                {
                    if p.force {
                        process.kill_with(Signal::Kill);
                    } else {
                        process.kill();
                    }
                    tracing::info!("已结束进程 {} PID={}", name, pid.as_u32());
                    count += 1;
                }
            }
            count
        };

        if killed > 0 {
            Ok(ActionResult::success(format!(
                "已结束 {} 个进程: {}",
                killed, target
            )))
        } else {
            Err(AppError::ActionExecution(format!(
                "未找到匹配的进程: {}",
                target
            )))
        }
    }
}

/// 打开网页执行器
pub struct OpenUrlExecutor;

impl ActionExecutor for OpenUrlExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::OpenUrl
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: OpenUrlParams = serde_json::from_value(params.clone())?;
        let raw_url = ctx.interpolate(&p.url);
        // 自动补全 URL scheme：baidu.com -> https://baidu.com
        // 仅在无 scheme 时补全，已有 http:// / https:// / ftp:// 等保持原样
        let url = normalize_url(&raw_url);

        tracing::info!("打开网页: {} (原始: {})", url, raw_url);

        // 验证 URL 格式
        let parsed = url::Url::parse(&url)
            .map_err(|e| AppError::InvalidArgument(format!("URL 格式错误: {}", e)))?;

        // 使用 open::that 调用默认浏览器
        open::that(parsed.as_str()).map_err(|e| {
            AppError::ActionExecution(format!("打开网页失败 {}: {}", url, e))
        })?;

        Ok(ActionResult::success(format!("已打开网页: {}", url)))
    }
}

/// 打开文件执行器
pub struct OpenFileExecutor;

impl ActionExecutor for OpenFileExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::OpenFile
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: OpenFileParams = serde_json::from_value(params.clone())?;
        let path = ctx.interpolate(&p.path);

        tracing::info!("打开文件: {}", path);

        // 验证文件存在
        if !std::path::Path::new(&path).exists() {
            return Err(AppError::InvalidArgument(format!(
                "文件不存在: {}",
                path
            )));
        }

        if let Some(open_with) = &p.open_with {
            let open_with = ctx.interpolate(open_with);
            std::process::Command::new(&open_with)
                .arg(&path)
                .spawn()
                .map_err(|e| {
                    AppError::ActionExecution(format!(
                        "使用 {} 打开文件 {} 失败: {}",
                        open_with, path, e
                    ))
                })?;
            Ok(ActionResult::success(format!(
                "已使用 {} 打开: {}",
                open_with, path
            )))
        } else {
            open::that(&path).map_err(|e| {
                AppError::ActionExecution(format!("打开文件 {} 失败: {}", path, e))
            })?;
            Ok(ActionResult::success(format!("已打开文件: {}", path)))
        }
    }
}

/// URL scheme 自动补全
///
/// 检测输入是否包含 scheme（如 `http://` / `https://` / `ftp://`），
/// 若无则自动补全为 `https://`。支持以下场景：
///
/// - `baidu.com` -> `https://baidu.com`
/// - `www.google.com` -> `https://www.google.com`
/// - `http://example.com` -> 保持不变
/// - `localhost:3000` -> `https://localhost:3000`
/// - `192.168.1.1:8080` -> `https://192.168.1.1:8080`
///
/// Phase 6 扩展点：未来可从 settings 读取常用域名映射表，
/// 如 `baidu -> https://www.baidu.com`（短域名别名）。
fn normalize_url(raw: &str) -> String {
    let trimmed = raw.trim();

    // 已包含 scheme（:// 分隔符），保持原样
    if trimmed.contains("://") {
        return trimmed.to_string();
    }

    // 无 scheme，自动补全 https://
    // 注意：不补全 http://，因为现代 Web 应默认使用 HTTPS
    format!("https://{}", trimmed)
}
