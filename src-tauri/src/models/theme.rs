//! 主题模型（SPEC 3.2 主题系统）
//!
//! 定义主题模式、主题色、Mica 开关等配置结构，
//! 持久化到 settings 表（key 前缀 `theme.`）。

use serde::{Deserialize, Serialize};

/// 主题模式（SPEC 3.2：深色 / 浅色 / 跟随系统）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    /// 浅色模式
    Light,
    /// 深色模式
    Dark,
    /// 跟随系统（默认）
    #[default]
    System,
}

impl ThemeMode {
    /// 将模式字符串解析为枚举，未知值回退到 System
    pub fn parse(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "light" => ThemeMode::Light,
            "dark" => ThemeMode::Dark,
            _ => ThemeMode::System,
        }
    }

    /// 转为 settings 表存储的字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            ThemeMode::Light => "light",
            ThemeMode::Dark => "dark",
            ThemeMode::System => "system",
        }
    }
}

/// 主题色（SPEC 3.2：Win11 8 色色板）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeColor {
    /// 蓝（默认）
    #[default]
    Blue,
    /// 绿
    Green,
    /// 橙
    Orange,
    /// 紫
    Purple,
    /// 红
    Red,
    /// 青
    Cyan,
    /// 粉
    Pink,
    /// 黄
    Yellow,
}

impl ThemeColor {
    /// 将颜色字符串解析为枚举，未知值回退到 Blue
    pub fn parse(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "green" => ThemeColor::Green,
            "orange" => ThemeColor::Orange,
            "purple" => ThemeColor::Purple,
            "red" => ThemeColor::Red,
            "cyan" => ThemeColor::Cyan,
            "pink" => ThemeColor::Pink,
            "yellow" => ThemeColor::Yellow,
            _ => ThemeColor::Blue,
        }
    }

    /// 转为 settings 表存储的字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            ThemeColor::Blue => "blue",
            ThemeColor::Green => "green",
            ThemeColor::Orange => "orange",
            ThemeColor::Purple => "purple",
            ThemeColor::Red => "red",
            ThemeColor::Cyan => "cyan",
            ThemeColor::Pink => "pink",
            ThemeColor::Yellow => "yellow",
        }
    }
}

/// 主题配置（一次性返回给前端，避免多次 get_setting 调用）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ThemeConfig {
    /// 主题模式
    pub mode: ThemeMode,
    /// 主题色
    pub color: ThemeColor,
    /// 是否启用 Mica 背景（默认关闭，纯色背景）
    pub mica_enabled: bool,
}

/// settings 表中主题相关键名
pub mod keys {
    pub const MODE: &str = "theme.mode";
    pub const COLOR: &str = "theme.color";
    pub const MICA_ENABLED: &str = "theme.mica_enabled";
}
