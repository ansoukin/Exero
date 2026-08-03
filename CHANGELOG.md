# 更新历史

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
