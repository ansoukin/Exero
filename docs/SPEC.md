# Exero V0.4.0 设计规格文档

> **版本**：V0.4.0-Beta4 · SPEC V2.3 修订版
> **状态**：Beta 测试阶段（Beta3 已交付，Beta4 开发中）
> **日期**：2026-07-18（初版）/ 2026-07-23（V2 修订）/ 2026-08-08（V2.3 修订）
> **作者**：AI 协作生成（基于需求讨论）

> **⚠️ AI 协作开发必读**：所有对话（P1-P6 及后续迭代）在开始开发前，**必须先阅读 [9.6 AI 协作开发规则](#96-ai-协作开发规则重点)**。该节定义了 TraeWork 规则、CLAUDE.local.md 四大准则、规则优先级和临时记忆机制，是预防 AI 胡思乱想/过度设计/擅自改动的核心约束。**不读 9.6 节就开始写代码 = 违规操作。不读 CLAUDE.local.md = 违规操作。不认真读 SPEC 有关章节 = 违规操作。**
>
> **🔴 最高准则：不懂就问用户**。任何不确定的地方，**先问用户，再动手**。宁可多问一句，也不要擅自假设后写出错误代码。用户不在就停下来等待，不要"先写个大概"。此准则凌驾于所有编码准则之上。

## 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| V1 | 2026-07-18 | 初版，基于 26+ 轮需求讨论汇总 |
| V2 | 2026-07-23 | 基于 Phase 1-2 实际开发反馈 + P3 重新 Remake 需求修订：新增课程与学期数据模型（5 表含 weekly_templates）；重写 3.5 页面 2 时间轴（三视图改为周/月/年三级递进，月视图直接列课程详情，年视图三级钻取）；扩充 Phase 3 交付物 |
| V2.1 | 2026-07-24 | 时间轴拖拽体验修订：四视图体系（新增日视图承载时间轴拖拽，周视图及以上改网格）；拖拽性能优化（rAF 节流 + ref 缓存 + hysteresis 滞后区解决鬼影抽搐）；click 拦截升级（dragStart 即时抑制 + dragEnd 后 500ms 禁用窗口根治编辑弹窗误弹）；落点视觉强调重构（高亮线 + 简化色条 + 双侧时间标签明确"拖到哪一刻"） |
| V2.2 | 2026-08-03 | P4 反馈修复：动作节点数量 12 种 -> 6 类共 20 种（与后端 ActionType 一致）；节点编辑交互明确为单击选中->右侧面板实时编辑（不弹模态框）；Phase 4 交付物补全性能优化页（SPEC 3.6 页面4 原遗漏）；新增第十三章发布流程（AI 准备+用户执行分工/三级更新级别标记 `[强制更新]`/`[推荐更新]`/`[最低版本 x.y.z]`/GitHub+ghproxy 发布渠道）；新增 13.10 版本号命名规则（自定义 SemVer：`VMajor.Minor.Patch-StageN`，Alpha/Beta 从 1 开始，首字母大写，GitHub Tag 用 v 前缀）+ 版本号比较规则（两级比较：语义化版本号优先，相同则比阶段 Alpha<Beta<Stable）；新增 9.6 AI 协作开发规则（TraeWork rules + CLAUDE.local.md 四大准则 + 规则优先级 + tmemory.md 临时记忆机制）；SPEC 开头新增"不懂就问用户"最高准则；第十章深度简化为开发历史归档汇总表（P1-P6 已全部完成）；版本状态更新为 V0.4.0-Beta2（Beta3 开发中） |
| V2.3 | 2026-08-08 | Beta4 需求修订：全局滚动条 Fluent 样式优化（全局 `*` 选择器 + 保留 `.scrollbar-fluent`）；React Flow 画布控制按钮自定义样式+折叠交互（圆形菜单按钮展开/收回，`useReactFlow` hook 自建）；自动更新机制（7.6 新增：GitHub/ghproxy 下载 .exe 至临时目录 -> NSIS `/S` 静默安装 -> 应用退出；新版本启动时清理临时安装包）；强制更新全屏阻断弹窗（仅"立即更新"/"退出软件"）+ 自动改 `update.check_frequency` 为 `startup` 保险措施（原设置存 `update.previous_check_frequency`，新版本启动后复原）；推荐更新弹窗三选项：立即更新 / 忽略更新（本次跳过） / 取消（持久忽略此版本 `update.ignored_version`）；时间轴右键菜单位置修复（移除全屏 overlay 改用 document 事件监听，课程块 stopPropagation 使菜单直接更新到新位置） |
| V2.4 | 2026-08-09 | Beta5 市场扩展机制重设计：pack_type 统一为 action\|plugin（原 action\|lua_scripts 合并）；Rust .dll 动态加载（libloading + C ABI + exero-plugin-sdk declare_actions! 宏）；插件系统（Tauri `plugin` URI scheme + iframe + postMessage 桥接 API `window.exero.invoke`）；侧边栏入口为插件独占（动作包不再支持）；市场结构 Market/action-packs/ + Market/plugins/ + market-index.json；Hello Plugin 示例插件；开发者文档（docs/action-pack-guide.md + docs/plugin-guide.md） |

---

## 一、项目概览

### 1.1 项目定位

Exero 是一款面向 Windows 的桌面自动化管理工具，定位为"个人自动化助手"。基于"快捷指令 + 可视化积木"理念，支持时间触发、系统事件触发、手动触发等多种触发方式，配合 6 类共 20 种动作类型（含 Lua 脚本扩展），实现教室/工作场景的自动化管理。

### 1.2 目标用户

- **主要用户**：开发者本人（自用工具）
- **使用场景**：日常教室自动化（放学关机、上课静音等）、个人偷懒工具
- **部署环境**：学校 HiteVison 教育用 PC（i5-8400 + 4GB DDR4 + 4096×3072 30Hz 触屏）

### 1.3 技术栈

| 层次 | 技术 |
|---|---|
| 应用框架 | Tauri v2 |
| 后端语言 | Rust（LTSC 版本，参考 NexBox 配置） |
| 前端框架 | React + TypeScript |
| 前端构建 | Vite |
| 包管理器 | pnpm |
| UI 组件库 | shadcn/ui + Radix + Tailwind CSS |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| 数据获取 | TanStack Query |
| 表单 | react-hook-form + zod |
| 可视化编辑器 | React Flow (@xyflow/react) |
| 数据库 | SQLite (rusqlite + refinery 迁移) |
| 异步运行时 | tokio |
| 错误处理 | anyhow (应用层) + thiserror (库层) |
| 日志 | tracing + tracing-subscriber |
| Lua 引擎 | LuaJIT (mlua crate) |
| 硬件监控 | LibreHardwareMonitorLib (借鉴 NexBox) + sysinfo crate |
| 图标 | lucide-react |
| 字体 | 系统字体（Segoe UI + Microsoft YaHei） |
| 打包 | NSIS 安装包 |
| 版本管理 | Git + GitHub |

### 1.4 目标平台

- **操作系统**：仅 Windows 10/11
- **架构**：x64
- **权限**：全局管理员权限运行
  - UAC 已关闭（用户主动关闭，避免弹窗干扰）
  - 学校机器用户即为管理员，无权限障碍
- **跨平台**：不考虑
- **还原卡**：学校机器已禁用还原模块（用户主动"驱逐并杀死"），数据可持久保存

---

## 二、产品形态

### 2.1 核心理念

**通用自动化平台 + 可视化积木**——借鉴 iOS 快捷指令设计，用户通过拖拽积木块组合动作链，配合多种触发器实现自动化。

### 2.2 数据模型

#### 快捷指令（AutomationFlow）

- 1 条快捷指令 = N 个触发器 + 1 个动作链
- 任意触发器触发时，执行同一动作链
- 支持启用/禁用开关

#### 触发器（Trigger）

V0.4.0 支持 3 类触发器：

| 类型 | 子类型 | 参数 |
|---|---|---|
| **时间类** | 定时触发 | cron 表达式 |
| **时间类** | 课表触发 | 关联课程块（课前/课中/课后） |
| **系统事件** | 开机/关机 | 无 |
| **系统事件** | 登录/锁屏 | 无 |
| **系统事件** | USB 插拔 | 设备名（可选） |
| **系统事件** | 网络变化 | 无 |
| **系统事件** | 进程启停 | 进程名 + 启动/停止 |
| **手动类** | 首页快捷按钮 | 无 |
| **手动类** | 托盘菜单 | 无 |

#### 动作（Action）

V0.4.0 支持 6 类动作：

| 类别 | 动作 |
|---|---|
| **应用与文件** | 启动程序 / 关闭进程 / 打开网页 / 打开文件 |
| **媒体与输入** | 音量调节 / 播放声音 / 模拟按键 |
| **系统与电源** | 关机 / 重启 / 锁屏 / 休眠 / 注销 / 清理临时文件 / 电源计划切换 |
| **通知** | Toast 通知 / 应用内通知 |
| **控制流** | if/else 分支 / loop 循环 / 变量赋值 |
| **Lua 脚本** | 调用市场脚本（含参数） |

#### 动作链（ActionChain）

- 顺序执行 + 条件分支 + 循环 + 变量传递
- 每个动作可配置容错策略：继续 / 停止 / 回滚 / 通知用户
- 支持变量系统（供 Lua 脚本与动作参数引用）

#### 课程与学期数据（5 表，Phase 3 新增）

时间轴页面与"课表触发器"依赖以下 5 张表，与流程数据（5 张表）解耦，独立成域：

| 表 | 用途 | 关键字段 |
|---|---|---|
| **semesters** | 学期定义 | id, name, start_date, end_date, week_count, is_active |
| **class_periods** | 节次时间表（按学期可配置） | id, semester_id, period_index, start_time, end_time, name（如"第1节"/"午休"） |
| **weekly_templates** | 周课表模板（普通周/特殊周） | id, semester_id, name（如"普通周"/"期中考试周"）, description, color |
| **courses** | 课程实体（归属周模板） | id, semester_id, template_id（NULL=普通周）, subject, day_of_week(1-7), period_index, start_time, end_time, teacher, room, color, note |
| **schedule_overrides** | 临时调课记录（单次生效） | id, semester_id, date, type(cancel/move/add), course_id, target_period_index, target_start_time, target_end_time, note |

**设计要点**：
- `class_periods` 归属 `semester_id`，不同学期可有不同作息（如夏季/冬季作息）
- `weekly_templates` 支持特殊周模板（考试周/活动周），可复用——多个周可指向同一模板
- `courses` 存储周课表（day_of_week + period_index 定位），`template_id` 关联模板，NULL = 普通周默认模板
- `courses` 同时存 `period_index`（节次定位）和 `start_time/end_time`（精确时间定位），拖拽时两个字段互斥更新
- `schedule_overrides` 是单次调课记录，与 `courses` 是覆盖关系而非修改关系——保证原课表模板不被破坏
- 调课合并逻辑为纯函数：`cancel` 标记取消、`move` 原位取消+新位生成、`add` 直接生成临时 Course

### 2.3 课程与指令关系

- 课程块作为**触发器之一**（"当前课程开始/结束"作为系统事件触发器）
- 课程与快捷指令**解耦**——用户可在快捷指令中用"当前课程"作为触发条件
- 时间轴页面支持课程块拖拽编辑、临时调课
- **数据解耦**：课程数据（5 表）与流程数据（5 表）完全独立，课表触发器通过"当前课程"语义关联，不直接外键耦合

---

## 三、UI/UX 设计

### 3.1 设计风格

- **Win11 Fluent Design**
- 删除 Legacy 的 Metro 风格设计文档
- 8px 网格系统
- 圆角 6-8px
- 200ms 动画过渡（兼容 30Hz 屏幕）
- 触控目标 ≥ 48px（适配 UHD 触屏）

### 3.2 主题系统

| 项 | 说明 |
|---|---|
| 模式 | 深色 / 浅色（跟随系统） |
| 主题色 | 8 色 Win11 色板（蓝/绿/橙/紫/红/青/粉/黄） |
| 背景 | 默认纯色 + 可选 Mica 背景 |
| 切换位置 | 主题切换在设置页（侧边栏底部不放） |

### 3.3 主窗口布局

```
┌─────────────────────────────────────────────┐
│  [标题栏 - 可拖拽区域]              [_][□][×]│
├─────────┬───────────────────────────────────┤
│    D    │                                   │
│         │                                   │
│  🏠 首页 │         主内容区                  │
│  📅 时间轴│      （根据侧边栏选择切换）        │
│  ⚡ 快捷指令│                                  │
│  📊 性能 │                                   │
│  ⚙️ 设置 │                                   │
│         │                                   │
│  📌 折叠 │                                   │
└─────────┴───────────────────────────────────┘
```

- **侧边栏**：参考 1Panel 设计，可折叠
  - 顶部 Logo 区：占位一个"D"字母（未来正式版前替换为正式 Logo）
  - 中部导航项：5 项（首页 / 时间轴 / 快捷指令 / 性能优化 / 设置）
  - 底部控制区：仅折叠/展开按钮（主题切换在设置页，不放侧边栏底部）
- **默认窗口尺寸**：1280×800
- **最小窗口尺寸**：1024×600

### 3.4 启动流程

1. **Splash Screen 启动画面**（参考 NexBox 实现）
   - 中间显示"Exero"文字（无 Logo，未来正式版前再设计）
   - 下方彩虹渐变色进度条
   - 加载完成后自动关闭，显示主窗口
2. 后端初始化（数据库连接、触发器调度器启动、托盘创建等）
3. **首次启动检测**：检查 `settings` 表是否存在 `onboarding_completed` 标记
   - 未标记 → 显示课表初始化引导向导（详见 [11.2 节](#112-课表初始化引导向导phase-6)）
   - 已标记 → 直接显示主窗口
4. 显示主窗口

### 3.5 5 大页面设计

#### 页面 1：首页 Dashboard

**模块**：
- 今日任务预览（按时间排序）
- 最近执行记录（成功/失败状态）
- 系统状态卡片（CPU/内存使用率）
- 快捷动作（常用指令一键运行）

#### 页面 2：时间轴

**四视图体系**（日/周/月/年，四级递进；V2 修订：原为周/月/年三级，新增日视图承载时间轴拖拽）：

| 视图 | 形态 | 核心职责 |
|---|---|---|
| **日视图**（默认主视图） | 纵向时间轴 7:00-22:00（15 小时）+ 单日列 + 节次虚线辅助线 | 单日时间轴，支持拖拽调整课程时间/时长，竖向拖拽含原位虚影+预览块+节次线对齐三层视觉强调 |
| **周视图** | 7 天×节次网格（传统课表形态，行=节次，列=周一到周日） | 本周课程总览，点击格点钻取日视图，不支持拖拽改时间 |
| **月视图** | 6×7 日历方格 | 表格化展示每日课程详情，每格直接列出当天课程名+时间，点击格点跳转周视图 |
| **年视图** | 12 月方格（3×4）+ 密度色深 | Win10 日历式总览，每月格显示课程密度色深，四级钻取导航（年->月->周->日） |

> **V2 修订说明**：原 V2 周视图为 7 列时间轴，实测 7 列时间轴 dnd-kit collision 在列边界存在反复横跳（鬼畜）bug，且 7 列时间轴信息密度过高。修订为：时间轴形态归日视图，周视图及以上改为网格视图，专精信息总览，拖拽编辑集中在日视图。

**日视图**（时间轴形态）：
- 纵向时间轴每小时 56px，覆盖 7:00-22:00
- 节次辅助线：虚线标注节次区间（如"第1节 8:00-8:45"），仅作参考不强制对齐
- 课程块落在对应时间点，高度反映时长跨度
- 颜色按科目名 hash 分配（8 色 HSL 色板，color-mix 实现背景透明度）
- 整块竖向拖动改时间：拖动课程块主体，实时显示新 start_time/end_time，松手后同时更新两个字段
- 底边手柄改时长：课程块底边 resize 手柄，拖动只改 end_time，start_time 固定
- 拖拽库：@dnd-kit（Pointer + Touch + Keyboard 三传感器，30Hz 触屏硬需求，激活阈值 8px + TouchSensor delay 200ms）
- **拖拽视觉强调（V2.1 修订：四层反馈，明确"拖到了哪一刻"）**：
  1. 原位虚影：被拖拽课程原位置变 opacity-40 + dashed 边框 + "原位置"标签，不移动 transform
  2. 跟随光标块：DragOverlay 始终启用，渲染完整 CourseBlock 跟随光标移动，让用户看到"抓着块在动"
  3. 落点高亮线：横跨时间轴的彩色实线（带阴影发光），精准指向预览块顶部位置，左侧标注新起始时间、右侧标注新结束时间
  4. 简化色条预览块：半透明色块标注预计占据的时间段范围，内含科目名+时间段，按 5 分钟吸附 + 节次线对齐（hysteresis 滞后区：ENTER 10min / LEAVE 18min）计算位置
- **拖拽性能优化（V2.1 新增，解决鬼影抽搐）**：
  - rAF 节流：dragMove + pointermove 高频回调合并到下一帧，避免 30Hz 触屏每帧 setState 重渲染
  - ref 缓存：overTarget / freePreview / cursor 与上一次值相同时跳过 setState，避免无意义重渲染
  - hysteresis 滞后区：节次线对齐吸附进入阈值 10 分钟、脱离阈值 18 分钟，避免光标在边界抖动时反复吸附/脱离导致预览块跳变
- **拖拽/长按冲突根治（V2.2 修订：双击触发编辑 + 禁用窗口双保险）**：
  - **双击触发编辑**（从根源解决）：CourseBlock.onClick 改为双击检测，300ms 内两次点击才打开编辑弹窗；拖拽/长按后的合成 click 只是"第一次点击"，不会触发编辑
  - **第一道防线**（clickSuppression.ts）：dragStart 瞬间进入"拖拽中"模式拦截所有 click；dragEnd 后启动 500ms 禁用窗口
  - **第二道防线**（CourseBlock 双击检测）：即使禁用窗口外的合成 click 通过第一道防线，也只算第一次点击，不会触发编辑
  - 长按触发时也启动 500ms 禁用窗口（`suppressNextClick`），兼容长按场景
  - 使用模块级变量而非 React state，避免状态更新时序与 click 派发时序错位

**周视图**（网格形态）：
- 7 天×节次网格（行=节次，列=周一到周日）
- 每格显示该节次该天的格点模式课程
- 自由模式课程（无 period_index）显示在底部"自由时段"区
- 点击表头/格点钻取到日视图
- 不支持拖拽改时间（拖拽编辑集中在日视图）

**月视图**：
- 6×7 日历方格（行=周，列=周一到周日）
- 每格**直接列出**当天课程名+时间（小字体），如"8:00 数学 / 9:00 语文"，信息直接可见不折叠
- 有临时调课的日期格角标显示小圆点提示
- 点击格点跳转到周视图（该日所在周）
- 高度不足时课程项自动截断，显示"+N 节"提示

**年视图**：
- 12 月方格（3×4 布局）
- 每月格显示月份名 + 课程密度色深（按该月课程总数映射色深，课多色深，类似热力图）
- 当前学期对应的月份格有边框高亮
- 点击月格钻取到月视图，月视图点击周钻取到周视图，周视图点击日钻取到日视图

**课程块显示**：信息丰富型
- 科目名 + 时间 + 关联指令图标 + 颜色标识
- 高度不足时自动切换 compact 样式（隐藏部分次要信息避免裁剪）
- 点击展开详情

**交互菜单**：双通道
- 鼠标右键即时菜单（桌面场景）
- 触屏长按 500ms 菜单（触屏场景，无右键）
- 共用同一回调，菜单定位基于触发坐标

**临时调课**（3 种类型，单次生效，不破坏原课表模板）：

| 类型 | 语义 | 行为 |
|---|---|---|
| **cancel** | 取消课程 | 标记该日该课程取消，不执行 |
| **move** | 调整时间 | 原位取消 + 在新时间点生成临时 Course |
| **add** | 临时加课 | 直接在指定时间点生成临时 Course（不关联原课程模板） |

调课记录存入 `schedule_overrides` 表，`resolveDayCourses` 纯函数合并模板与调课记录生成最终当日课程列表。

**学期制多周课表**：
- 默认每周课表相同（普通周模板，`template_id=NULL`）
- 支持标记某周为特殊周（关联 `weekly_templates`，如考试周/活动周）
- 周首日为周一（国内课表惯例）
- 学期切换在时间轴页内部（不放侧边栏）

#### 页面 3：快捷指令

**内部结构**：4 Tab 切换
1. **指令列表 Tab**：卡片网格展示（图标/名称/触发器数/状态开关），点击卡片进入可视化编辑器
2. **执行日志 Tab**：全部/成功/失败 三级筛选，显示最近执行记录与错误详情
3. **自动化设置 Tab**：全局默认值（默认音量/重试策略/并发数限制/串行或并发模式/日志保留条数等），单条指令可在编辑器中覆盖
4. **Lua 脚本市场 Tab**：直连 GitHub 仓库浏览/安装/更新/卸载脚本

**可视化编辑器**（点击指令卡片进入）：
- 三栏布局：左节点库 / 中画布 / 右属性面板
- 卡片式节点：图标 + 标题 + 参数摘要 + 输入/输出端口
- 贝塞尔曲线连线（React Flow 默认）
- 节点属性编辑交互：单击选中节点 → 右侧属性面板自动展示该节点表单（实时编辑）；双击作为"选中 + 滚动聚焦到属性面板"的强化操作（不弹独立模态框，避免画布被遮挡）。此设计参考 n8n / React Flow 官网 demo 主流习惯，避免双击与拖拽/框选冲突
- 节点类型：6 类共 20 种动作节点（应用与文件 4 + 媒体与输入 3 + 系统与电源 7 + 通知 2 + 控制流 3 + Lua 脚本 1），与后端 `ActionType` 枚举一一对应

#### 页面 4：性能优化

**硬件监控**（参考 NexBox LibreHardwareMonitorLib 方案）：
- CPU 使用率（总体 + 各核心）
- 内存使用情况（已用/可用/总量）
- 温度监控（CPU/GPU/主板/硬盘）

**进程列表**：Top 20 进程（按 CPU/内存排序）

**进程优化操作**：
- 调整优先级（高/高于正常/正常/低于正常/低）
- 结束进程（确认弹窗防误杀）

**一键优化**：单一固定优化按钮（结束黑名单进程 + 清理内存 + 调整优先级）

#### 页面 5：设置

**5 个分区**：
1. **外观**：深浅模式（跟随系统）+ 8 色主题色 + Mica 背景开关（默认关闭，纯色背景）
2. **通用**：侧边栏折叠状态 + 开机自启 + 关闭主窗口行为（弹窗询问/最小化到托盘/退出，记住选择）+ 更新检查频率（启动后后台/每次启动/每日/仅手动）
3. **更新**：默认自动更新 + 三级更新级别推送（`[强制更新]`/`[推荐更新]`/`[最低版本 x.y.z]`，开发者通过 GitHub Release body 标记控制，详见 7.2/13.6 节）+ 渠道（仅 Stable，Beta 渠道为待定项）
4. **关于**：基本信息（Logo+名称+版本号+构建日期）+ 技术栈（Tauri/Rust/React/SQLite/LuaJIT 等）+ MIT 许可（含娱乐性 24 小时删除声明）+ GitHub 仓库链接 + 更新历史（云端优先 GitHub Release Notes，失败回退本地 CHANGELOG.md）
5. **帮助**：内置帮助页（V0.4.0 占位嘲讽/自嘲文案，后续补充功能说明/FAQ/错误代码/概念词典）

---

## 四、系统集成

### 4.1 系统集成能力

| 能力 | 实现 |
|---|---|
| 开机自启 | tauri-plugin-autostart |
| 系统托盘 | tauri-plugin-tray，右键菜单最简 2 项（显示主窗口 / 退出） |
| Toast 通知 | tauri-plugin-notification（Windows 原生 Toast） |
| 应用内通知中心 | 右下角动画 + 历史记录 + 可点击跳转 |
| 全局热键 | 不需要（学校机器无实体键盘，纯鼠标/触摸操作） |

### 4.2 关闭主窗口行为

- 弹窗询问（最小化到托盘 / 退出应用）
- 用户选择后记住，不再询问
- 可在设置中重置

### 4.3 运行时行为

| 项 | 策略 |
|---|---|
| 多指令并发 | 用户配置（并发/串行可选） |
| 执行日志保留 | 默认 100 条 + 手动配置 |
| Lua 脚本超时 | 默认 10 秒 + 单节点可配置 |
| 动作容错 | 每动作可配（继续/停止/回滚/通知） |

---

## 五、数据与存储

### 5.1 数据存储

- **数据库**：SQLite
- **位置**：程序安装目录下 `<安装目录>/data/exero.db`
- **便携式**：数据与程序同目录，便于 U 盘拷贝
- **迁移工具**：refinery crate（版本化迁移脚本）

### 5.2 核心数据表

#### 流程数据（5 张，Phase 1）

1. **automation_flows**：快捷指令（id, name, icon, enabled, created_at, updated_at）
2. **actions**：动作块（id, flow_id, type, params, order, parent_id, fault_strategy）
3. **triggers**：触发器（id, flow_id, type, params, enabled）
4. **execution_logs**：执行日志（id, flow_id, action_id, status, started_at, finished_at, error）
5. **settings**：设置（key, value, type）

#### 课程与学期数据（5 张，Phase 3 新增）

见 [2.2 节 · 课程与学期数据](#课程与学期数据5-表phase-3-新增)。5 张表（semesters / class_periods / weekly_templates / courses / schedule_overrides）与流程数据解耦，独立成域。

> 详细 schema 由开发时按行业标准设计，无需确认。

### 5.3 数据备份

- **策略**：启动时自动备份
- **保留**：最近 3 份
- **位置**：`<安装目录>/data/backup/exero_YYYYMMDD.db`

### 5.4 日志系统

- **分层**：执行日志（SQLite execution_logs 表） + 系统日志（tracing 文件）
- **文件位置**：`<安装目录>/logs/`
- **切割**：按日期切割（每日一个文件）
- **保留**：7 天（超出自动清理）
- **调试模式**：作为 Release 可选特性，默认 Debug 构建开启
  - 显示详细日志面板
  - 动作单步执行
  - 变量实时查看
  - 性能分析

### 5.5 导入导出

- **格式**：`.exero` 文件（实际为 zip 包，含 JSON 数据 + Lua 脚本）
- **范围**：用户选择（快捷指令 / 课表 / 设置等）
- **用途**：U 盘导入导出（家里 ↔ 学校配置同步）

---

## 六、Lua 脚本系统

### 6.1 引擎

- **引擎**：LuaJIT（mlua crate）
- **性能**：LuaJIT 是脚本界最快引擎，对自动化脚本逻辑几乎无损耗

### 6.2 安全模型

- **默认严格沙箱**：禁用 os.execute / io.popen / loadfile 等危险 API
- **可选宽松沙箱**：用户在设置中开启，允许危险 API（自负风险）
- **超时**：默认 10 秒，单节点可配置

### 6.3 扩展市场（V0.4.0-Beta5 重设计）

> **V0.4.0-Beta5 重大变更**：原 `pack_type: action | lua_scripts` 两种类型合并重构为 `action`（统一动作）+ `plugin`（插件）。旧版 lua_scripts 包不兼容，需重新安装。

#### 6.3.1 Pack 类型体系

| pack_type | 说明 | 后端语言 | UI 页面 | 侧边栏入口 | Flow 积木 |
|---|---|---|---|---|---|
| `action` | 动作包 | Rust (.dll) 或 Lua (.lua) | 无 | 无 | 有 |
| `plugin` | 插件 | 必须 Rust (.dll) | 有 (iframe) | 有（独占） | 可选（附带动作） |

- **动作包**：提供 Flow 编辑器积木的扩展包。Lua 动作适合非开发者，Rust 动作适合需要系统 API 访问的场景
- **插件**：在 Exero UI 框架内嵌入完整功能页面（如音乐播放器、记事本）。插件可附带动作积木实现与快捷指令联动。侧边栏入口为插件独占能力，动作包不再支持

#### 6.3.2 Manifest 格式

**动作包**（`pack_type: "action"`）：

```json
{
  "id": "my-actions",
  "version": "1.0.0",
  "name": "My Actions",
  "description": "...",
  "author": "...",
  "exero_api_version": "0.4.0",
  "pack_type": "action",
  "actions": [
    {
      "id": "launch_program",
      "executor_type": "Rust",
      "executor_id": "launch_program",
      "label": "启动程序",
      "category": "app",
      "icon": "Rocket",
      "default_params": { "path": "", "args": "" },
      "ports": { "inputs": ["trigger"], "outputs": ["done"] },
      "summarize_template": "{path}"
    },
    {
      "id": "hello_world",
      "executor_type": "Lua",
      "executor_id": "scripts/hello.lua",
      "label": "Hello World",
      "category": "lua",
      "icon": "Code",
      "default_params": { "name": "World" },
      "ports": { "inputs": ["trigger"], "outputs": ["done"] },
      "summarize_template": "Hello {name}"
    }
  ]
}
```

- `executor_type`：`Rust`（.dll 导出函数）或 `Lua`（.lua 文件路径）
- `executor_id`：Rust 动作为 .dll 中导出的函数名；Lua 动作为包内 .lua 文件相对路径
- 原 `scripts[]` 字段已废弃，Lua 脚本统一通过 `actions[]` + `executor_type: "Lua"` 声明

**插件**（`pack_type: "plugin"`）：

```json
{
  "id": "hello-plugin",
  "version": "1.0.0",
  "name": "Hello Plugin",
  "description": "...",
  "author": "...",
  "exero_api_version": "0.4.0",
  "pack_type": "plugin",
  "rust_library": "hello_plugin.dll",
  "sidebar": {
    "label": "Hello",
    "icon": "Hand",
    "page_type": "Web"
  },
  "ui": {
    "entry": "index.html"
  },
  "actions": [
    {
      "id": "say_hello",
      "executor_type": "Rust",
      "executor_id": "say_hello",
      "label": "Say Hello",
      "category": "notification",
      "icon": "MessageSquare",
      "default_params": {},
      "ports": { "inputs": ["trigger"], "outputs": ["done"] },
      "summarize_template": "Say hello"
    }
  ]
}
```

- `rust_library`：插件 .dll 文件相对路径（必须）
- `sidebar`：侧边栏入口声明（插件必须）
- `ui.entry`：前端 HTML 入口文件相对路径（必须）
- `actions[]`：可选，插件附带动作积木供 Flow 编辑器使用

#### 6.3.3 市场目录结构

```
Market/
├── market-index.json          # 元数据索引（list_market_packs 只下载此文件）
├── action-packs/              # 动作包 .exero-pack
│   ├── base-pack.exero-pack
│   └── demo-pack.exero-pack
└── plugins/                   # 插件 .exero-pack（Phase 3 新增）
    └── hello-plugin.exero-pack
```

#### 6.3.4 market-index.json 格式

市场列表拉取从"逐个下载 zip 读 manifest"优化为"只下载索引文件"，大幅减少网络请求：

```json
{
  "actions": [
    {
      "id": "base-pack",
      "version": "1.0.0",
      "name": "Base Pack",
      "description": "20 种内置动作",
      "author": "Exero",
      "pack_type": "action",
      "file_name": "base-pack.exero-pack",
      "size": 45056,
      "action_count": 20,
      "download_url": "https://github.com/ansoukin/Exero/raw/main/Market/action-packs/base-pack.exero-pack"
    }
  ],
  "plugins": [
    {
      "id": "hello-plugin",
      "version": "1.0.0",
      "name": "Hello Plugin",
      "description": "示例插件",
      "author": "Exero",
      "pack_type": "plugin",
      "file_name": "hello-plugin.exero-pack",
      "size": 8192,
      "action_count": 1,
      "has_sidebar": true,
      "download_url": "https://github.com/ansoukin/Exero/raw/main/Market/plugins/hello-plugin.exero-pack"
    }
  ]
}
```

- `build-packs.ps1` 构建脚本自动生成此文件
- `list_market_packs` 命令只需 1 次网络请求下载索引，不再逐个下载 zip
- 离线模式：索引下载失败时仅返回已安装包

#### 6.3.5 .exero-pack 格式

- zip 包，内含 `manifest.json` + 资源文件
- 动作包：manifest.json + (.dll | .lua 文件)
- 插件：manifest.json + .dll + 前端资源（HTML/JS/CSS）

#### 6.3.6 三目录扫描策略（不变）

1. **只读 builtin**：`<exe_dir>/data/action-packs/`
2. **可写 user**：`%APPDATA%/Exero/action-packs/`
3. **自定义 custom**：settings `extension_pack.user_dir`（可选）

同名扩展包先加载的优先（builtin > user > custom）。

#### 6.3.7 网络后备（不变）

github.com 主 -> ghproxy 镜像后备 -> 离线模式（仅已安装）

### 6.4 Lua 节点

- V0.4.0 仅支持市场脚本选择，不内置代码编辑器
- Lua 节点显示脚本名称 + 参数表单
- 双击节点选择市场脚本并配置参数

### 6.5 插件系统（V0.4.0-Beta5 新增）

> **V0.4.0-Beta5 新增**：插件（Plugin）是 Exero 从"自动化工具"进化为"可扩展平台"的核心能力。插件允许第三方在 Exero UI 框架内嵌入完整功能页面。

#### 6.5.1 插件能力

| 能力 | 说明 |
|---|---|
| 侧边栏入口 | 插件独占。点击进入插件页面 |
| 嵌入 UI | 通过 iframe 加载插件前端资源（HTML/JS/CSS） |
| Rust 后端 | .dll 提供后端逻辑，可访问系统 API（音频、文件等） |
| 动作联动 | 插件可附带动作积木，在 Flow 编辑器中使用（如"播放音乐"积木） |

#### 6.5.2 Rust .dll 加载机制

**技术选型**：动态库 .dll + C ABI 接口

- 使用 `libloading` crate 运行时加载 .dll
- 通过 C ABI（`extern "C"`）保证 ABI 稳定性（Rust 自身 ABI 不稳定）
- 提供 `exero-plugin-sdk` crate，用户 `cargo add exero-plugin-sdk` 编译插件

**C ABI 接口**（SDK 宏自动生成，用户不直接编写）：

```c
// 加载时调用，返回 0 表示成功
int32_t exero_pack_init(void);

// 卸载时调用
void exero_pack_cleanup(void);

// 执行动作（action_id 对应 manifest 中 actions[].id）
// params_json 为 JSON 字符串参数
// 返回 JSON 字符串结果，NULL 表示出错（用 exero_last_error 获取错误信息）
const char* exero_execute_action(const char* action_id, const char* params_json);

// 获取最近一次错误信息
const char* exero_last_error(void);
```

**安全模型**：
- .dll 加载无沙箱隔离，可完全访问系统（与 Lua 宽松沙箱同级风险）
- 用户自担风险安装第三方插件
- .dll 必须编译为 `x86_64-pc-windows-msvc` 目标

#### 6.5.3 插件 UI 架构

**技术选型**：iframe + Tauri 自定义协议 + 桥接 API

```
┌─ Exero 主窗口 (React) ────────────────────────────┐
│  ┌─ Sidebar ──┐  ┌─ 主内容区 ──────────────────────┐│
│  │ 内置导航    │  │  ┌─ PluginPage ───────────────┐ ││
│  │ ─────────  │  │  │ ┌─ iframe ───────────────┐ │ ││
│  │ 📌 插件入口 │←─┘  │ │ http://plugin.localhost │ │ ││
│  │            │     │ │ /{pack_id}/index.html   │ │ ││
│  │            │     │ │ ┌─────────────────────┐ │ │ ││
│  │            │     │ │ │ 插件 HTML/JS/CSS    │ │ │ ││
│  │            │     │ │ │ window.exero.invoke │ │ │ ││
│  │            │     │ │ └─────────────────────┘ │ │ ││
│  └────────────┘     │ └─────────────────────────┘ ││
│                     │   ↑ postMessage ↓            ││
│                     └───┴──────────────────────────┘│
│         桥接层 -> execute_plugin_action 命令 -> .dll │
└──────────────────────────────────────────────────────┘
```

**实现细节**：

1. **Tauri 自定义协议**：通过 `register_uri_scheme_protocol("plugin", ...)` 注册 `plugin` URI scheme
   - 访问格式（Windows）：`http://plugin.localhost/{pack_id}/{file_path}`
   - 协议处理器通过 `AppState.extension_pack_registry.get_pack(pack_id)` 验证插件已安装
   - HTML 文件自动注入桥接脚本（`inject_bridge_script`），在 `</head>` 前插入
2. **iframe 加载**：PluginPage 组件用 `<iframe src="http://plugin.localhost/{pack_id}/{entry}">` 加载
   - `sandbox="allow-scripts allow-forms allow-popups allow-modals"` 限制权限
3. **桥接 API**：向插件 HTML 注入 JS，提供 `window.exero.invoke(actionId, params) -> Promise` 接口
   - iframe 通过 `postMessage` 向主窗口发送请求：`{type:'exero-invoke', id, actionId, params}`
   - PluginPage 监听 `message` 事件，调用 Tauri 命令 `execute_plugin_action(pack_id, action_id, params)`
   - Tauri 命令直接调用 `RustLibraryRegistry::execute`（C ABI 调用 .dll，不走 ActionExecutorRegistry）
   - 结果通过 `postMessage` 返回 iframe：`{type:'exero-result', id, result|error}`
   - 随机 `id` 关联请求与响应，支持并发调用
4. **前端路由分发**：`ExtensionPackDetailPage` 加载 manifest 后，`pack_type === "plugin"` 时渲染 `PluginPage`
5. **隔离性**：iframe 天然隔离，插件崩溃不影响 Exero 主界面

#### 6.5.4 插件生命周期

| 阶段 | 操作 |
|---|---|
| 安装 | 解压 .exero-pack -> 提取 .dll + 前端资源 -> reload registry |
| 加载 | `LoadLibrary` 加载 .dll -> 调用 `exero_pack_init()` -> 注册 actions |
| 运行 | iframe 加载前端 -> 用户交互 -> 桥接 API 调用 .dll |
| 卸载 | `FreeLibrary` 卸载 .dll -> 删除目录 -> reload registry |

> **Windows .dll 卸载注意**：正在使用的 .dll 不能直接删除。卸载时先 `FreeLibrary` 再删文件，若失败则标记"重启后完成卸载"。

#### 6.5.5 exero-plugin-sdk

独立的 Rust crate，提供扩展包开发所需的一切：

- `declare_actions!` 宏：声明动作列表，自动生成 C ABI 导出函数
- `Params` 类型：类型安全的参数访问
- 参数解析 / 结果序列化辅助
- 发布到 crates.io，用户 `cargo add exero-plugin-sdk`

**SDK 使用示例**：

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

fn add(params: Params) -> Result<serde_json::Value, String> {
    let a: i64 = params.get("a")?;
    let b: i64 = params.get("b")?;
    Ok(json!({ "sum": a + b }))
}

declare_actions! {
    "say_hello" => say_hello,
    "add" => add,
}
```

**用户项目 Cargo.toml**：

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
exero-plugin-sdk = "0.1"
serde_json = "1"
```

编译命令：`cargo build --release --target x86_64-pc-windows-msvc`

#### 6.5.6 示例插件：Hello Plugin

最简插件，演示完整生命周期。源码位于 `examples/hello-plugin/`。

**文件结构**：

```
examples/hello-plugin/
├── Cargo.toml          # Rust crate 配置（crate-type = cdylib）
├── src/
│   └── lib.rs          # declare_actions! 注册 say_hello 动作
├── manifest.json       # 插件 manifest（pack_type=plugin）
└── index.html          # 插件前端页面
```

**功能演示**：

- **侧边栏入口**：Puzzle 图标 + "Hello" 标签
- **前端页面**：一个 "Call Rust" 按钮，点击调用 `window.exero.invoke('say_hello', {})`
- **Rust 动作**：`say_hello` 返回 `{ "message": "Hello from Rust!" }`
- **联动**：`say_hello` 同时注册为 Flow 积木（通过 manifest actions[] 声明）

**manifest.json 关键字段**：

```json
{
  "id": "hello-plugin",
  "pack_type": "plugin",
  "rust_library": "hello_plugin.dll",
  "sidebar": { "label": "Hello", "icon": "Puzzle", "page_type": "web" },
  "ui": { "entry": "index.html" },
  "actions": [
    { "id": "say_hello", "executor_type": "rust", "executor_id": "say_hello", ... }
  ]
}
```

**Rust 源码**（src/lib.rs）：

```rust
use exero_plugin_sdk::{declare_actions, Params};
use serde_json::json;

fn say_hello(_params: Params) -> Result<serde_json::Value, String> {
    Ok(json!({ "message": "Hello from Rust!" }))
}

declare_actions! {
    "say_hello" => say_hello,
}
```

**编译与打包**：

```powershell
# 1. 编译 .dll（CARGO_TARGET_DIR 需设置为 C:\cargo-target-dominate）
cd examples\hello-plugin
cargo build --release

# 2. 打包为 .exero-pack（项目根目录执行）
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1
```

`build-packs.ps1` 自动检测 `CARGO_TARGET_DIR\release\hello_plugin.dll`，与 manifest.json + index.html 一起打包为 `Market/plugins/hello-plugin.exero-pack`。

---

## 七、更新机制

### 7.1 更新策略

- **默认**：自动更新
- **用户可选**：自动 / 手动 / 强制
- **渠道**：仅 Stable（GitHub Release latest）
- **Beta 渠道**：不提供（避免生产环境风险）

### 7.2 更新级别

应用支持三级更新级别，通过 GitHub Release body 中的标记区分（标记互斥，一个 Release 只能有一个）：

**A. 强制更新 `[强制更新]`**：
- **行为**：全屏阻断弹窗，屏蔽应用所有功能，用户仅可选"立即更新"或"退出软件"。选择"立即更新"后自动下载 .exe 安装包并以 NSIS `/S` 静默模式安装（无需用户操作），安装启动后应用自动退出。
- **保险措施**：检测到强制更新时，自动将 `update.check_frequency` 改为 `startup`（原值存入 `update.previous_check_frequency`），确保即使本次跳过下次启动仍会检查。新版本启动后检测到 `update.previous_check_frequency` 时复原原设置并删除该键。
- **用途**：重大 Bug 修复时推送
- **触发**：Release body 含 `[强制更新]` 标记，且 tag_name 版本高于当前版本

**B. 推荐更新 `[推荐更新]`**：
- **行为**：启动时弹窗提示，显示版本信息 + Release Notes（可滚动，max-height 限制防溢出）。三选项：
  - **立即更新**：下载 .exe + NSIS `/S` 静默安装 + 应用退出
  - **忽略更新**：本次跳过（不持久化），下次启动仍弹窗
  - **取消**：持久忽略此版本（记录到 `update.ignored_version`），该版本不再弹窗，直到新版本发布
- **用途**：重要但不紧急的修复或功能改进
- **触发**：Release body 含 `[推荐更新]` 标记，且 tag_name 版本高于当前版本，且用户未"取消"该版本

**C. 最低版本 `[最低版本 x.y.z]`**：
- **行为**：应用版本 < x.y.z 时强制更新（同 A 行为），>= x.y.z 时按普通更新处理
- **用途**：大版本迁移（如 0.3.x -> 0.4.0 数据库不兼容）
- **触发**：Release body 含 `[最低版本 0.4.0]` 标记，且当前应用版本 < 0.4.0

**D. 普通更新（无标记）**：
- **行为**：默认行为，后台检查，用户在设置页手动决定是否更新
- **用途**：常规版本发布

**标记使用规范**：
- 使用方括号标记（如 `[强制更新]`）而非裸文本，避免 Release Notes 正常提及功能时误触发
- 标记建议放在 body 开头或独立行，便于识别
- 一个 Release 只能有一个标记（互斥），不可组合使用

### 7.3 更新检查频率

- **默认**：启动后后台检查（不阻塞启动）
- **可配置**：每次启动 / 每日定时 / 仅手动
- **位置**：设置页 → 更新分区

### 7.4 网络后备

- **主**：github.com（官方）
- **备**：ghproxy / fastgit 等镜像（自动 fallback）
- **离线**：GitHub 完全不可达时跳过更新检查，Lua 市场进入离线模式

### 7.5 打包与分发

- **打包**：NSIS 安装包（Tauri v2 原生支持）
- **安装目录**：`C:/Program Files/Exero/`
- **分发**：GitHub Release
- **数据目录**：`C:/Program Files/Exero/data/`（便携式）

### 7.6 自动更新实现（Beta4 新增）

**下载流程**：
1. 从 GitHub Release `assets` 中匹配 `*x64*setup.exe` 资产，获取 `browser_download_url`
2. 网络后备：github.com 直链 -> ghproxy 代理 -> 失败报错
3. 下载至系统临时目录（`std::env::temp_dir()`），通过 Tauri 事件 `update:download-progress` 通知前端进度

**安装流程**：
1. 下载完成后，`std::process::Command::new(installer_path).arg("/S").spawn()` 启动 NSIS 静默安装
2. 应用调用 `app.exit(0)` 退出，安装程序独立运行替换文件
3. NSIS `/S` 标志：无人看守模式，不显示安装界面，不要求用户操作

**临时文件清理**：
- 新版本启动时扫描临时目录中的 `Exero_*_x64-setup.exe` 文件并删除
- 防止临时目录残留旧安装包

**强制更新设置保险**：
- 检测到强制更新：保存 `update.check_frequency` 原值到 `update.previous_check_frequency`，改 `update.check_frequency` 为 `startup`
- 新版本启动：检测 `update.previous_check_frequency`，复原原值并删除该键

**GitHub Release Assets 解析**：
- `GithubRelease` struct 增加 `assets` 字段（`Vec<GithubAsset>`）
- `GithubAsset`：`name`（文件名）、`browser_download_url`（下载链接）、`size`（文件大小 bytes）
- `UpdateStatus` 增加 `download_url`（匹配的 .exe 资产 URL）和 `release_notes`（body 原文）

---

## 八、错误处理与崩溃恢复

### 8.1 崩溃恢复

- **策略**：弹窗提示 + 用户选择重启
- **崩溃报告**：生成本地 `crash-YYYYMMDD-HHMMSS.dmp` 文件
- **自动发送**：V0.4.0 不做（未来买服务器后实现）

### 8.2 错误提示

- 所有错误场景提供完善的中文提示
- 包含错误原因 + 建议解决方案
- 帮助页（V0.4.0 占位嘲讽/自嘲文案，后续补充错误代码说明）

---

## 九、开发工程

### 9.1 项目目录

```
Exero/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/             # 数据库层
│   │   ├── actions/        # 动作执行器
│   │   ├── triggers/       # 触发器
│   │   ├── lua/            # Lua 引擎
│   │   ├── hardware/       # 硬件监控
│   │   ├── extension_pack/ # 扩展包（含 rust_loader.rs / native_dll.rs）
│   │   └── ...
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── rust-toolchain.toml
├── exero-plugin-sdk/       # 扩展包开发 SDK（独立 crate，V0.4.0-Beta5 Phase 2 新增）
├── src/                    # React 前端
│   ├── pages/              # 5 大页面
│   ├── components/         # 复用组件
│   ├── stores/             # Zustand stores
│   ├── hooks/              # 自定义 hooks
│   ├── lib/                # 工具库
│   └── ...
├── Market/                 # 扩展市场分发目录
│   ├── market-index.json   # 元数据索引（V0.4.0-Beta5 新增）
│   ├── action-packs/       # 动作包 .exero-pack
│   └── plugins/            # 插件 .exero-pack（V0.4.0-Beta5 新增）
├── scripts/                # 打包脚本与 Lua 脚本源文件
├── docs/                   # 文档
│   └── dev-guide/          # 开发者文档（V0.4.0-Beta5 新增）
├── resources/              # 资源文件
├── CHANGELOG.md            # 更新历史
├── LICENSE                 # MIT + 娱乐性声明
├── README.md               # 项目说明
└── package.json
```

### 9.2 开发环境

- **IDE**：TRAE IDE（AI 协作开发，用户无需安装 IDE）
- **用户需安装**：
  - Rust 工具链（rustup + cargo，约 1GB）
  - Node.js LTS（约 200MB）
  - pnpm（npm install -g pnpm）

### 9.3 代码规范

- **Git 提交**：Conventional Commits 规范（feat: / fix: / docs: / refactor: 等）
- **提交信息**：由 AI 生成中文 commit message
- **代码注释**：
  - 关键逻辑写中文注释
  - 公开 API（pub fn / pub struct）写中文文档注释
  - 简单代码不写注释
- **文件编码**：UTF-8（Tauri 项目默认）

### 9.4 版本管理

- **Git + GitHub**
- **单仓库**：exero（源码 + Release + 脚本市场）
- **分支策略**：main（稳定） + dev（开发）

### 9.5 LICENSE

- **协议**：MIT
- **附加声明**：娱乐性"仅供学习研究，请在 24 小时内删除"声明（无法律效力，纯属娱乐）

### 9.6 AI 协作开发规则（重点）

> **本节为 AI 协作开发的强制约束，所有对话（P1-P6 及后续迭代）必须严格遵守。**

本项目的 AI 协作开发受三层规则约束，优先级从高到低：

#### 9.6.1 TraeWork 规则（rules）

TraeWork 平台级规则，所有对话自动继承：

**A. 交互风格**：
- 回复活泼有趣，可带表情或俏皮话
- 但正事不能耽误，该严谨时严谨

**B. 临时记忆机制（tmemory.md）**：
- **位置**：项目根目录 `tmemory.md`
- **用途**：单步骤临时记忆储存，记录该步骤下的全部细节
- **流程**：
  1. 每一个新步骤开始时，**询问用户是否清空** tmemory.md
  2. 执行中作为临时记忆储存文件
  3. 每完成一个 Phase，在 tmemory.md 末尾追加记录
  4. 压缩等异常恢复后，**先读取 tmemory.md 确认进度** 再继续
- **与 project_memory.md 的区别**：
  - `tmemory.md`：短期、步骤级、可清空
  - `project_memory.md`：长期、项目级、不可清空（TRAE 自动管理）

**C. 基础规则遵循**：
- 遵循 `CLAUDE.local.md` 基本规则文件（详见 9.6.2）

#### 9.6.2 CLAUDE.local.md（AI 行为约束）

**文件位置**：项目根目录 `CLAUDE.local.md`

**作用**：预防 AI 胡思乱想、过度设计、擅自改动的核心约束文件。

**仓库管理**：
- `.local` 后缀表示本地文件，**不上传到 GitHub 仓库**（已加入 `.gitignore`）
- 每位协作者在本地维护自己的 `CLAUDE.local.md`，AI 不可擅自修改（除非用户明确要求）
- SPEC 中记录的是该文件的核心准则摘要，权威内容以本地文件为准

**四大准则**（对应 CLAUDE.local.md 原文，"不懂就问用户"已提升至 SPEC 开头最高准则）：

**准则 1：编码前思考（Think Before Coding）**
- 不假设，不隐藏困惑，主动暴露权衡
- 实现前明确陈述假设，不确定就问
- 存在多种解释时全部呈现，不静默选择
- 存在更简单方案时说明并推回
- 不清楚就停下来，指出困惑点并询问
- （注："不懂就问用户"已提升为 SPEC 开头最高准则，此处保留原文内容）

**准则 2：简洁优先（Simplicity First）**
- 最小代码解决问题，不做投机性设计
- 不加未要求的功能
- 不为单次使用代码做抽象
- 不加未要求的"灵活性"或"可配置性"
- 不为不可能的场景做错误处理
- 200 行能压到 50 行就重写
- 自问："资深工程师会说这过度复杂吗？" 若是，简化

**准则 3：外科手术式修改（Surgical Changes）**
- 只动必须动的，只清理自己的烂摊子
- 不"改进"相邻代码、注释或格式
- 不重构没坏的东西
- 匹配现有风格，即使你会用别的写法
- 发现无关死代码，**提及而非删除**
- 自己的改动产生的孤儿（未使用导入/变量/函数）要清理
- 预存在的死代码不删，除非被要求
- **检验标准**：每一行改动都能直接追溯到用户请求

**准则 4：目标驱动执行（Goal-Driven Execution）**
- 定义成功标准，循环验证直到通过
- 任务转化为可验证目标：
  - "加校验" -> "为非法输入写测试，然后让测试通过"
  - "修 bug" -> "写复现测试，然后让它通过"
  - "重构 X" -> "确保前后测试都通过"
- 多步任务先陈述简短计划：
  ```
  1. [步骤] -> 验证：[检查]
  2. [步骤] -> 验证：[检查]
  ```
- 强成功标准让 AI 独立循环；弱标准（"让它能用"）需要不断澄清

**生效标志**：diff 中不必要改动减少、因过度复杂导致的重写减少、澄清问题在实现前而非出错后出现。

#### 9.6.3 规则优先级与冲突处理

| 优先级 | 规则来源 | 说明 |
|---|---|---|
| 1（最高） | 用户当前指令 | 用户明确要求的优先 |
| 2 | TraeWork rules | 平台级规则，自动继承 |
| 3 | CLAUDE.local.md | AI 行为约束，预防常见错误 |
| 4 | SPEC 本文档 | 项目规格，指导开发 |

**冲突处理**：
- 用户指令 > 平台规则 > CLAUDE.local.md > SPEC
- 若 SPEC 与上层规则冲突，以用户当前指令为准，并反馈冲突点
- CLAUDE.local.md 的"简洁优先"与 SPEC 的"完整交付"冲突时，以 SPEC 交付物清单为准（SPEC 是用户确认过的需求）

#### 9.6.4 规则文件维护

| 文件 | 位置 | 上传仓库 | 维护者 | 说明 |
|---|---|---|---|---|
| `CLAUDE.local.md` | 项目根目录 | ❌ 不上传（`.gitignore`） | 用户 | AI 不可擅自修改（除非用户明确要求） |
| `tmemory.md` | 项目根目录 | ❌ 不上传（`.gitignore`） | AI | 每步骤询问是否清空，AI 负责维护 |
| TraeWork rules | 平台管理 | N/A | TraeWork 平台 | 通过 `trae_rules_context` 注入，AI 不可修改 |
| `SPEC.md` | `docs/` | ✅ 上传 | AI + 用户 | 规则变更后需在修订记录追加说明 |

**`.gitignore` 需包含**：
```
CLAUDE.local.md
tmemory.md
```

---

## 十、开发历史归档

> P1-P6 全部完成，V0.4.0-Alpha1 已交付。V0.4.0-Beta3 已交付（扩展包架构 + 扩展市场 + UI 优化）。V0.4.0-Beta4 已交付（自动更新 + 静默自启 + UI 优化）。当前版本 V0.4.0-Beta5，Beta5 开发中。
> 以下为开发阶段历史摘要，详细交付记录见 `project_memory.md`。

| Phase | 状态 | 核心交付 |
|---|---|---|
| Phase 1 | ✅ 2026-07-21 | 核心调度引擎 + 20 种动作执行器 + 5 表数据库 + 触发器调度器 |
| Phase 2 | ✅ 2026-07-22 | UI 骨架（React + Tailwind + shadcn/ui）+ 5 页面空骨架 + 首页 Dashboard |
| Phase 3 | ✅ 2026-07-22 | 时间轴页面（日/周/月/年四视图 + 拖拽编辑 + 临时调课 + 学期制多周课表） |
| Phase 4 | ✅ 2026-08-02 | 可视化编辑器（React Flow + 20 种节点 + 属性面板）+ 性能优化页（硬件监控 + 进程管理） |
| Phase 5 | ✅ 2026-08-03 | Lua 集成（LuaJIT 沙箱 + 变量系统 + 脚本市场） |
| Phase 6a | ✅ 2026-08-03 | 系统集成 + 主题 + 动画 + Splash + 课表引导向导 |
| Phase 6b | ✅ 2026-08-03 | NSIS 打包 + 更新检查器 + 关于/帮助页 + 导入导出 + URL 别名 |
| Beta3 | ✅ 2026-08-06 | 扩展包架构 + 在线扩展市场 + 侧边栏拖拽排序 + 动画优化 |
| Beta4 | ✅ 2026-08-09 | 自动更新机制 + 静默自启 + Vite 修复 + UI 优化 |
| Beta5a | ✅ 代码完成 | 动作体系合并（action + lua_scripts -> 统一 action）+ 市场索引优化 |
| Beta5b | ✅ 代码完成 | Rust 动作加载（.dll + C ABI）+ exero-plugin-sdk |
| Beta5c | ✅ 代码完成 | 插件系统（iframe UI + 桥接 API + 侧边栏独占）+ Hello Plugin 示例 |
| Beta5d | ✅ 代码完成 | 开发者文档（动作包指南 + 插件指南）|

---

## 十一、预置示例

### 11.1 首次启动预置指令

- **"放学关机"**（默认禁用，避免意外关机）
  - 触发器：定时 17:30
  - 动作链：关机
  - 用途：最简示例，演示触发器 + 动作链基本流程
  - 用户手动启用后才会执行

### 11.2 课表初始化引导向导（Phase 6）

首次启动（或用户手动触发）时的课表配置向导，引导用户完成学期/节次/课程的基础配置。

#### 触发条件

| 场景 | 条件 | 行为 |
|---|---|---|
| **首次启动** | `settings` 表无 `onboarding_completed` 标记 AND `semesters` 表为空 | Splash Screen 后自动弹出向导 |
| **手动触发** | 设置页 → 通用 → "重新初始化课表" | 二次确认后清空现有课表数据（5 张表），重新启动向导 |

#### 向导步骤（欢迎页 + 4 步）

**步骤 0：欢迎页**

三个入口按钮：

| 按钮 | 行为 |
|---|---|
| "开始配置" | 进入步骤 1（学期配置） |
| "跳过（使用空课表）" | 标记 `onboarding_completed=true`，不创建任何数据，主窗口时间轴显示空状态 |
| "加载示例数据（演示模式）" | 导入 V004 预置的示例学期+节次+课程，标记 `onboarding_completed=true` + `demo_mode=true`，直接进入主窗口 |

**步骤 1：学期配置**（必填）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| 学期名称 | 文本输入 | "2026 秋季学期"（根据当前年份+季节推算） | 如"2026 秋季学期" |
| 起始日期 | 日期选择器 | 当前日期 | 学期第一天 |
| 结束日期 | 日期选择器 | 起始日期 + 140 天 | 学期最后一天 |
| 总周数 | 数字输入 | 根据起止日期自动推算（向上取整） | 如 20 周 |
| 设为当前激活学期 | 开关 | 开 | `is_active=1`，若已有其他激活学期则自动取消原激活 |

**步骤 2：节次时间表配置**（必填）

预设模板（3 选 1，选中后可编辑）：

| 模板 | 节次数 | 时间范围 | 适用场景 |
|---|---|---|---|
| "标准 8 节" | 8 | 8:00-16:45 | 无早读无晚自习的常规学校 |
| "完整模式" | 10 | 7:30-19:45 | 含早读+8 节+晚自习（与 V004 示例一致） |
| "自定义" | 0 | — | 从空白开始逐条添加 |

选中预设后显示可编辑的节次列表，每行字段：`period_index`（自动编号）/ `start_time` / `end_time` / `label`（可选，如"早读""午休"）。支持增删改、拖拽排序。

**步骤 3：课程录入**（可选，默认折叠）

默认折叠状态，点击"展开课程录入"后显示 7×N 矩阵（7 天 × 节次数）：

- 每格可点击填入科目名，自动按科目名 hash 分配 8 色 HSL 色板颜色
- 高级字段（教师 / 教室 / 周模式 all/odd/even）默认折叠，点击科目名展开编辑
- 底部"跳过此步，稍后在时间轴页面补录"按钮 → 跳到步骤 4
- 自由模式课程（无固定节次）此步不录入，后续在时间轴页面拖拽创建

**步骤 4：完成确认**

- 摘要卡片：学期名称 + 节次数 + 课程数
- "完成并进入主界面"按钮
- 事务性写入（见下方数据流）

#### 跳过机制

| 跳过点 | 效果 | 后续入口 |
|---|---|---|
| 欢迎页"跳过" | 空课表，无任何数据 | 时间轴空状态"创建学期"按钮 / 设置页"重新初始化" |
| 步骤 3"跳过课程录入" | 仅创建学期+节次，无课程 | 时间轴页面右键/长按 → CourseFormDialog 逐条补录 |

#### 空状态设计（跳过引导后）

时间轴三视图（周/月/年）均显示空状态：

- 居中插画：日历图标 + 虚线边框占位
- 文案："还没有学期数据"
- 按钮："创建学期" → 重新触发引导向导（从步骤 1 开始，跳过欢迎页）

#### UI 形态

- **模态全屏对话框**：主窗口内全屏遮罩 + 居中卡片
- **尺寸**：800×600（固定，不可缩放）
- **步骤指示器**：顶部横向进度条（1/4 → 2/4 → 3/4 → 4/4），当前步高亮
- **导航按钮**：底部"上一步"/"下一步"，步骤 1 无"上一步"（返回欢迎页），步骤 4"下一步"改为"完成"
- **风格**：Win11 Fluent Design（圆角 8px、8px 网格、200ms 过渡、触控目标 ≥ 48px）

#### 数据流

```
步骤 1 学期配置 → 缓存到内存（未落库）
步骤 2 节次配置 → 缓存到内存（未落库）
步骤 3 课程录入 → 缓存到内存（未落库）
步骤 4 确认完成 → 开启 SQLite 事务：
  INSERT semesters（1 条）
  INSERT class_periods（N 条）
  INSERT courses（M 条，可为 0）
  INSERT/UPDATE settings（onboarding_completed=true）
  全部成功 → COMMIT
  任一失败 → ROLLBACK + 保留在步骤 4 + 显示错误信息
```

#### 演示模式

- 欢迎页"加载示例数据"按钮 → 导入 V004 预置数据 + 标记 `demo_mode=true`
- 演示模式下主窗口标题栏显示"演示模式"标识
- 设置页 → 通用 → "退出演示模式"按钮 → 清空课表数据 + 清除 `demo_mode` 标记 + 重新触发引导向导

#### 与 V004 迁移的关系

- V004 迁移保留，作为演示模式的数据源
- V004 在数据库初始化时执行（创建表 + 插入示例数据）
- 首次启动检测逻辑：`onboarding_completed` 标记不存在时，若 `semesters` 表已有 V004 数据 → 视为演示数据，仍弹引导向导（欢迎页"加载示例数据"按钮直接标记完成）
- 引导向导"开始配置"路径不依赖 V004 数据，用户可完全自定义

### 11.3 URL 短域名别名配置（Phase 6）

OpenUrl 动作的 URL 自动补全增强功能。用户可在设置页配置短域名别名映射表，OpenUrl 动作执行时自动解析别名并重写为完整 URL。

#### 功能背景

Phase 5 已实现基础 URL scheme 自动补全（`baidu.com` -> `https://baidu.com`），但仍需用户输入完整域名。Phase 6 增强为支持短别名：
- 用户配置 `baidu` -> `https://www.baidu.com`
- OpenUrl 动作输入 `baidu` -> 自动重写为 `https://www.baidu.com`
- 降低小白用户输入成本

#### 配置存储

- 设置键：`url.aliases`
- 值格式：JSON 数组，每项 `{ alias: string, target: string }`
- 默认值：`[]`（空数组，仅 scheme 补全生效）
- 持久化到 `settings` 表

#### 默认别名（首次启用时预置）

| 别名 | 目标 |
|---|---|
| `baidu` | `https://www.baidu.com` |
| `google` | `https://www.google.com` |
| `github` | `https://github.com` |
| `bing` | `https://www.bing.com` |

用户可自由增删改，空别名或空目标自动忽略。

#### 解析优先级

OpenUrl 动作执行时，URL 解析顺序：
1. **别名匹配**：输入完全等于某别名 -> 直接替换为目标 URL（跳过后续步骤）
2. **scheme 补全**：输入无 `://` -> 补全 `https://`
3. **原样使用**：输入已含 scheme -> 保持不变

#### 设置页 UI

- 位置：设置页 -> 通用 -> URL 短域名别名
- 组件：可编辑列表（别名 + 目标 URL 两列）+ 添加/删除按钮 + 重置为默认
- 实时保存：修改后立即写入 settings，无需额外保存按钮

#### 与 Phase 5 的关系

- Phase 5 的 `normalize_url` 函数已预留扩展点（注释标记 Phase 6）
- Phase 6 实现：从 settings 读取 `url.aliases`，在 `normalize_url` 内先做别名查找
- 向后兼容：未配置别名时行为与 Phase 5 一致

---

## 十二、硬件适配

### 12.1 目标硬件

- **学校机器**：HiteVison 教育用 PC
  - CPU：i5-8400（6 核 6 线程）
  - 内存：4GB DDR4 低频
  - 屏幕：4096×3072 30Hz 触屏
  - 存储：HDD（推测）
  - 网络：时断时续，需后备方案

### 12.2 适配策略

| 项 | 策略 |
|---|---|
| 内存 | 软性关注（Rust <80MB + React <150MB） |
| 动画 | 200ms 兼容 30Hz |
| 触控 | 触控目标 ≥ 48px |
| UHD | DPI 感知 + 跟随系统缩放 |
| 无键盘 | 所有操作鼠标/触摸可完成 |
| 网络 | 官网优先 + 镜像后备 + 离线模式 |

### 12.3 开发基准

- **开发机**：家里性能更好的机器
- **部署机**：学校 HiteVison 机器
- **测试要求**：必须在部署机上验证流畅度

---

## 十三、发布流程

### 13.1 总览

发布流程分两个角色：**AI（准备）+ 用户（执行）**。

| 阶段 | 执行者 | 内容 |
|---|---|---|
| 1. 发布前准备 | AI | 版本号同步 / CHANGELOG / Release Notes 草稿 / 更新级别标记文案 |
| 2. 发布前验证 | 用户 | 编译验证 + 手动验证清单 |
| 3. 构建与打包 | 用户 | `pnpm tauri build` 生成 NSIS 安装包 |
| 4. GitHub Release 发布 | 用户 | 创建 Release / 上传产物 / 填写 Release Notes |
| 5. 发布后 | 用户 | 监控反馈 / 紧急回滚（如需要） |

### 13.2 发布前准备（AI 执行）

AI 负责以下准备工作，输出给用户确认后执行：

**A. 版本号同步**：
- `src-tauri/Cargo.toml`：`version = "x.y.z"`
- `src-tauri/tauri.conf.json`：`"version": "x.y.z"`
- `package.json`：`"version": "x.y.z"`
- 三处版本号必须一致

**B. CHANGELOG.md 更新**：
- 追加新版本段落，列出本次变更（新功能 / 修复 / 已知问题）
- 格式参考既有 CHANGELOG.md 结构

**C. Release Notes 草稿**：
- 生成 Markdown 格式的 Release Notes 草稿
- 包含：版本号 / 发布日期 / 变更摘要 / 新功能列表 / 修复列表 / 已知问题 / 下载链接占位
- **根据本次更新级别**，在 Release Notes 开头写入对应标记（详见 13.6 节）：
  - 强制更新：`[强制更新]`
  - 推荐更新：`[推荐更新]`
  - 最低版本：`[最低版本 x.y.z]`
  - 普通更新：无标记

**D. 更新级别标记准备**：
- 根据本次更新严重程度，与用户确认更新级别（强制/推荐/最低版本/普通）
- 在 Release Notes 草稿中包含对应标记
- 向用户说明本次更新级别的原因和影响

### 13.3 发布前验证（用户执行）

**A. 编译验证**：
```powershell
cd src-tauri
.\check.bat          # cargo check + cargo test
cd ..
pnpm tsc --noEmit    # 前端类型检查
```

**B. 手动验证清单**（至少跑 3-5 个代表性 flow）：
- [ ] `pnpm tauri dev` 启动正常，无启动报错
- [ ] 首页 Dashboard 显示正常
- [ ] 时间轴页面：周视图 / 日视图 / 月视图 / 年视图切换正常
- [ ] 时间轴拖拽：课程块拖动改时间正常
- [ ] 快捷指令：创建一个 flow -> 执行 -> 查看日志
- [ ] 可视化编辑器：节点拖入画布 -> 连线 -> 保存 -> 重新打开数据不丢
- [ ] 性能优化页：硬件监控数据正常显示
- [ ] Lua 脚本：执行一个示例脚本
- [ ] 设置页：主题切换 / 深浅模式正常
- [ ] 课表初始化向导：首次启动流程正常（或重置后验证）
- [ ] 导入导出：导出 .exero -> 导入 -> 数据完整

### 13.4 构建与打包（用户执行）

```powershell
pnpm tauri build
```

**产物位置**：`src-tauri/target/release/bundle/nsis/Exero_x.y.z_x64-setup.exe`

**确认事项**：
- [ ] NSIS 安装包生成成功
- [ ] 安装包大小合理（预期 10-30MB）
- [ ] 在干净环境（或另一台电脑）安装测试

### 13.5 GitHub Release 发布（用户执行）

**步骤**：

1. 进入 GitHub 仓库 -> Releases -> Draft a new release
2. **Tag**：`v0.4.0-Alpha1`（v 前缀 + 版本号原样，首字母大写，详见 13.10 节）
3. **Title**：`Exero V0.4.0-Alpha1`
4. **Body**：粘贴 AI 准备的 Release Notes 草稿
5. **Attach binaries**：上传 `Exero_x.y.z_x64-setup.exe`
6. **勾选**：This is a pre-release（Alpha/Beta 版本标记为预发布，Stable 不勾）
7. **Publish release**

**Release Notes 填写规范**：
- 普通 Release：正常描述变更，**不要**包含任何更新标记
- 强制更新 Release：body 开头写入 `[强制更新]` 标记（详见 13.6.1 节）
- 推荐更新 Release：body 开头写入 `[推荐更新]` 标记（详见 13.6.2 节）
- 最低版本 Release：body 开头写入 `[最低版本 x.y.z]` 标记（详见 13.6.3 节）
- 标记互斥，一个 Release 只能有一个标记

### 13.6 更新级别机制

应用支持三级更新级别，通过 GitHub Release body 中的标记区分（标记互斥）。

#### 13.6.1 强制更新 `[强制更新]`

**触发**：Release body 含 `[强制更新]` 标记，且 tag_name 版本高于当前版本

**行为**：弹窗强制用户更新，屏蔽应用其他功能

**如何推送**：
- 在 GitHub Release 的描述文本（body）中写入 `[强制更新]` 标记
- 示例 body 片段：
  ```
  [强制更新]
  
  本次版本修复了严重的数据库损坏问题，必须更新才能继续使用。
  ```

**如何取消**：编辑 Release 移除标记，或发布新版本（无标记）覆盖 latest

#### 13.6.2 推荐更新 `[推荐更新]`

**触发**：Release body 含 `[推荐更新]` 标记，且 tag_name 版本高于当前版本，且用户未忽略该版本

**行为**：
- 启动时弹窗提示新版本
- 用户可选"稍后"（本次跳过，下次启动再弹）或"忽略"（记录版本号，该版本不再弹窗，直到新版本发布）
- 不屏蔽应用功能

**如何推送**：
- 在 GitHub Release body 中写入 `[推荐更新]` 标记
- 示例 body 片段：
  ```
  [推荐更新]
  
  本次版本优化了拖拽体验，建议更新。
  ```

**如何取消**：编辑 Release 移除标记，或发布新版本覆盖 latest

**忽略记录**：应用本地存储用户忽略的版本号，下次启动时若 latest Release 版本与忽略版本相同则不弹窗，若不同则正常弹窗

#### 13.6.3 最低版本 `[最低版本 x.y.z]`

**触发**：Release body 含 `[最低版本 0.4.0]` 标记，且当前应用版本 < 0.4.0

**行为**：
- 应用版本 < x.y.z：强制更新（同 13.6.1 行为）
- 应用版本 >= x.y.z：按普通更新处理（无标记行为）

**如何推送**：
- 在 GitHub Release body 中写入 `[最低版本 0.4.0]` 标记（版本号根据实际情况填写）
- 示例 body 片段：
  ```
  [最低版本 0.4.0]
  
  本次版本涉及数据库结构重大变更，0.3.x 用户必须更新至 0.4.0 以上。
  ```

**如何取消**：编辑 Release 移除标记，或发布新版本覆盖 latest

#### 13.6.4 普通更新（无标记）

**行为**：默认行为，后台检查，用户在设置页手动决定是否更新

**用途**：常规版本发布

#### 13.6.5 标记使用规范

- 使用方括号标记（如 `[强制更新]`）而非裸文本，避免 Release Notes 正常提及功能时误触发
- 标记建议放在 body 开头或独立行，便于识别
- 一个 Release 只能有一个标记（互斥），不可组合使用
- 若 Release body 无任何标记，按普通更新处理

### 13.7 发布后

**监控**：
- 日常使用中暴露的 bug 和体验问题
- 通过 GitHub Issues 收集反馈

**紧急回滚**：
- 若新版本存在严重 bug，两个选项：
  - **选项 A**：发布修复版本（推荐，走完整发布流程）
  - **选项 B**：将 GitHub latest Release 回退到上一个稳定版本（在 Release 设置中将旧版本设为 latest，新版本标记为 pre-release 或删除）
- 数据库不回滚（用户数据优先保护）

### 13.8 AI 角色边界

| AI 能做 | AI 不做 |
|---|---|
| 版本号同步（改 3 个文件） | 执行 `pnpm tauri build` |
| 更新 CHANGELOG.md | 上传 NSIS 安装包到 GitHub |
| 生成 Release Notes 草稿 | 创建 / 发布 GitHub Release |
| 准备更新级别标记文案 | 执行 `git push` / `git tag` |
| 生成验证清单 | 在 GitHub 上编辑 / 删除 Release |
| 更新 SPEC 和 project_memory.md | 修改 GitHub 仓库设置 |

**原则**：AI 负责所有"文档和代码准备"工作，用户负责所有"执行和外部操作"工作。

### 13.9 后续迭代衔接

**V0.4.0 正式版规划**：
- 基于 Alpha1 实际使用反馈
- 走 SPEC 需求评审流程（新开 P1 对话讨论 -> 更新 SPEC -> 分 Phase 开发）

**新功能规划**：
- 待定项（SPEC 14.2 节）逐步转正
- 每个新功能需走完整评审：需求讨论 -> SPEC 更新 -> Phase 拆分 -> 开发 -> 发布

### 13.10 版本号命名规则

**格式**：`VMajor.Minor.Patch-StageN`

**组成**：
- `V` 前缀：所有版本号带 V 前缀
- `Major.Minor.Patch`：语义化版本号（SemVer 严格版）
  - Major：不兼容的 API 变更
  - Minor：向下兼容的功能新增
  - Patch：向下兼容的 bug 修复
- `StageN`：阶段标识
  - `Alpha1`、`Alpha2`...：Alpha 阶段（测试版本，从 1 开始）
  - `Beta1`、`Beta2`...：Beta 阶段（预览版本，从 1 开始）
  - `Stable`：正式版（无数字后缀）

**阶段定义**：
- **Alpha**：测试版本，不提供生产构建，普通用户不可升级。功能可能不完整，用于内部测试
- **Beta**：预览版本，有生产构建，权重低于 Stable。功能完整但可能有不稳定 bug，供早期用户测试
- **Stable**：正式版，稳定可用，所有用户可升级

**大小写规范**：
- 阶段标识首字母大写：`Alpha` / `Beta` / `Stable`
- 版本号字符串：`V0.4.0-Alpha1` / `V0.4.0-Beta1` / `V0.4.0-Stable`
- GitHub Tag：`v` + 版本号原样（首字母大写），如 `v0.4.0-Alpha1`

**升级路径**（严格线性，不可跳级）：
```
V0.4.0-Alpha1 -> V0.4.0-Alpha2 -> ... -> V0.4.0-Beta1 -> V0.4.0-Beta2 -> ... -> V0.4.0-Stable
```

**版本号比较规则**（应用端解析 GitHub Release tag_name 判断是否需要更新）：

比较分两级，依次进行：

**第一级：比较语义化版本号（Major.Minor.Patch）**
- 从左到右逐段比较数字，数字大的版本号大
- 例：`0.4.0` < `0.4.1` < `0.5.0` < `1.0.0`
- 若语义化版本号不同，直接得出结论，无需比较阶段

**第二级：语义化版本号相同时，比较阶段（StageN）**

阶段优先级（从低到高）：
```
Alpha1 < Alpha2 < ... < Beta1 < Beta2 < ... < Stable
```

- Alpha 阶段 < Beta 阶段 < Stable 阶段
- 同阶段内，数字大的大（Alpha2 > Alpha1，Beta3 > Beta2）
- Stable 无数字后缀，视为该版本的最高阶段（大于任何 BetaN）

**完整示例**：
```
0.4.0-Alpha1 < 0.4.0-Alpha2 < 0.4.0-Beta1 < 0.4.0-Beta2 < 0.4.0-Stable
0.4.0-Stable < 0.4.1-Stable < 0.4.2-Stable
0.4.2-Beta2 < 0.4.2-Beta3 < 0.4.2-Stable
0.4.2-Beta3 < 0.4.3-Alpha1（不同 Minor，直接比较 0.4.2 < 0.4.3，阶段不参与比较）
```

**实现伪代码**：
```
function compareVersion(v1, v2):
    // 1. 比较语义化版本号
    semver_cmp = compareSemver(v1.major, v1.minor, v1.patch, v2.major, v2.minor, v2.patch)
    if semver_cmp != 0:
        return semver_cmp
    
    // 2. 语义化版本号相同，比较阶段
    stage_order = {Alpha: 0, Beta: 1, Stable: 2}
    if v1.stage != v2.stage:
        return stage_order[v1.stage] - stage_order[v2.stage]
    
    // 3. 同阶段比较数字（Stable 视为 +∞）
    if v1.stage == Stable and v2.stage == Stable:
        return 0
    if v1.stage == Stable:
        return 1   // Stable > 任何同阶段数字
    if v2.stage == Stable:
        return -1
    return v1.stageNum - v2.stageNum
```

**注意**：
- 比较前需解析版本号字符串，去除 `V`/`v` 前缀
- tag_name 比较时大小写不敏感（`v0.4.0-Alpha1` 与 `V0.4.0-Alpha1` 视为相同）
- `[最低版本 x.y.z]` 标记中的版本号无需包含阶段，仅比较语义化版本号部分

**build 号**：
- 不写入版本号字符串
- 写在 GitHub Release 描述中（如 "Build: 42"）
- 用于区分同一版本号的多次构建，不参与版本比较

**示例**：
| 版本号 | 含义 | GitHub Tag |
|---|---|---|
| `V0.4.0-Alpha1` | 0.4.0 第 1 个 Alpha 版本 | `v0.4.0-Alpha1` |
| `V0.4.0-Beta1` | 0.4.0 第 1 个 Beta 版本 | `v0.4.0-Beta1` |
| `V0.4.0-Stable` | 0.4.0 正式版 | `v0.4.0-Stable` |
| `V0.4.1-Stable` | 0.4.0 的补丁版本 | `v0.4.1-Stable` |
| `V0.5.0-Alpha1` | 0.5.0 第 1 个 Alpha 版本 | `v0.5.0-Alpha1` |

**历史版本兼容**：
- 当前 `V0.4.0-Alpha1` 命名符合本规则，无需更改
- 历史 `V0.4.0-Alpha1-P5` 格式（含 Phase 标识）为开发期内部标识，不作为发布版本号，仅记录在 project_memory.md

---

## 十四、附录

### 14.1 决策记录

本文档基于 26+ 轮需求讨论汇总 + Phase 1-2 实际开发反馈 + P3 重新 Remake 设计讨论，所有决策均经用户确认。主要讨论话题包括：

**需求阶段（V1，26 轮）**：

1. 基础定位（产品形态、目标用户、UI 风格、前端框架）
2. 技术选型（Tauri 版本、系统级动作实现、数据迁移、国际化）
3. 架构核心（数据存储、调度引擎、组件库、系统集成）
4. 产品形态（快捷指令方向、触发器类型、跨平台、UAC 策略）
5. 脚本与执行（Lua 引擎、动作执行模型、可视化编辑器、变量系统）
6. UI/UX 细节（布局、通知、日志、主题）
7. 功能范围（动作类型、Legacy 页面去留、更新机制、额外能力）
8. 扩展细节（Lua 市场、时间轴、页面结构、强制更新）
9. 安全与策略（Lua 沙箱、设置页分区、Dashboard 模块、开发顺序）
10. 图标字体与策略（自动化设置位置、开发顺序、图标字体、容错策略）
11. 项目结构（目录、时间轴功能、性能优化页、帮助系统）
12. 脚本引擎与监控（Lua 引擎决策、性能监控、进程优化、查看目录）
13. 品牌与版本管理（品牌、Git、Splash、下一步）
14. 前端架构（状态管理、Rust 后端、数据库 schema、Tauri 通信）
15. 实现细节（首次启动、Lua 市场仓库、闲聊话题）
16. 硬件约束（内存、动画、Mica、开发基准）
17. 学校机器环境（权限、还原卡、网络、配置同步）
18. 物理布局（数据存储、打包、多窗口、备份）
19. 错误处理（崩溃恢复、日志文件、命令面板、调试模式）
20. 触摸屏适配（无键盘、触摸屏、UHD 30Hz）
21. 工程实践（数据库迁移、开发环境、提交规范、代码注释）
22. 页面详细设计（时间轴、可视化编辑器、性能优化页）
23. 基础信息确认（项目名、版本、Rust 版本、包管理器）
24. 硬件监控方案修正（LHM 借鉴方式）
25. 遗漏项确认（侧边栏底部、托盘菜单、关于页、帮助页、预置示例）
26. 最终细节确认（侧边栏布局、主题色、动画触控、开发阶段）

**P3 Remake 设计阶段（V2，2026-07-23）**：

27. P3 三视图推翻重做：老 SPEC"日/周/月"改为"周/月/年"三级递进。周视图=纵向时间轴+7天列（直观显示时间跨度），月视图=日历方格直接列课程详情（不折叠），年视图=12月方格+密度色深+三级钻取（Win10日历式总览）
28. P3 周视图交互决策：整块拖动改位置（同时更新 start_time + end_time）+ 底边 resize 手柄改时长（只更新 end_time），这是用户核心需求"手动拖拽调整时间长度"的直接对应
29. P3 节次辅助线决策：周视图保留节次虚线辅助线（class_periods 表已存数据），仅作参考不强制对齐，与纵向时间轴共存
30. P3 月视图信息密度决策：每格直接列出当天课程名+时间（如"8:00 数学 / 9:00 语文"），不搞悬停折叠。高度不足显示"+N 节"截断提示
31. P3 年视图定位决策：12月方格+课程密度色深（热力图风格），三级钻取导航（年→月→周），当前学期月份高亮
32. P3 数据模型决策：5表方案（semesters/class_periods/weekly_templates/courses/schedule_overrides），新增 weekly_templates 支持特殊周模板（考试周/活动周可复用），courses 加 template_id 字段（NULL=普通周）
33. P3 拖拽库决策：@dnd-kit（Pointer + Touch + Keyboard 三传感器），激活阈值 8px + TouchSensor delay 200ms 避免误触
34. P3 调课合并决策：resolveDayCourses 纯函数，cancel 标记取消 / move 原位取消+新位生成 / add 直接生成临时 Course
35. P3 交互菜单决策：鼠标右键即时菜单 + 触屏长按 500ms 双通道，共用 onLongPress 回调，回传触发坐标用于菜单定位
36. P3 课程颜色决策：按科目名 hash 分配 8 色 HSL 色板，color-mix 实现背景透明度，避免深浅模式不兼容
37. P3 周首日决策：周一（国内课表惯例），weekStartDate 工具函数统一处理周一回退
38. 程序名决策：采用 Exero 作为正式名称（用户受 Deepseek V4 建议启发，经多轮考量后弃用原名）
39. 课表初始化引导决策：Phase 6 新增引导向导（首次启动检测 + 4 步配置：学期/节次/课程/确认），V004 示例数据保留为演示模式（欢迎页"加载示例数据"按钮触发），课程录入步骤默认折叠可选展开，跳过后时间轴显示空状态"创建学期"入口
40. 强制更新机制决策：放弃 force-update.json 文件方案，改为解析 GitHub Release body 文本标记。使用方括号标记避免 Release Notes 正常提及功能时误触发。后扩展为三级更新级别（`[强制更新]`/`[推荐更新]`/`[最低版本 x.y.z]`），标记互斥
41. 发布流程决策：AI 准备 + 用户执行分工模式。AI 负责版本号同步/CHANGELOG/Release Notes 草稿/更新级别标记文案，用户负责编译验证/构建打包/GitHub Release 发布。发布渠道为 GitHub Release + ghproxy 后备（SPEC 7.4 已设计）
42. 版本号命名规则决策：自定义 SemVer 格式 `VMajor.Minor.Patch-StageN`。Alpha/Beta 数字从 1 开始，阶段标识首字母大写（Alpha/Beta/Stable），GitHub Tag 用 v 前缀 + 版本号原样。Alpha 无生产构建（普通用户不可升级），Beta 有生产构建（权重低于 Stable），Stable 为正式版。升级路径严格线性不可跳级。build 号不进版本号字符串，写在 Release 描述中。版本号比较规则：两级比较，第一级比语义化版本号，第二级比阶段（Alpha<Beta<Stable，同阶段比数字，Stable 视为最大）
43. AI 协作开发规则决策：新增 SPEC 9.6 节，将 TraeWork 平台规则、CLAUDE.local.md 四大准则（编码前思考/简洁优先/外科手术式修改/目标驱动执行）、tmemory.md 临时记忆机制、规则优先级（用户指令>TraeWork>CLAUDE.local.md>SPEC）纳入项目规格。CLAUDE.local.md 和 tmemory.md 为本地文件不上传仓库（已加入 .gitignore）。SPEC 开头增加醒目提示要求所有对话先读 9.6 节，并将"不懂就问用户"从 CLAUDE.local.md 准则 1 中提升为 SPEC 开头最高准则（凌驾所有编码准则之上）

### 14.2 待定项

- 应用 Logo 与图标设计（正式版发布前处理，V0.4.0 占位"E"字母）
- 崩溃报告自动发送（未来买服务器后实现）
- OTA 更新（未来实现）
- Beta/Dev 更新渠道（未来实现，V0.4.0 仅 Stable）
- 帮助页详细内容（V0.4.0 占位嘲讽/自嘲文案，后续补充功能说明/FAQ/错误代码/概念词典）
- 服务器端崩溃报告收集（未来买服务器后实现）

### 14.3 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| LibreHardwareMonitorLib 是 C# 库，Rust 调用复杂 | 开发时评估 COM 互操作或 C++/CLI 封装层 |
| 学校机器网络不稳定 | 多源后备（官网 + 镜像 + 离线） |
| 4GB 内存紧张 | 软性关注 + 避免大型依赖 |
| 30Hz 屏幕动画闪烁 | 200ms 动画 + 减少复杂动画 |
| 全局管理员权限安全风险 | Lua 严格沙箱 + 用户自担风险 |

---

**文档结束**
