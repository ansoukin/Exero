# 更新历史

## V0.4.0-Beta9

**时间触发器积木 + 插件持久运行协议 + 系统亚克力窗口效果 + 全面视觉升级（2026-08-15）**

> 本版本聚焦优化、美化、增强：积木编辑器迎来时间触发器，插件支持类 Chrome 扩展的持久运行，主窗口接入 Win11 系统级亚克力并彻底根治黑边，同时带来外观定制扩充、性能页四卡片、首页工作流布局与更新体验重做。动画体系全面迁移 framer-motion，通知迁移 sonner。

### 新增

- **时间触发器积木**（控制流分组）：
  - 重复规则选择器：每天 / 每周指定星期 / 每 N 天 / 指定日期，`HH:mm` 直观调节，前端自动生成 Cron 表达式
  - 课表触发（仅校园模式）：按科目 + 星期 + 节次选择课程，支持课前 N 分钟 / 课中 / 课后三种触发时机，跟随课程 `week_pattern` 周次适配
  - 属性面板常驻显示触发配置，未选中积木时默认呈现时间触发表单
- **系统亚克力窗口效果**：
  - Win11 22H2+ 使用 DWMSB 系统背景（系统级磨砂，模糊的是真实桌面壁纸），Win10 / 旧 Win11 自动降级 ACRYLICBLURBEHIND
  - DWMWCP_ROUND 物理圆角 + 移除 DWM 边框色，配合透明窗口彻底根治 `decorations:false` 残留黑边
  - 默认开启，设置页可实时开关，关闭后回退纯色背景；CSS 叠加半透明着色 / 噪点纹理 / 光影描边
- **插件持久运行协议**（类 Chrome 扩展后台页）：
  - 常驻 iframe 宿主层：切换页面后插件继续运行（音乐不停），iframe 地址全生命周期稳定不重载
  - 设置新增「插件」分区：keep-alive 开关（退出页面保持运行）/ 缓存清理 / 强制停止 / 权限徽章（页面显示 / 本地存储 / 后台运行）
- **扩展包图标三源支持**：manifest 图标字段支持 lucide 图标名 / `segoe:码点`（Segoe Fluent Icons）/ `img:路径`（SVG / PNG / ICO）
- **外观设置扩充**：
  - 界面密度（紧凑 / 标准 / 舒适）与字体族、字号三档全局缩放（Win10 兼容 fallback 字体链）
  - 图标风格切换：Lucide（默认）/ Segoe Fluent Icons
  - LiquidGlass 实验性玻璃效果（默认关闭，展示页先行）
- **自定义主题色取色器**：预设色板末尾画笔入口，取色板 + Hex 输入 + 实时预览，持久化保存
- **扩展市场双视图切换**：横幅 / 网格并列切换按钮（Modrinth 式），视图偏好持久化
- **更新历史二级页面**：关于页入口跳转独立页面，版本卡片折叠展开，带内存缓存
- **首页工作流布局**：今日任务 + 快捷指令合并为「任务工作流」大卡，右栏系统状态新增 CPU / 内存迷你折线
- **性能页四卡片**：CPU / GPU / 内存 / 存储四卡片 + recharts 实时趋势折线（60 点滚动窗口）+ CPU / GPU 型号显示；LHM（LibreHardwareMonitorLib）子进程提供 GPU 真实数据

### 优化

- **开屏动画统一**：新老用户统一 SplashStage 动画，老用户跳过打字机副标题自动进入主界面
- **托盘右键自绘菜单**：Apple 风透明窗口（160×114 + 8px 圆角），三项菜单（打开主窗口 / 检查更新 / 退出），framer-motion 入场动画，失焦 / ESC 自动关闭
- **关于页重做**：Win11 设置风 Hero（正式 Logo 明暗双版 + 主题蓝渐变）+ 鸣谢区（含技术栈）
- **更新弹窗重做**：流式下载进度条（framer-motion 平滑过渡）+ 下载完成绿色提示卡片
- **Gitee 备源**：更新检查 / Release 列表 / 下载安装全链路三级网络 fallback：GitHub → Gitee → ghproxy
- **设置导航美化**：6 分区 lucide 图标 + 选中态左侧 3px 主题色竖条
- **主窗口边框**：自绘圆角边框，配合系统亚克力彻底消除黑边
- **动画体系迁移 framer-motion**：页面切换 / 入场 / 悬停 / 按压动画统一迁移，删除全部手写 CSS `@keyframes`
- **通知迁移 sonner**：应用内通知以 sonner 风格呈现，保留 info / warning / error / success 四级映射
- **快捷指令编辑器**：
  - 拖拽 ghost 卡片跟随光标（抑制浏览器默认半透明快照），落点改用 `screenToFlowPosition` 修正画布缩放 / 平移后的偏移
  - 属性面板折叠态收为圆形单按钮，点击侧滑弹出，选中积木自动展开规则保留
