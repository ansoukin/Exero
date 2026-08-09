//! Lua 脚本模型
//!
//! 定义脚本 manifest（脚本元数据）与已安装脚本（数据库记录）结构。
//! 市场分发通过 .exero-pack（pack_type=action, executor_type=Lua），见 extension_pack 模块。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 脚本市场 manifest
///
/// 对应仓库 `scripts/<id>.json` 文件，描述脚本元数据。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptManifest {
    /// 脚本 ID（与文件名一致，仅字母数字与连字符/下划线）
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 作者
    #[serde(default)]
    pub author: String,
    /// 语义化版本（如 "1.0.0"）
    #[serde(default = "default_version")]
    pub version: String,
    /// 描述
    #[serde(default)]
    pub description: String,
    /// 权限声明（需要的宽松沙箱权限，如 "io" / "os.execute"）
    #[serde(default)]
    pub permissions: Vec<String>,
    /// 参数定义（用于动态生成 Lua 节点参数表单）
    #[serde(default)]
    pub params: Vec<ScriptParam>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}

/// 脚本参数定义
///
/// 描述单个输入参数的元数据，前端据此动态生成表单控件。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptParam {
    /// 参数名（Lua 脚本通过 args.xxx 访问）
    pub name: String,
    /// 显示标签
    pub label: String,
    /// 参数类型：string / number / boolean / select
    #[serde(rename = "type")]
    pub param_type: String,
    /// 默认值
    #[serde(default)]
    pub default: Value,
    /// select 类型的可选项
    #[serde(default)]
    pub options: Vec<String>,
    /// 是否必填
    #[serde(default)]
    pub required: bool,
}

/// 已安装脚本（数据库记录）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledScript {
    pub script_id: String,
    pub name: String,
    pub author: String,
    pub version: String,
    pub description: String,
    pub permissions: Vec<String>,
    pub params_schema: Vec<ScriptParam>,
    pub installed_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub source_url: String,
    pub content_hash: String,
}
