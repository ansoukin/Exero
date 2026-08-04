# Exero

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4.svg)]()
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131.svg?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-stable-CE422B.svg?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![Version](https://img.shields.io/badge/Version-0.4.0--Beta1-orange.svg)]()
[![Phase](https://img.shields.io/badge/Phase-6%20All%20Complete-brightgreen.svg)]()

个人自动化助手 - 基于 Tauri v2 + Rust 的 Windows 桌面自动化工具。

通过"快捷指令 + 可视化积木"理念，将时间触发、系统事件、手动操作等多种触发方式与 20 种动作类型组合，实现日常场景的自动化。

## 当前状态

**V0.4.0 Beta1** - UI 优化与日志清空增强：

**Phase 6b 收尾**：

- NSIS 打包配置完善（installMode=currentUser，LZMA 压缩，中英文双语，LICENSE + CHANGELOG.md 随包分发）
- 更新检查器（SPEC 第七章）：GitHub Release latest API + 三级更新级别标记解析（`[强制更新]`/`[推荐更新]`/`[最低版本 x.y.z]`，SPEC 7.2/13.6）+ ghproxy 镜像后备 + 离线回退本地 CHANGELOG.md + SPEC 13.10 自定义 SemVer 版本号比较（Major.Minor.Patch-StageN）
- 关于页：应用基本信息 + 15 项技术栈 + MIT 许可（含娱乐性 24 小时删除声明）+ GitHub 仓库链接 + 更新历史（云端优先）
- 帮助页：V0.4.0 占位嘲讽/自嘲文案（功能说明 / FAQ / 错误代码 / 概念词典待后续补充）
- 导入导出功能（SPEC 5.5）：.exero 文件格式（zip 包含 meta.json + data.json + scripts/*.lua），4 范围可选（flows / courses / settings / scripts / all），2 模式（merge / replace），事务性数据库操作
- URL 短域名别名配置（SPEC 11.3）：设置页可编辑映射表，OpenUrl 动作自动解析别名（优先级：别名匹配 > scheme 补全 > 原样使用），默认别名 baidu/google/github/bing
- 设置页 5 分区完整（外观 / 通用 / 更新 / 关于 / 帮助）
- 8 个新 Tauri 命令（get_app_info / check_for_updates / get_changelog / get_changelog_path / export_data / import_data / get_url_aliases / set_url_aliases / reset_url_aliases）

**Phase 6a 核心体验**：

- 系统集成（SPEC 4.1）：系统托盘（显示主窗口 / 退出菜单 + 左键单击显示）+ 开机自启（tauri-plugin-autostart）+ Toast 通知（tauri-plugin-notification）
- 关闭主窗口行为（SPEC 4.2）：弹窗询问 / 最小化到托盘 / 退出，记住选择，设置页可重置
- 主题系统（SPEC 3.5 分区 1）：深浅模式（跟随系统 / 浅色 / 深色）+ 8 色 Win11 主题色板 + Mica 背景开关
- 动画系统：200ms 过渡 + 触控目标 ≥ 48px + Win11 Fluent Design
- Splash Screen：400×250 无边框窗口 + 1.5 秒后切换主窗口
- 课表初始化引导向导（SPEC 11.2）：首次启动检测 + 欢迎页（开始配置 / 跳过 / 加载示例数据）+ 4 步向导（学期 / 节次 / 课程 / 确认）+ 演示模式 + 空状态设计
- 演示模式：主窗口标题栏标识 + 设置页"退出演示模式"入口

**Phase 5 已完成** - Lua 集成：

- mlua crate 从 Lua 5.4 切换到 LuaJIT（vendored 从源码编译）
- 严格沙箱机制（默认禁用 os.execute / io.popen / loadfile / require 等危险 API）+ 可选宽松沙箱（settings 持久化）
- 变量系统：Arc<RwLock<HashMap>> 实现 Lua 脚本与 ExecutionContext 之间的变量读写，支持局部变量和全局变量
- exero 库注入：log / notify / get_var / set_var / set_result
- 128MB 内存限制 + 指令计数 hook 超时检测（默认 10 秒）
- V006 迁移：lua_scripts 表持久化已安装脚本元数据（script_id / name / author / version / permissions / params_schema / content_hash）
- Lua 脚本市场（对接 GitHub 仓库 scripts/ 目录）：
  - GitHub Contents API 主源 + ghproxy 镜像后备 + 离线模式
  - 6 个 Tauri 命令（list_installed / get_detail / list_market / install / uninstall / update）
  - SHA256 内容哈希用于更新检测
- 前端 LuaMarketTab：市场列表 + 已安装列表 + 离线提示 + 详情 Dialog + 安装/卸载/更新
- LuaScriptForm 升级：script_id 从已安装列表选择 + 根据 manifest params_schema 动态生成参数表单（string / number / boolean / select）
- 3 个示例脚本：hello-world（基础 API）/ counter（变量系统）/ system-info（os 库）
- P0 修复：应用内通知监听组件（NotificationToast，右下角卡片 + 4 级颜色 + 5 秒自动消失）
- P0 修复：音量 API 从 waveOutSetVolume 切换到 WASAPI IAudioEndpointVolume（正确控制系统主音量）
- P0 修复：execution_logs 主键冲突（repository 新增 update_log，chain.rs 改用 update 替代重复 insert）
- P1 修复：URL 自动补全 scheme（baidu.com -> https://baidu.com）
- P1 修复：音量设置时同步取消静音状态
- P1 增强：模拟按键弹窗捕捉模式（KeyCaptureOverlay 全屏遮罩 + 按键组合识别）

**Phase 4 已完成** - 可视化编辑器 + 性能优化页：

- V005 迁移：actions 表加 position_x/position_y 字段（节点画布坐标持久化）
- React Flow (@xyflow/react) 集成 + 三栏布局（节点库 / 画布 / 属性面板）
- 卡片式节点 + 贝塞尔曲线连线，6 类 20 种 ActionType 全量支持
- 自定义节点组件（ActionNodeView）：图标 + 标题 + 参数摘要 + 端口
- 控制流多端口：IfElse（then/else 双输出）、Loop（body 输出）
- actions ↔ nodes/edges 双向转换（graphTransform.ts），与 chain.rs 执行引擎对齐
- 20 种属性表单（6 类分批实现）+ 公共字段（容错策略 / 备注）
- 单击选中 → 右侧属性面板实时编辑（SPEC 308 行交互规范）
- 4 Tab 切换：指令列表 / 执行日志 / 自动化设置 / Lua 脚本市场（占位）
- 指令卡片网格（图标 / 名称 / 触发器数 / 状态开关 / 运行按钮 / 删除按钮）
- 执行日志三级筛选（全部 / 成功 / 失败）+ 展开查看错误详情
- 自动化设置（默认音量 / Lua 超时 / 日志保留 / 并发模式）
- 性能优化页（SPEC 3.6 页面4）：
  - 硬件监控：CPU 使用率（总体 + 各核心）/ 内存（已用/可用/总量）/ 温度（占位待 LHB 集成）
  - 进程列表：Top 20（按 CPU/内存排序），支持优先级调整与结束进程
  - 一键优化：结束黑名单进程 + 降级高 CPU 进程 + EmptyWorkingSet 释放内存
  - 黑名单配置（settings 表持久化，用户配置覆盖默认）
  - 后端 sysinfo crate + Windows API（SetPriorityClass / TerminateProcess / EmptyWorkingSet）

**Phase 3 已完成** — 时间轴页面：

- V003/V004 迁移：4 张新表（semesters / class_periods / courses / schedule_overrides）+ 示例学期与课表
- models/semester.rs + models/course.rs + commands/courses.rs（18 个 Tauri 命令）
- 时间轴四视图（日 / 周 / 月 / 年）+ 格点/自由双模式
- @dnd-kit 拖拽编辑（Pointer + Touch + Keyboard 三传感器，30Hz 触屏）
- 长按 500ms 操作菜单（编辑 / 复制 / 临时取消 / 临时调整 / 删除）
- 临时调课（cancel / move，不修改常规课表）
- 学期制多周课表（week_pattern: all / odd / even）
- 5 个新 shadcn/ui 组件（dialog / input / label / textarea / select）

**Phase 2 已完成** — UI 骨架 + 首页 Dashboard：

- Tauri v2 + React 18 + TypeScript + Vite 前端骨架
- Tailwind CSS v3 + shadcn/ui 配置（Win11 Fluent Design，8 色主题色板）
- 侧边栏布局（E Logo + 5 项导航 + 可折叠，触控目标 ≥ 48px）
- 5 页面骨架（首页 / 时间轴 / 快捷指令 / 性能优化 / 设置）
- 首页 Dashboard 4 模块（今日任务预览 / 最近执行记录 / 系统状态占位 / 快捷动作）
- Zustand 状态管理（页面切换 + 侧边栏折叠）
- Tauri 命令完整封装（TypeScript 镜像后端模型与命令）

**Phase 1 已完成** — 核心调度与动作执行骨架：

- Tauri v2 + Rust 后端骨架
- 数据库初始化（rusqlite + refinery，5 张核心表）
- 20 种动作执行器（应用 / 媒体 / 系统 / 通知 / 控制流 / Lua）
- 触发器调度器（Cron / 系统事件 / 手动三类）
- 动作链执行引擎（ChainEngine，支持顺序、分支、循环、容错）
- Tauri 命令暴露（Flow / Action / Trigger / Log / Setting 完整 CRUD）
- 15 个 unit tests 通过

## 技术栈

**后端**：Rust（edition 2021）、Tauri v2、SQLite（rusqlite + refinery）、tokio、tracing、mlua（LuaJIT）

**前端**（Phase 2 起）：React 18、TypeScript、Vite、Tailwind CSS、shadcn/ui、React Flow

## 快速开始

### 环境要求

- Rust 工具链（stable channel）
- Visual Studio 2022 Build Tools（v143 工具集，x64）
- Git

### 编译与测试

```powershell
cd src-tauri
.\check.bat
```

脚本依次运行 `cargo check` 与 `cargo test --lib`，结果写入 `cargo_check.log` 与 `cargo_test.log`。

## 项目结构

```text
Exero/
├── src-tauri/               # Rust 后端
│   ├── src/
│   │   ├── db/              # 数据库层（connection / migrations / repository）
│   │   ├── models/          # 数据模型（flow / action / trigger / log / setting / semester / course / lua / url_alias）
│   │   ├── actions/         # 20 种动作执行器（含 OpenUrl 别名解析）
│   │   ├── triggers/        # 触发器（cron / system_event / manual / scheduler）
│   │   ├── executor/        # 动作链执行引擎 ChainEngine
│   │   ├── commands/        # Tauri 命令暴露层（16 模块）
│   │   ├── state.rs         # 应用全局状态
│   │   └── error.rs         # 错误类型
│   ├── migrations/          # SQL 迁移脚本（V001-V006）
│   ├── capabilities/        # Tauri v2 权限配置
│   └── Cargo.toml
├── src/                     # React 前端
│   ├── components/          # 复用组件（Layout / Sidebar / TitleBar / ui / OnboardingWizard）
│   ├── pages/               # 5 大页面 + settings 子模块（5 分区）
│   ├── stores/              # Zustand stores（theme / onboarding / app）
│   ├── lib/                 # 工具库（tauri 封装 / utils / theme）
│   ├── App.tsx
│   └── main.tsx
├── scripts/                # Lua 脚本市场（hello-world / counter / system-info）
├── docs/
│   ├── SPEC.md             # 设计规格文档
│   └── index.html          # GitHub Pages 落地页
├── CHANGELOG.md            # 更新历史
├── LICENSE                 # MIT + 娱乐性 24 小时删除声明
├── README.md
└── package.json
```

## 设计文档

完整的 26 轮需求讨论与设计决策见 [docs/SPEC.md](docs/SPEC.md)。

## 目标平台

- Windows 10/11，x64
- 全局管理员权限运行（UAC 关闭）
- 不考虑跨平台

## License

[MIT](LICENSE)