- **控制流积木视觉优化**：类别色竖条 / 端口 hover 放大反馈 / 连线蚂蚁线流动动画（主题色描边）
- **sidebar 折叠动画修复**：framer-motion layout 动画修复「先消失再突然展开」的内容闪动

### 移除

- **音乐插件动作积木**：音乐播放器改为纯页面插件，不再注册动作积木
- **更新频率「每次启动」选项**：与「启动后后台」重复，保留启动后后台 / 每天 / 手动
- **手写 CSS 动画体系**：全部 `@keyframes` 迁移至 framer-motion 后删除

---

## V0.4.0-Beta8

**[可选更新] 官网音乐播放器提醒 + exero:// 协议唤起 + 多项解析与显示修复**

> 本版本为可选更新，无强制升级压力。新增官网音乐播放器提醒（配合主程序 `exero://` 协议唤起本地程序），并修复 Lua 动作包解析失败、插件"动作数量"误显示等问题。同时预告：Stable 正式版即将发布，届时功能冻结进入稳定期，本版本改动将全部随正式版一起上线。

### 新增

- **官网音乐播放器提醒**：
  - 官网首页右上角新增滑入式提醒卡片，点击「打开 Exero」可直接唤起本机主程序
  - 主程序新增 `exero://` 系统级协议注册 + single-instance 单实例支持（二次唤起时聚焦已有窗口）
  - 未安装程序时自动引导前往下载页；关闭后通过 `localStorage` 记录，不再重复弹出
- **插件信息展示更准确**：
  - 页面型插件不再显示"动作数量"，如实标注"页面型插件"（插件页 / 扩展市场 / 设置页统一修正）
  - 仅动作包显示实际动作数量

### 修复

- **扩展更新安装时 OS 失败**：覆盖安装前先卸载旧 DLL，避免文件占用导致安装失败
- **Lua 动作包 `manifest.json` 解析失败**（Line12，column28）：
  - `ExecutorType` 反序列化改为大小写不敏感，兼容 `"Lua"` / `"lua"` 等写法
  - 动作 `ports` 补全 `position` 字段，移除多余的 `type` 字段
- **插件"动作数量"误显示**：`action_count` 直接取自 manifest，未区分插件与动作包，现按 `pack_type` 条件渲染

### 一并更新

- 音乐播放器插件 v0.2.2，附带宿主存储 API，插件可持久化数据
- 文档：`ExecutorType` 枚举说明更新为 Beta8 起大小写不敏感

### 关于 Stable

Stable 正式版即将发布，届时功能将冻结并进入稳定期。本版本全部改动将随正式版一起上线，想提前体验正式版能力可升级本版本。

---

## V0.4.0-Beta7

**[强制更新] 插件系统增强：local-file 协议 + hide_header 字段 + 示例插件**

> 本版本为 V0.4.0-Beta6 的修补版本，针对插件系统核心能力进行扩展与文档完善。新增 `local-file` URI scheme 解决 iframe sandbox 无法加载本地文件的问题，新增 `hide_header` manifest 字段支持插件沉浸式 UI，并补充音乐播放器示例插件验证开发链路。所有 Beta6 用户必须升级以获得完整的插件开发能力。

### 新增

- **local-file URI scheme**（SPEC 6.5.3 扩展）：
  - 注册 `local-file` 自定义协议，解决 iframe sandbox（无 `allow-same-origin`）禁止 `file:///` 访问本地文件的问题
  - 访问格式（Windows）：`http://local-file.localhost/{url-encoded-path}`
  - 自动 URL 解码 + MIME 类型推断（mp3/wav/flac/ogg/m4a/aac 音频，png/jpeg/gif/bmp/webp/svg 图片）
  - 支持 CORS 头（`Access-Control-Allow-Origin: *`），适配 iframe 跨域加载
