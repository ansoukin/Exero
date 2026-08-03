//! 设置模型

use serde::{Deserialize, Serialize};

/// 设置项（KV 形式存储在 settings 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    /// 键名（如 "theme.mode"、"general.autostart"）
    pub key: String,
    /// 值（JSON 编码的字符串，可表示任意类型）
    pub value: String,
    /// 类型标识（"string"/"number"/"bool"/"json"）
    pub value_type: String,
}

impl Setting {
    pub fn new(key: impl Into<String>, value: impl Into<String>, value_type: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
            value_type: value_type.into(),
        }
    }

    pub fn from_string(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self::new(key, value, "string")
    }

    pub fn from_bool(key: impl Into<String>, value: bool) -> Self {
        Self::new(key, value.to_string(), "bool")
    }

    pub fn from_number(key: impl Into<String>, value: i64) -> Self {
        Self::new(key, value.to_string(), "number")
    }

    pub fn from_json<T: Serialize>(key: impl Into<String>, value: &T) -> Result<Self, serde_json::Error> {
        let json = serde_json::to_string(value)?;
        Ok(Self::new(key, json, "json"))
    }

    /// 解析值为 bool
    pub fn as_bool(&self) -> Option<bool> {
        self.value.parse().ok()
    }

    /// 解析值为 i64
    pub fn as_i64(&self) -> Option<i64> {
        self.value.parse().ok()
    }

    /// 解析值为 JSON
    pub fn as_json<T: for<'de> Deserialize<'de>>(&self) -> Result<T, serde_json::Error> {
        serde_json::from_str(&self.value)
    }
}

/// 默认设置常量
///
/// 应用首次启动时写入这些默认值。
pub mod defaults {
    /// 主题模式：light/dark/system
    pub const THEME_MODE: &str = "system";
    /// 主题色（Win11 8 色色板，默认蓝）
    pub const THEME_COLOR: &str = "#0078D4";
    /// 是否启用 Mica 背景
    pub const THEME_MICA_ENABLED: bool = false;
    /// 是否启用开机自启
    pub const GENERAL_AUTOSTART: bool = false;
    /// 关闭主窗口行为：ask/minimize/exit
    pub const GENERAL_CLOSE_BEHAVIOR: &str = "ask";
    /// 侧边栏折叠状态
    pub const GENERAL_SIDEBAR_COLLAPSED: bool = false;
    /// 更新检查频率：startup/daily/manual
    pub const UPDATE_CHECK_FREQUENCY: &str = "startup";
    /// 是否自动更新
    pub const UPDATE_AUTO_UPDATE: bool = true;
    /// 更新渠道：stable
    pub const UPDATE_CHANNEL: &str = "stable";
    /// 默认 Lua 脚本超时（秒）
    pub const AUTOMATION_LUA_TIMEOUT_SECS: u32 = 10;
    /// Lua 沙箱模式：strict（默认严格）/ relaxed（宽松，危险 API 可用）
    pub const LUA_SANDBOX_MODE: &str = "strict";
    /// 执行日志保留条数
    pub const AUTOMATION_LOG_RETENTION: u32 = 100;
    /// 多指令并发模式：parallel/serial
    pub const AUTOMATION_CONCURRENCY_MODE: &str = "parallel";
    /// 默认音量
    pub const AUTOMATION_DEFAULT_VOLUME: u32 = 50;
}
