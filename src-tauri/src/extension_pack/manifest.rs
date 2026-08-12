//! 扩展包 Manifest 数据结构（Beta5 · 扩展机制重设计）
//!
//! 参考 MC fabric.mod.json 设计，声明扩展包元数据与动作/侧边栏入口。
//! Manifest 文件位于扩展包根目录的 manifest.json，由加载器解析。
//!
//! V0.4.0-Beta5 变更：
//! - 原 pack_type: action | lua_scripts 合并为统一 action
//! - 原 scripts[] 字段废弃，Lua 脚本通过 actions[] + executor_type: "Lua" 声明
//! - ActionManifest 新增 params/permissions/description 字段（Lua 动作用）
//! - Phase 3 新增 pack_type: plugin（插件，含 iframe UI + 侧边栏入口 + Rust .dll）

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
    /// 扩展包类型：action（动作包）或 plugin（插件）
    /// - action：提供 Flow 积木，通过 actions[] 声明注册动作
    /// - plugin：提供完整功能页面，含 iframe UI + 侧边栏入口 + Rust .dll（Phase 3 新增）
    #[serde(default)]
    pub pack_type: PackType,
    /// Rust 动态库文件相对路径（可选，如 "my_pack.dll"）
    /// 存在时，actions[] 中 executor_type = "Rust" 的动作通过 C ABI 调用此 .dll
    /// 不存在时，executor_type = "Rust" 的动作映射到内置 ActionType（base-pack 模式）
    /// 插件（pack_type=plugin）必须声明此字段
    #[serde(default)]
    pub rust_library: Option<String>,
    /// 动作声明列表（统一入口，Rust 和 Lua 动作均在此声明）
    /// 插件可选附带动作，在 Flow 编辑器中作为积木使用
    #[serde(default)]
    pub actions: Vec<ActionManifest>,
    /// 侧边栏入口声明（插件必填，动作包不支持）
    /// V0.4.0-Beta5 Phase 3：侧边栏入口为插件独占能力，动作包不再支持
    #[serde(default)]
    pub sidebar: Option<SidebarManifest>,
    /// 插件 UI 声明（仅 pack_type=plugin 时有意义，Phase 3 新增）
    /// 声明插件前端入口文件，通过 iframe 加载
    #[serde(default)]
    pub ui: Option<UiManifest>,
    /// 是否隐藏插件 iframe 上方的标题栏（插件名称 + 版本号信息条）
    /// - false（默认）：显示标题栏，用户可通过返回按钮回到设置
    /// - true：隐藏标题栏，插件自行管理全部 UI（需自行提供返回按钮等导航）
    #[serde(default)]
    pub hide_header: bool,
}

/// 扩展包类型
///
/// - Action：动作包，通过 actions[] 声明注册动作积木（Rust 或 Lua）
/// - Plugin：插件，含 iframe UI + 侧边栏入口 + Rust .dll（Phase 3 新增）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PackType {
    #[serde(rename = "action")]
    Action,
    #[serde(rename = "plugin")]
    Plugin,
}

impl Default for PackType {
    fn default() -> Self {
        Self::Action
    }
}

/// 动作 Manifest 声明
///
/// 声明一个动作类型的元数据与执行器配置。
/// Rust 动作和 Lua 动作统一使用此结构，通过 executor_type 区分。
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
    /// 动作描述（Lua 动作注册到数据库时使用）
    #[serde(default)]
    pub description: String,
    /// Lua 沙箱权限声明（仅 executor_type = "Lua" 时有意义）
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Lua 脚本参数定义（仅 executor_type = "Lua" 时有意义，前端据此生成参数表单）
    #[serde(default)]
    pub params: Vec<crate::models::ScriptParam>,
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
/// V0.4.0-Beta5 Phase 3：侧边栏入口为插件独占能力，动作包不再支持。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarManifest {
    /// 入口唯一标识
    pub id: String,
    /// 入口显示名（如 "Hello Plugin"）
    pub label: String,
    /// 图标名称（lucide-react 图标名）
    pub icon: String,
    /// 页面类型：web（插件 iframe 页面）或 detail（统一详情页）
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
    /// 插件 iframe 页面（Phase 3 新增，通过 plugin:// 协议加载插件前端）
    Web,
}

/// 插件 UI Manifest（Phase 3 新增）
///
/// 声明插件前端入口文件，由 Tauri 自定义协议 `plugin://{pack_id}/` 服务。
/// iframe 通过 `http://plugin.localhost/{pack_id}/{entry}` 加载（Windows）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiManifest {
    /// 前端入口文件相对路径（如 "index.html"）
    pub entry: String,
}

fn default_icon() -> String {
    "Code".to_string()
}

fn default_page_type() -> PageType {
    PageType::Detail
}