- **manifest `hide_header` 字段**（SPEC 6.5.3 扩展）：
  - `ExtensionPackManifest` 新增 `hide_header: bool`（默认 `false`，`#[serde(default)]` 向后兼容）
  - `true` 时隐藏插件 iframe 上方标题栏（插件名称+版本号信息条），插件自行管理全部 UI（含返回按钮等导航）
  - 前端 `PluginPage.tsx` 根据该字段条件渲染标题栏
- **音乐播放器示例插件**（`examples/music-player/`）：
  - 完整可运行插件：Cargo.toml（cdylib + lofty 0.21 + rfd 0.14 + base64 0.22）+ lib.rs（3 个 Rust 动作）+ manifest.json + index.html
  - 3 个 Rust 动作：`pick_audio_files`（rfd 文件选择）/ `read_metadata`（lofty 元数据）/ `read_embedded_cover`（lofty 内嵌封面 base64）
  - 前端功能：播放/暂停/上一首/下一首、进度条拖拽、音量控制、3 种播放模式（顺序/随机/单曲循环）、播放列表管理、专辑封面+元数据显示
  - Win11 Fluent Design 风格（#0a0f1a 背景 / #0078D4 品牌蓝 / 8px 网格 / 200ms 动画）
  - `hide_header: true` 沉浸式 UI + `local-file` 协议播放本地音频

### 修复

- **插件 iframe 无法加载本地文件**：sandbox 未含 `allow-same-origin`，`file:///` 协议被浏览器拦截。通过新增 `local-file` URI scheme 中转读取本地文件，插件可安全加载音频/图片/视频等资源

### 文档

- **修正 SDK 路径**：开发者文档原写 `src-tauri/crates/exero-plugin-sdk/`，实际位于项目根目录 `exero-plugin-sdk/`（plugin.md 已修正）
- **新增 local-file 协议文档**：plugin.md（本地文件访问章节 + sandbox 限制说明）、bridge-api.md（URL 格式 + 示例 + 路径编码注意事项）、manifest.md（无需改动，协议为主程序能力）
- **新增 hide_header 字段文档**：manifest.md（字段说明）、plugin.md（插件特有字段表 + 完整 manifest 示例）
- **新增 sandbox 限制说明**：plugin.md 详细列出 `file:///`、`fetch('file:///...')`、`localStorage`、`XMLHttpRequest` 在 sandbox 下的限制及解决方案
- **修正示例插件位置说明**：文档原暗示示例源码在 `Market/plugins/`，实际源码在 `examples/`，`Market/plugins/` 仅存放打包后的 `.exero-pack`

### 后端命令

- 无新增 Tauri 命令（`local-file` 协议通过 Tauri `register_uri_scheme_protocol` 注册，非命令）

---

## V0.4.0-Beta6

**[强制更新] 日常模式时间轴 + OOBE 引导系统优化 + 静默更新**

> 本版本为 V0.4.0 最后一个 Beta，完成日常模式时间轴适配、OOBE 引导系统优化、静默更新等功能，并修复多个关键 bug。所有 Beta5 用户必须升级以进入 Stable 准备阶段。

### 新增

- **日常模式时间轴四视图**（SPEC 3.5）：
  - 日视图：7:00-22:00 纵向时间轴，按 Cron 触发时间定位，显示快捷指令名 + 时间 + 色条
  - 周视图：7 列布局（周一为首），每天触发块列表（色点 + 时间 + flow 名），点击表头钻取日视图
  - 月视图：6×7 日历网格，每格显示触发数 + 色点（粗略信息），点击格点钻取周视图
  - 年视图：3×4 12 月方格 + 触发密度热力图（0-4 五级色深），点击月格钻取月视图
  - 钻取导航链：年 → 月 → 周 → 日
  - 右键菜单：编辑快捷指令（跳转 QuickActions 页并选中 flow）/ 删除快捷指令（confirm 后删除整个 flow）
  - 数据过滤：仅显示含 Cron 触发器的 flow，无时间触发器的快捷指令不在时间轴呈现
