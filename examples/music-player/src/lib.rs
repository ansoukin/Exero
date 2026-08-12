//! Music Player（Exero 示例插件）
//!
//! 演示插件系统的高级用法：
//! - Rust .dll 负责文件选择（绕过 iframe sandbox 限制）
//! - 读取音频元数据（ID3/FLAC/Vorbis，通过 lofty）
//! - 读取内嵌专辑封面（返回 base64 data URI）
//!
//! 编译：`cargo build --release`（CARGO_TARGET_DIR 需设置为 C:\cargo-target-dominate）
//! 产物：music_player.dll（Windows）

use exero_plugin_sdk::{declare_actions, Params};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use serde_json::{json, Value};
use std::path::PathBuf;

/// 文件选择对话框支持的音频格式
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma"];

/// pick_audio_files 动作：弹出系统文件选择对话框，返回用户选择的音频文件路径列表
///
/// 通过 rfd（rust file dialog）调用 Windows 原生文件对话框，
/// 绕过 iframe sandbox 无法访问本地文件系统的限制。
/// 返回 JSON: `{ files: [{ path, name }] }`
fn pick_audio_files(_params: Params) -> Result<Value, String> {
    let result = rfd::FileDialog::new()
        .set_title("选择音频文件")
        .add_filter("音频文件", AUDIO_EXTENSIONS)
        .add_filter("所有文件", &["*"])
        .pick_files();

    match result {
        Some(paths) if !paths.is_empty() => {
            let files: Vec<Value> = paths
                .iter()
                .map(|p| {
                    let path = p.to_string_lossy().replace('\\', "/");
                    let name = p
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "未知".to_string());
                    json!({ "path": path, "name": name })
                })
                .collect();
            Ok(json!({ "files": files }))
        }
        Some(_) => Ok(json!({ "files": [] })),
        None => Ok(json!({ "files": [], "canceled": true })),
    }
}

/// read_metadata 动作：读取单个音频文件的元数据
///
/// 通过 lofty 解析音频文件标签，提取标题/艺术家/专辑/时长/年份等。
/// 对于无标签或解析失败的文件，返回文件名作为标题，其余字段为空。
///
/// 参数：`{ path: string }`
/// 返回：`{ title, artist, album, duration_secs, year, track, genre }`
fn read_metadata(params: Params) -> Result<Value, String> {
    let path_str: String = params.get("path")?;
    let path = PathBuf::from(&path_str);

    if !path.exists() {
        return Err(format!("文件不存在: {}", path_str));
    }

    // 默认值：从文件名提取
    let file_name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "未知".to_string());

    let mut title = file_name.clone();
    let mut artist = String::new();
    let mut album = String::new();
    let mut year: Option<u32> = None;
    let mut track: Option<u32> = None;
    let mut genre = String::new();
    let mut duration_secs: Option<f64> = None;

    // 尝试用 lofty 读取标签
    match lofty::read_from_path(&path) {
        Ok(tagged_file) => {
            // 读取时长
            let duration = tagged_file.properties().duration();
            if duration.as_secs_f64() > 0.0 {
                duration_secs = Some(duration.as_secs_f64());
            }

            // 读取标签（优先 primary_tag，回退 first_tag）
            let tag_opt = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag());

            if let Some(tag) = tag_opt {
                if let Some(t) = tag.title() {
                    let t = t.trim();
                    if !t.is_empty() {
                        title = t.to_string();
                    }
                }
                if let Some(a) = tag.artist() {
                    let a = a.trim();
                    if !a.is_empty() {
                        artist = a.to_string();
                    }
                }
                if let Some(al) = tag.album() {
                    let al = al.trim();
                    if !al.is_empty() {
                        album = al.to_string();
                    }
                }
                year = tag.year();
                track = tag.track();
                if let Some(g) = tag.genre() {
                    let g = g.trim();
                    if !g.is_empty() {
                        genre = g.to_string();
                    }
                }
            }
        }
        Err(e) => {
            // 元数据读取失败不算致命错误，用默认值继续
            exero_log(&format!("元数据读取失败 {}: {}", path_str, e));
        }
    }

    Ok(json!({
        "title": title,
        "artist": artist,
        "album": album,
        "duration_secs": duration_secs,
        "year": year,
        "track": track,
        "genre": genre
    }))
}

/// read_embedded_cover 动作：读取音频文件内嵌的专辑封面
///
/// 通过 lofty 提取内嵌图片（ID3 APIC / FLAC picture 等），
/// 返回 base64 编码的 data URI，前端直接用 <img src> 显示。
///
/// 参数：`{ path: string }`
/// 返回：`{ cover: string | null }`，cover 为 data URI 格式
fn read_embedded_cover(params: Params) -> Result<Value, String> {
    let path_str: String = params.get("path")?;
    let path = PathBuf::from(&path_str);

    if !path.exists() {
        return Err(format!("文件不存在: {}", path_str));
    }

    let mut cover_data_uri: Option<String> = None;

    match lofty::read_from_path(&path) {
        Ok(tagged_file) => {
            let tag_opt = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag());

            if let Some(tag) = tag_opt {
                if let Some(picture) = tag.pictures().first() {
                    let mime_str = match picture.mime_type() {
                        Some(lofty::picture::MimeType::Jpeg) => "image/jpeg",
                        Some(lofty::picture::MimeType::Png) => "image/png",
                        Some(lofty::picture::MimeType::Gif) => "image/gif",
                        Some(lofty::picture::MimeType::Bmp) => "image/bmp",
                        _ => "image/jpeg",
                    };
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(picture.data());
                    cover_data_uri = Some(format!("data:{};base64,{}", mime_str, b64));
                }
            }
        }
        Err(e) => {
            exero_log(&format!("封面读取失败 {}: {}", path_str, e));
        }
    }

    Ok(json!({ "cover": cover_data_uri }))
}

/// 简易日志输出（输出到 stderr，Exero 可捕获）
fn exero_log(msg: &str) {
    eprintln!("[music-player] {}", msg);
}

declare_actions! {
    "pick_audio_files" => pick_audio_files,
    "read_metadata" => read_metadata,
    "read_embedded_cover" => read_embedded_cover,
}
