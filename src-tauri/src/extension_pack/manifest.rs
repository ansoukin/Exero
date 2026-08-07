//! 扩展包 Manifest 数据结构（Beta3 · 扩展包架构）
//!
//! 参考 MC fabric.mod.json 设计，声明扩展包元数据与动作/侧边栏入口。
//! Manifest 文件位于扩展包根目录的 manifest.json，由加载器解析。

use serde::{Deserialize, Serialize};

/// 扩展包 Manifest 根结构
///
/// 对应扩展包根目录的 manifest.json 文件。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionPackManifest {
    /// 扩展包唯一标识（如 "base-pack"）
    pub id: String,
    /// 扩展包版本号（SemVer，如 "1.0.0"）
    pub version: String,
    /// 扩展包显示名（中文，如 "基础动作包"）
    pub name: String,
    /// 扩展包描述
    #[serde(default)]
    pub description: String,
    /// 作者
    #[serde(default)]
    pub author: String,
    /// 所需 Exero API 版本（如 "0.4.0"）
    pub exero_api_version: String,
    /// 扩展包类型：action（动作包，注册新动作类型）或 lua_scripts（Lua 脚本包，提供 Lua 脚本）
    #[serde(default)]
    pub pack_type: PackType,
    /// 动作声明列表（pack_type = "action" 时使用，可为空）
    #[serde(default)]
    pub actions: Vec<ActionManifest>,
    /// Lua 脚本声明列表（pack_type = "lua_scripts" 时使用）
    #[serde(default)]
    pub scripts: Vec<PackScriptManifest>,
    /// 侧边栏入口声明（可选，无则不注册侧边栏入口）
    #[serde(default)]
    pub sidebar: Option<SidebarManifest>,
}

/// 扩展包类型
///
/// - Action：动作包，通过 actions[] 声明注册新动作类型
/// - LuaScripts：Lua 脚本包，通过 scripts[] 声明提供 Lua 脚本，安装后注册到 Lua 脚本积木可选列表
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PackType {
    #[serde(rename = "action")]
    Action,
    #[serde(rename = "lua_scripts")]
    LuaScripts,
}

impl Default for PackType {
    fn default() -> Self {
        Self::Action
    }
}

/// Lua 脚本包内的脚本声明
///
/// pack_type = "lua_scripts" 时，每个条目描述一个 Lua 脚本及其参数 schema。
/// 安装时将 .lua 文件复制到 scripts 目录并注册到数据库。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackScriptManifest {
    /// 脚本 ID（全局唯一，与已安装脚本合并查询）
    pub id: String,
    /// 显示名
    pub name: String,
    /// 作者
    #[serde(default)]
    pub author: String,
    /// 语义化版本
    #[serde(default = "default_script_version")]
    pub version: String,
    /// 描述
    #[serde(default)]
    pub description: String,
    /// 权限声明（宽松沙箱权限）
    #[serde(default)]
    pub permissions: Vec<String>,
    /// 参数定义（动态生成 Lua 节点参数表单）
    #[serde(default)]
    pub params: Vec<crate::models::ScriptParam>,
    /// 包内 .lua 文件路径（如 "scripts/hello.lua"）
    pub file: String,
}

fn default_script_version() -> String {
    "1.0.0".to_string()
}

/// 动作 Manifest 声明
///
/// 声明一个动作类型的元数据与执行器配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionManifest {
    /// 动作唯一标识（扩展包内唯一，如 "launch_program"）
    pub id: String,
    /// 执行器类型：rust（调用 Rust 内置执行器）或 lua（执行 Lua 脚本）
    pub executor_type: ExecutorType,
    /// 执行器标识：
    /// - rust 类型：对应 ActionType 枚举变体名（如 "LaunchProgram"）
    /// - lua 类型：脚本相对路径（如 "scripts/custom.lua"）
    pub executor_id: String,
    /// 动作中文显示名（如 "启动程序"）
    pub label: String,
    /// 动作类别（app/media/system/notification/control/lua）
    pub category: String,
    /// 图标名称（lucide-react 图标名，如 "AppWindow"，前端维护映射表）
    #[serde(default = "default_icon")]
    pub icon: String,
    /// 默认参数（创建节点时初始化）
    #[serde(default)]
    pub default_params: serde_json::Value,
    /// 端口配置
    #[serde(default)]
    pub ports: PortsManifest,
    /// 参数摘要模板（如 "{path}"，前端解析为节点卡片摘要）
    #[serde(default)]
    pub summarize_template: String,
}

/// 执行器类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutorType {
    /// 调用 Rust 内置执行器（性能敏感动作）
    Rust,
    /// 执行 Lua 脚本（通用逻辑）
    Lua,
}

/// 端口配置 Manifest
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PortsManifest {
    /// 输入端口列表
    #[serde(default)]
    pub inputs: Vec<PortManifest>,
    /// 输出端口列表
    #[serde(default)]
    pub outputs: Vec<PortManifest>,
}

/// 端口 Manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortManifest {
    /// 端口唯一标识（React Flow handle id）
    pub id: String,
    /// 端口位置
    pub position: PortPosition,
    /// 端口显示名（用于 IfElse 的 then/else 标签）
    #[serde(default)]
    pub label: Option<String>,
}

/// 端口位置
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PortPosition {
    Top,
    Bottom,
    Left,
    Right,
}

/// 侧边栏入口 Manifest
///
/// 声明扩展包在侧边栏注册的入口。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarManifest {
    /// 入口唯一标识
    pub id: String,
    /// 入口显示名（如 "基础动作包"）
    pub label: String,
    /// 图标名称（lucide-react 图标名）
    pub icon: String,
    /// 页面类型：detail（统一详情页）或 declarative（声明式自定义页面）
    #[serde(default = "default_page_type")]
    pub page_type: PageType,
}

/// 页面类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PageType {
    /// 统一详情页（展示扩展包元数据/设置/动作列表/日志）
    Detail,
    /// 声明式自定义页面（manifest 声明 UI 组件，Lua 提供数据）
    Declarative,
}

fn default_icon() -> String {
    "Code".to_string()
}

fn default_page_type() -> PageType {
    PageType::Detail
}