- **静默更新选项**（SPEC 7.6 扩展）：
  - 设置-通用新增"静默更新"开关，开启后检测到更新自动后台下载安装
  - 与"静默自启"配合实现完全无感更新体验
- **OOBE 引导系统优化**：
  - SplashStage 动画：logo 弹出 + EXERO 字母展开 + 中英文打字机效果（无光标）
  - LicenseStage 协议同意按钮修复（Switch 事件冒泡导致点击无效）
  - 课表向导显示层级修复（被其他元素遮挡）
  - 底部进度条 + 顶部 OobeTopBar + 深色模式适配
- **全局 ErrorBoundary**：
  - 捕获懒加载 chunk 加载失败（dev 服务器重启 / 生产网络抖动 / 旧 chunk 404）
  - 显示友好错误提示 + 重试按钮（重置子树重新挂载）+ 刷新页面兜底
  - dev 模式显示错误详情折叠

### 优化

- **侧边栏默认折叠**：首次启动侧边栏默认收起，聚焦主内容区
- **属性面板折叠动画**：优化展开/收起过渡效果
- **帮助页布局**：重新组织信息架构，提升可读性
- **useDailyTriggers 数据流重构**：分离数据加载与日期解析，四视图共享同一份数据，`getBlocksForDate(date)` 纯函数按需解析
- **Vite 依赖预声明**：`optimizeDeps.include` 新增 `cron-parser`，避免首次访问日常模式触发依赖优化重载

### 修复

- **时间轴切换模式后白屏**：`setPage("quickactions")` 传入无效 PageId（应为 "quick-actions"），appMode 异步读取导致渲染时序问题。修正 PageId，从 oobe store 同步读取 appMode
- **OOBE 阶段流转错误**：`next()` 使用 `indexOf` 查找阶段，对不在序列中的元素返回 -1 取首元素。引入 `FULL_STAGE_ORDER` 合并 PRE/POST 序列
- **LicenseStage 协议同意点不动**：外层 div onClick 与 Switch onCheckedChange 事件冒泡导致两次切换抵消。Switch 外包 div 加 stopPropagation
- **V004 迁移自动插入示例数据**：V004__seed_courses.sql 在 refinery 迁移时自动执行 INSERT。注释 INSERT 语句，数据移至 src/assets/seed_courses_data.sql
- **日视图显示不完整 + 不能滚动**：左右分离结构滚动不同步，首尾块被裁剪。重构为单滚动容器 + buffer（顶 20px + 底 40px）
- **cron-parser 未预声明导致页面重载**：首次访问日常模式 Timeline 页面时 Vite 重新优化依赖。加入 `optimizeDeps.include`

### 已知问题

- 日常模式周/月/年视图为粗略信息显示，编辑快捷指令需通过右键菜单跳转日视图或快捷指令页
- 课表初始化向导跳过后，校园模式需手动创建学期才能使用完整功能

---

## V0.4.0-Beta5

**[强制更新] 市场-扩展机制重设计 + 插件系统 + Rust .dll 动态加载**

> 本版本重构了扩展包架构，引入插件系统与 Rust 动态加载机制，与 Beta4 不兼容。所有用户必须升级。

### 重大变更

- **pack_type 统一**：原 `action | lua_scripts` 合并为 `action`（Lua 脚本包归入动作包，通过 `executor_type: Lua` 区分），新增 `plugin` 类型。旧 manifest 需迁移
- **市场结构重构**：`Market/action-packs/`（动作包）+ `Market/plugins/`（插件）+ `market-index.json`（元数据索引，`list_market_packs` 只下载此文件）
- **示例扩展包 demo-pack 删除**：使用 B3 老链路，演示已由 Hello Plugin 替代

### 新增

- **Rust 动作动态加载**（SPEC 6.5）：
  - libloading 加载扩展包 .dll，C ABI 接口（`exero_pack_init` / `exero_pack_cleanup` / `exero_execute_action` / `exero_last_error`）
  - `exero-plugin-sdk` crate 提供 `declare_actions!` 声明式宏，自动生成 4 个 C ABI 导出函数
  - `RustLibraryRegistry` 管理 .dll 生命周期，支持同步全链卸载/重载
  - `ActionType::Extension(String)` 变体（格式 `pack_id:action_id`），base-pack Rust 动作不走 .dll
