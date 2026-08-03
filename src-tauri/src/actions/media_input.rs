//! 媒体与输入类动作执行器
//!
//! 包含：调节音量 / 播放声音 / 模拟按键

use serde_json::Value;
use std::time::Duration;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::{PlaySoundParams, SetVolumeParams, SimulateKeyParams};
use crate::models::common::ActionType;

/// 调节音量执行器
///
/// 基于 Windows Core Audio API (WASAPI IAudioEndpointVolume) 调节系统主音量。
///
/// Phase 5 修复：原实现使用 waveOutSetVolume（winmm 旧 API），只影响 waveOut 设备音量，
/// 不影响系统主音量。改用 IAudioEndpointVolume 可正确控制系统主音量与静音状态。
pub struct SetVolumeExecutor;

impl ActionExecutor for SetVolumeExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SetVolume
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SetVolumeParams = serde_json::from_value(params.clone())?;

        #[cfg(windows)]
        {
            tracing::info!("调节音量: volume={:?} mute={}", p.volume, p.mute);

            if p.mute {
                set_system_mute(true)?;
                Ok(ActionResult::success("已静音"))
            } else if let Some(volume) = p.volume {
                let volume = volume.min(100);
                // 设置音量时同步取消静音状态，否则系统音量虽变但任务栏图标仍显示静音
                set_system_mute(false)?;
                set_system_volume(volume)?;
                Ok(ActionResult::success(format!("音量已设置为 {}", volume)))
            } else {
                // 既没有 volume 也没有 mute，取消静音并查询当前音量
                set_system_mute(false)?;
                let vol = get_system_volume()?;
                Ok(ActionResult::success_with_output(
                    format!("当前音量: {}", vol),
                    serde_json::json!({ "volume": vol }),
                ))
            }
        }

        #[cfg(not(windows))]
        {
            let _ = p;
            Err(AppError::ActionExecution(
                "调节音量仅在 Windows 上支持".into(),
            ))
        }
    }
}

/// WASAPI 系统音量控制（Phase 5 修复）
///
/// 使用 IAudioEndpointVolume 接口控制系统主音量，替代旧版 waveOutSetVolume。
/// 每次调用都会初始化 COM（幂等，已初始化时返回 S_FALSE 被忽略）。
#[cfg(windows)]
mod win_audio {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    use crate::error::{AppError, Result};

    /// 设置系统静音状态
    pub fn set_mute(mute: bool) -> Result<()> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let result = (|| {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
                let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
                let endpoint_volume: IAudioEndpointVolume =
                    device.Activate(CLSCTX_ALL, None)?;
                endpoint_volume.SetMute(mute, std::ptr::null())
            })();
            CoUninitialize();
            result.map_err(|e| {
                AppError::ActionExecution(format!("设置系统静音失败: {}", e))
            })
        }
    }

    /// 设置系统主音量（0-100）
    pub fn set_volume(volume: u32) -> Result<()> {
        let scalar = (volume.min(100) as f32) / 100.0;
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let result = (|| {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
                let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
                let endpoint_volume: IAudioEndpointVolume =
                    device.Activate(CLSCTX_ALL, None)?;
                endpoint_volume.SetMasterVolumeLevelScalar(scalar, std::ptr::null())
            })();
            CoUninitialize();
            result.map_err(|e| {
                AppError::ActionExecution(format!("设置系统音量失败: {}", e))
            })
        }
    }

    /// 查询当前系统主音量（0-100）
    pub fn get_volume() -> Result<u32> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let result = (|| {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
                let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
                let endpoint_volume: IAudioEndpointVolume =
                    device.Activate(CLSCTX_ALL, None)?;
                endpoint_volume.GetMasterVolumeLevelScalar()
            })();
            CoUninitialize();
            result
                .map(|scalar| (scalar * 100.0).round() as u32)
                .map_err(|e| {
                    AppError::ActionExecution(format!("查询系统音量失败: {}", e))
                })
        }
    }
}

#[cfg(windows)]
use win_audio::{get_volume as get_system_volume, set_mute as set_system_mute, set_volume as set_system_volume};

/// 播放声音执行器
///
/// 简单实现：使用 std::process::Command 调用系统播放器。
/// 复杂场景（循环、音量控制）可后续扩展为 rodio 库。
pub struct PlaySoundExecutor;

