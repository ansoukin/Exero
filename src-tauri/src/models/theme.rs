//! 主题模型（SPEC 3.2 主题系统）
//!
//! 定义主题模式、主题色、Acrylic 窗口效果开关等配置结构，
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    /// 主题模式
    pub mode: ThemeMode,
    /// 主题色
    pub color: ThemeColor,
    /// 是否启用 Acrylic 窗口效果（亚克力磨砂玻璃，默认开启）
    /// Win10/Win11 均可用；低性能机器可关闭降级为纯色背景
    #[serde(default = "default_acrylic_enabled")]
    pub acrylic_enabled: bool,
}

/// Acrylic 默认开启（低性能机器可关闭）
fn default_acrylic_enabled() -> bool {
    true
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            mode: ThemeMode::System,
            color: ThemeColor::Blue,
            acrylic_enabled: true,
        }
    }
}

/// settings 表中主题相关键名
pub mod keys {
    pub const MODE: &str = "theme.mode";
    pub const COLOR: &str = "theme.color";
    pub const ACRYLIC_ENABLED: &str = "theme.acrylic_enabled";
    /// 自定义主题色（hex 字符串，如 "#FF6B35"），设置后覆盖预设色
    pub const CUSTOM_COLOR: &str = "theme.custom_color";
}