- **插件系统**（SPEC 6.5.3）：
  - Tauri `plugin` URI scheme 注册（Windows 路径格式 `http://plugin.localhost/{pack_id}/{file}`）
  - iframe 加载插件前端 + postMessage 桥接 API `window.exero.invoke(actionId, params)`
  - HTML 文件自动注入桥接脚本，插件开发者无需手动集成
  - 侧边栏入口为插件独占（`get_sidebar_entries` 加 `PackType::Plugin` 判断），动作包不再支持
  - `execute_plugin_action` 命令直连 .dll，不走 ActionExecutorRegistry
- **Hello Plugin 示例插件**（`examples/hello-plugin/`）：
  - 完整可运行最小插件：Cargo.toml + lib.rs（`say_hello` 动作）+ manifest.json + index.html
  - 暗色主题与主界面一致，"Call Rust" 按钮演示完整调用链
- **开发者文档**：
  - `docs/action-pack-guide.md`：动作包开发指南（Manifest 参考 + Lua API + 打包发布）
  - `docs/plugin-guide.md`：插件开发指南（SDK + 桥接 API + Hello Plugin 完整示例）
  - `docs/docs/`：Vue 文档风格 HTML 版本（GitHub Pages 在线浏览）

### 优化

- **build-packs.ps1 重写**：生成 `market-index.json` 元数据索引，新增 Hello Plugin 打包步骤（步骤 4/5）
- **manifest.rs 精简**：移除 `PackScriptManifest` / `LuaScripts`，`ActionManifest` 增加 `description` / `permissions` / `params` 字段
- **市场前端**：`ExtensionMarketTab.tsx` 移除 `lua_scripts` 相关逻辑，`pack_type=plugin` 显示紫色徽章 + "插件"筛选 Tag

### 修复

- **插件 iframe 显示宽度异常**：`PluginPage.tsx` 根容器从 `flex-1` 改为 `h-full`，标题栏 `shrink-0`，iframe 容器 `min-h-0`
- **卸载插件后侧边栏残留占位**：`ExtensionPackSection.tsx` 卸载时过滤 `sidebarOrder` 中不存在的 `pack_id` 并持久化；`Sidebar.tsx` reload 时过滤非存在 `pack_id`
- **市场类型筛选缺少"插件"Tag**：`FilterType` 添加 `"plugin"`，`PackTypeBadge` 按 `packType` 区分显示（插件紫色 / 动作包蓝色）

### 后端命令

- 新增 1 个 Tauri 命令：`execute_plugin_action`（直连 .dll 执行插件动作）

---

## V0.4.0-Beta4

**UI 优化 + 自动更新机制 + 静默自启**

### 新增

- **自动更新机制**（SPEC 7.6）：
  - GitHub Release 下载 x64 .exe 安装包（主源 + ghproxy 镜像后备）
  - NSIS `/S` 无人值守静默安装，安装后自动退出旧版本
  - [强制更新]：全屏阻断弹窗（仅"立即更新"或"退出软件"），屏蔽所有非更新操作
  - [推荐更新]：启动弹窗显示版本信息 + Release Note（可滚动），三选项（立即更新 / 忽略本次 / 取消该版本）
  - 保险措施：检测到强制更新时自动将 check_frequency 改为 startup，新版本启动后恢复原值
  - 临时目录旧安装包自动清理
- **静默自启**：设置-通用新增"静默自启"选项，自启时自动隐藏到托盘，用户可从托盘唤起主界面
- **React Flow 画布控制按钮折叠**：默认圆形菜单按钮，点击向上展开放大/缩小/适应视图，再点收回

### 优化

- **全局滚动条 Fluent 样式**：替换 Edge 默认滚动条为 Win11 Fluent 风格（细条 + 半透明 + hover 加深）
- **Vite 依赖预打包优化**：`optimizeDeps.entries` 限定根入口 + `include` 预声明 26 个运行时依赖，消除首次访问懒加载页面时的依赖优化重载

### 修复

- **时间轴右键菜单位置错误**：移除全屏 overlay，改用 document 级事件监听实现 click-outside 关闭，右键不同课程块时菜单直接跳到新位置
- **lib.rs 自启参数类型错误**：`--autostart` 参数从 `String` 改为 `&str`
- **CourseActionMenu.tsx 语法错误**：移除 overlay 后遗留的多余 `</div>` 闭合标签