impl ActionExecutor for PlaySoundExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::PlaySound
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: PlaySoundParams = serde_json::from_value(params.clone())?;
        let source = ctx.interpolate(&p.source);

        tracing::info!("播放声音: {} loop={}", source, p.r#loop);

        #[cfg(windows)]
        {
            // 系统声音（如 "SystemNotification"）使用 PlaySoundW
            // 文件路径使用默认程序打开
            if !std::path::Path::new(&source).exists() {
                // 视为系统声音名
                use windows_sys::Win32::Media::Audio::{SND_ALIAS, SND_ASYNC, PlaySoundW};
                let wide: Vec<u16> = source.encode_utf16().chain(std::iter::once(0)).collect();
                unsafe {
                    PlaySoundW(wide.as_ptr(), std::ptr::null_mut(), SND_ALIAS | SND_ASYNC);
                }
                return Ok(ActionResult::success(format!(
                    "已播放系统声音: {}",
                    source
                )));
            }

            // 文件播放：异步打开默认媒体播放器
            open::that(&source).map_err(|e| {
                AppError::ActionExecution(format!("播放声音失败 {}: {}", source, e))
            })?;

            if p.r#loop {
                tracing::warn!("循环播放暂未实现，仅播放一次");
            }

            Ok(ActionResult::success(format!("已播放声音: {}", source)))
        }

        #[cfg(not(windows))]
        {
            let _ = ctx;
            let _ = p;
            Err(AppError::ActionExecution(
                "播放声音仅在 Windows 上支持".into(),
            ))
        }
    }
}

/// 模拟按键执行器
///
/// 基于 Windows SendInput API 模拟键盘输入。
pub struct SimulateKeyExecutor;

impl ActionExecutor for SimulateKeyExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SimulateKey
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SimulateKeyParams = serde_json::from_value(params.clone())?;
        let keys = ctx.interpolate(&p.keys);

        tracing::info!("模拟按键: {} repeat={}", keys, p.repeat);

        #[cfg(windows)]
        {
            // 解析按键序列，支持 "Ctrl+C" / "Alt+F4" / "Win+D" 等
            let vk_codes = parse_key_sequence(&keys)?;

            for _ in 0..p.repeat.max(1) {
                // 按下所有键（修饰键 + 主键）
                for &vk in &vk_codes {
                    send_key(vk, false);
                    std::thread::sleep(Duration::from_millis(10));
                }
                // 释放所有键（逆序）
                for &vk in vk_codes.iter().rev() {
                    send_key(vk, true);
                    std::thread::sleep(Duration::from_millis(10));
                }
            }

            Ok(ActionResult::success(format!("已模拟按键: {}", keys)))
        }

        #[cfg(not(windows))]
        {
            let _ = ctx;
            Err(AppError::ActionExecution(
                "模拟按键仅在 Windows 上支持".into(),
            ))
        }
    }
}

#[cfg(windows)]
fn parse_key_sequence(seq: &str) -> Result<Vec<u32>> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

    let mut result = Vec::new();
    for part in seq.split('+') {
        let part = part.trim();
        let vk: u32 = match part.to_lowercase().as_str() {
            "ctrl" | "control" => VK_CONTROL as u32,
            "alt" | "menu" => VK_MENU as u32,
            "shift" => VK_SHIFT as u32,
            "win" | "super" | "meta" => VK_LWIN as u32,
            "enter" | "return" => VK_RETURN as u32,
            "esc" | "escape" => VK_ESCAPE as u32,
            "tab" => VK_TAB as u32,
            "space" => VK_SPACE as u32,
            "backspace" => VK_BACK as u32,
            "delete" | "del" => VK_DELETE as u32,
            "insert" => VK_INSERT as u32,
            "home" => VK_HOME as u32,
            "end" => VK_END as u32,
            "pageup" | "pgup" => VK_PRIOR as u32,
            "pagedown" | "pgdn" => VK_NEXT as u32,
            "up" => VK_UP as u32,
            "down" => VK_DOWN as u32,
            "left" => VK_LEFT as u32,
            "right" => VK_RIGHT as u32,
            "f1" => VK_F1 as u32, "f2" => VK_F2 as u32, "f3" => VK_F3 as u32, "f4" => VK_F4 as u32,
            "f5" => VK_F5 as u32, "f6" => VK_F6 as u32, "f7" => VK_F7 as u32, "f8" => VK_F8 as u32,
            "f9" => VK_F9 as u32, "f10" => VK_F10 as u32, "f11" => VK_F11 as u32, "f12" => VK_F12 as u32,
            single if single.len() == 1 => {
                let c = single.chars().next().unwrap();
                c.to_ascii_uppercase() as u32
            }
            _ => {
                return Err(AppError::InvalidArgument(format!(
                    "无法识别的按键: {}",
                    part
                )))
            }
        };
        result.push(vk);
    }
    Ok(result)
}

#[cfg(windows)]
fn send_key(vk: u32, up: bool) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT,
    };

    let flags = if up {
        windows_sys::Win32::UI::Input::KeyboardAndMouse::KEYEVENTF_KEYUP
    } else {
        0
    };

    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows_sys::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk as u16,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    unsafe {
        SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
    }
}