### 重构

- **updateStore 重命名**：`stores/update.ts` → `stores/updateStore.ts`，避免与后端 `commands/update.rs` 在 IDE 大纲中混淆

### 后端命令

- 新增 4 个 Tauri 命令：`download_and_install_update` / `restore_check_frequency` / `prepare_force_update` / `cleanup_old_installers`

---

## V0.4.0-Beta3

**扩展包架构 + 在线扩展市场 + 侧边栏拖拽排序 + 动画优化**

### 重大变更

- **base-pack 改为在线安装**：不再内置捆绑 base-pack，tauri.conf.json 移除 resources 配置。base-pack 作为示例扩展包上传到 GitHub `action-packs/` 目录，用户首次启动需从扩展市场在线安装。所有来源扩展包均支持卸载（包括 builtin）
- **Lua 脚本市场 → 扩展市场**：快捷指令页第 4 Tab 从「Lua 脚本市场」重命名为「扩展市场」，直连 GitHub `action-packs/` 目录拉取 .exero-pack 列表，替代原 `scripts/` 目录的裸 .lua 文件分发

### 新增

- **Splash 重做**：移除独立 splash 窗口，采用单窗口 boot-splash 方案（main 窗口 visible:true 直接显示，index.html 内置占位 DOM，前端 ready 信号控制隐藏），彻底消除多窗口 DWM 边框残留导致的黑边问题
- **扩展包架构**（类比 MC 模组加载器）：
  - base-pack 外置到 `data/action-packs/base-pack/`，manifest.json 声明 20 种内置动作的元数据
  - 三目录扫描策略（只读 builtin / 可写 user / 自定义 custom），同名扩展包先加载的优先
  - 动态动作目录：前端 NodePalette 从后端拉取动作目录，替代硬编码枚举
  - 扩展包注册表 ExtensionPackRegistry，支持启动时加载 + 运行时重新扫描
- **扩展市场 Tab**（快捷指令页第 4 Tab，直连 GitHub 在线安装）：
  - GitHub Contents API 列 `action-packs/` 目录下 .exero-pack 文件
  - 在线安装 / 更新 / 卸载（下载到临时文件复用本地安装逻辑）
  - 网络后备：github.com 主 → ghproxy 镜像 → 离线模式（仅已安装）
  - 卡片式展示（名称 / 版本 / 作者 / 动作数 / 文件大小 / 侧边栏入口标记）
- **扩展包本地管理 UI**（设置页新增「扩展包」分区）：
  - .exero-pack 文件安装（zip 格式，文件选择器选择，覆盖同名）
  - 卸载扩展包（所有来源可卸载）
  - 打开扩展包目录（文件管理器）
  - 自定义目录设置 + 重新扫描
  - 已安装列表卡片式展示
- **侧边栏动态入口 + 拖拽排序**：
  - 扩展包可注册侧边栏入口，动态追加到内置导航之后
  - 展开模式下支持拖拽排序（仅扩展包入口之间，内置导航固定）
  - 拖拽手柄 hover 显示，排序持久化到 settings 表 `extension_pack.sidebar_order` 键
- **扩展包详情页**：统一详情页模板，展示元数据 / 来源 / 动作列表

### 优化

- **动画跟手性提升**：引入 Win11 Fluent 标准曲线 `cubic-bezier(0.16, 1, 0.3, 1)`，统一应用到页面切换 / 按钮按压 / 卡片 hover / 入场动画
- 新增 `.interactive` 交互反馈工具类（hover 背景 + active 按压），应用于侧边栏导航项、设置页导航项
- 侧边栏拖拽使用 PointerSensor + distance:5px 约束，区分点击与拖拽

### 后端命令

- 新增 5 个 Tauri 命令：
  - 本地管理：`install_pack_from_file` / `uninstall_pack` / `open_packs_dir`
  - 在线市场：`list_market_packs` / `install_pack_from_github`

### UI 优化与扩展市场增强

- **窗口边框重构**：`decorations:false` 取消原生边框，自定义 TitleBar 内嵌 Windows 三按钮（最小化/最大化/关闭），位置保持右上角
- **侧边栏 EXERO 标识**：左上角新增图标 + 粗体 Segoe UI "EXERO" 文字，折叠态居中显示
- **扩展市场搜索栏修复**：聚焦时左右边框被遮盖问题（提升 z-index + `focus-visible:ring-2`）
- **长横幅卡片响应式**：宽屏（≥640px）使用类 Modrinth 长横幅布局，窄屏回退网格卡片（ResizeObserver 监听容器宽度）
- **扩展包类型区分**：manifest 新增 `pack_type` 字段（action / lua_scripts），市场卡片显示类型徽章 + 筛选 Tag（全部 / 动作包 / Lua 脚本）
- **Lua 脚本包支持**：`pack_type=lua_scripts` 的扩展包安装时自动注册脚本到数据库，卸载时注销
- **骨架屏加载动画**：替换 Loader2 spinner 为 Skeleton 占位卡片（pulse 动画，零布局跳动）

### 市场目录统一

- **统一市场目录**：GitHub 仓库根目录新建 `Market/` 文件夹
  - `Market/action-packs/`：动作包 .exero-pack（pack_type=action）
  - `Market/lua-scripts/`：Lua 脚本包 .exero-pack（pack_type=lua_scripts）
- **删除旧市场命令链路**：`list_market_scripts` / `install_script` / `uninstall_script` / `update_script`（拉 `scripts/` 裸 .lua，前端已无调用方）+ `MarketScript` 类型
- **`list_market_packs` 增强**：分别拉两个子目录合并返回，支持动作包 + Lua 脚本包统一展示
- **Lua 脚本包打包脚本**：`scripts/build-packs.ps1`（.NET ZipFile）+ `scripts/lua-scripts-pack.json`（3 个示例脚本 manifest）

---

## V0.4.0-Beta2

**时间轴重构 + 图标系统完善 + UI 细节优化**

### 变更

- **日时间轴重构**：移除拖拽功能改为纯展示模式，保留点击编辑与右键菜单
- **图标系统完善**：深浅双版本应用图标，主题联动切换 favicon 与任务栏图标
- **UI 细节优化**：
  - 去除 Sidebar 标题重复
  - 修复 Splash 黑边（Beta3 彻底重做）
  - EXERO Logo（SegoeUI 粗体）
  - 动画性能优化（页面切换 fade-in + GPU 加速 + 微交互工具类）
- **快捷指令/关于页增强**：
  - 属性面板自动折叠
  - 执行日志按日期范围清空（修复 SQL 比较方向反转 bug）
  - 关于页 Markdown 更新历史
  - 构建日期 unknown 修复（build.rs 注入 BUILD_DATE）
  - 技术栈与 License 折叠

---

## V0.4.0-Beta1

**Phase 6b 收尾交付（NSIS 打包 + 更新检查器 + 关于/帮助页 + 导入导出 + URL 别名）**

### 新增

- **NSIS 打包配置完善**：installMode=currentUser（避免 UAC），LZMA 压缩，中英文双语，LICENSE + CHANGELOG.md 随包分发
- **更新检查器**（SPEC 第七章）：
  - GitHub Release latest API + ghproxy 镜像后备 + 离线回退本地 CHANGELOG.md
  - 三级更新级别标记解析（`[强制更新]` / `[推荐更新]` / `[最低版本 x.y.z]`，SPEC 7.2/13.6）
  - SPEC 13.10 自定义 SemVer 版本号比较（Major.Minor.Patch-StageN）
- **关于页**：应用基本信息 + 15 项技术栈 + MIT 许可（含娱乐性 24 小时删除声明）+ GitHub 仓库链接 + 更新历史（云端优先）
- **帮助页**：V0.4.0 占位文案（功能说明 / FAQ / 错误代码 / 概念词典待后续补充）
- **导入导出功能**（SPEC 5.5）：.exero 文件格式（zip 包含 meta.json + data.json + scripts/*.lua），4 范围可选，2 模式（merge / replace），事务性数据库操作
- **URL 短域名别名配置**（SPEC 11.3）：设置页可编辑映射表，OpenUrl 动作自动解析别名（优先级：别名匹配 > scheme 补全 > 原样使用）
- **设置页 5 分区完整**（外观 / 通用 / 更新 / 关于 / 帮助）

### 后端命令

- 新增 9 个 Tauri 命令：`get_app_info` / `check_for_updates` / `get_changelog` / `get_changelog_path` / `export_data` / `import_data` / `get_url_aliases` / `set_url_aliases` / `reset_url_aliases`

---

## V0.4.0-alpha.1

**首发版本（Alpha 阶段）**

### 核心功能

- **Phase 1**：核心调度 + 动作执行骨架
  - Tauri v2 + Rust 后端骨架
  - 数据库初始化（rusqlite + refinery，5 张核心表）
  - 20 种动作执行器（应用与文件 / 媒体与输入 / 系统与电源 / 通知 / 控制流 / Lua 脚本）
  - 触发器调度器（Cron / 系统事件 / 手动三类）
  - 动作链执行引擎 ChainEngine（支持顺序、分支、循环、容错）
  - Tauri 命令暴露（Flow / Action / Trigger / Log / Setting 完整 CRUD）

- **Phase 2**：UI 骨架 + 首页 Dashboard
  - Tauri v2 + React 18 + TypeScript + Vite 前端骨架
  - Tailwind CSS + shadcn/ui 配置（Win11 Fluent Design，8 色主题色板）
  - 侧边栏布局（E Logo + 5 项导航 + 可折叠，触控目标 ≥ 48px）
  - 5 页面骨架（首页 / 时间轴 / 快捷指令 / 性能优化 / 设置）
  - 首页 Dashboard 4 模块（今日任务 / 最近执行记录 / 系统状态 / 快捷动作）

- **Phase 3**：时间轴页面
  - V003/V004 迁移：4 张新表（semesters / class_periods / courses / schedule_overrides）+ 示例学期与课表
  - 时间轴四视图（日 / 周 / 月 / 年）+ 格点 / 自由双模式
  - @dnd-kit 拖拽编辑（Pointer + Touch + Keyboard 三传感器，30Hz 触屏）
  - 长按 500ms 操作菜单 + 临时调课（cancel / move）
  - 学期制多周课表（week_pattern: all / odd / even）

- **Phase 4**：可视化编辑器 + 性能优化页
  - React Flow 集成 + 三栏布局（节点库 / 画布 / 属性面板）
  - 20 种动作节点 + 贝塞尔曲线连线
  - 性能优化页：硬件监控 / 进程管理 / 一键优化
  - 自动化设置 Tab

- **Phase 5**：Lua 集成
  - mlua crate（LuaJIT，vendored 从源码编译）
  - 严格沙箱机制 + 可选宽松沙箱
  - 变量系统 + exero 库注入
  - Lua 脚本市场（GitHub Contents API + ghproxy 镜像后备 + 离线模式）
  - 3 个示例脚本（hello-world / counter / system-info）

- **Phase 6a**：核心体验
  - 系统集成（托盘 / 自启 / Toast / 关闭行为拦截）
  - 主题系统（深浅模式 + 8 色主题 + Mica 可选）
  - 动画系统（200ms 过渡，兼容 30Hz）
  - Splash Screen（多窗口启动画面）
  - 课表初始化引导向导（4 步配置 + 演示模式 + 空状态）

- **Phase 6b**：收尾
  - NSIS 打包（lzma2 压缩 + 中英文 + LICENSE）
  - 更新检查器（GitHub Release latest API + 强制更新 + 网络后备）
  - 关于页 + 帮助页
  - 导入导出功能（.exero zip 包，含 JSON + Lua 脚本）
  - URL 短域名别名配置（baidu / google / github / bing 默认）

### 技术栈

- 后端：Rust（edition 2021）、Tauri v2、SQLite、tokio、tracing、mlua（LuaJIT）
- 前端：React 18、TypeScript、Vite、Tailwind CSS、shadcn/ui、React Flow
- 打包：NSIS
- 版本管理：Git + GitHub

### 已知限制

- LibreHardwareMonitorLib 集成占位（温度监控暂未实现）
- 仅 Windows 10/11，不考虑跨平台
- 全局管理员权限运行（学校机器 UAC 已关闭）
- 4GB 内存机器性能软性关注

### License

MIT + 娱乐性 24 小时删除声明（无法律效力）
