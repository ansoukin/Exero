<VersionBadge />

# 构建与发布

本文档覆盖扩展包从「编译打包」→「本地安装验证」→「发布到市场」→「用户获取安装」的完整链路。

## 扩展包格式

Exero 扩展包文件后缀 `.exero-pack`，本质是 **ZIP 压缩包**。要求：

- `manifest.json` 必须位于 ZIP **根目录**（非子目录）
- 其他文件（Lua 脚本、HTML、CSS、图片、.dll 等）按 manifest 中声明的相对路径组织
- 推荐使用 DEFLATE 压缩级别（Windows `Compress-Archive` 默认即可）

```
my-plugin.exero-pack (zip)
├── manifest.json        ← 根目录，必填
├── my_plugin.dll        ← 插件：Rust .dll
├── index.html           ← 插件：前端入口
├── assets/style.css     ← 插件：前端资源（可选）
└── scripts/             ← 动作包：Lua 脚本（可选）
    └── hello.lua
```

---

## 动作包打包（纯 Lua 或内置 ActionType）

不需要编译。

### 手动打包（PowerShell）

```powershell
# 假设动作包目录在 .\my-action-pack\
Compress-Archive -Path my-action-pack\* -DestinationPath my-action-pack.exero-pack -Force
```

### 验证 ZIP 结构

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead("$PWD\my-action-pack.exero-pack")
$zip.Entries | Select-Object FullName, Length | Format-Table
$zip.Dispose()
```

确保 `manifest.json` 的 `FullName` 就是 `manifest.json`（没有 `my-action-pack/manifest.json` 前缀）。

---

## 插件打包（Rust .dll + UI）

### 1. 编译 .dll

```powershell
cd my-plugin
cargo build --release
```

产物：`target\release\my_plugin.dll`（若设置了 `CARGO_TARGET_DIR` 环境变量，则在对应目录的 `release\` 下）

::: tip CARGO_TARGET_DIR（可选）
将 `CARGO_TARGET_DIR` 指向项目外的固定目录（如 `C:\cargo-target`）可以让多个插件共享编译缓存，并保持插件源码目录干净。这是可选项，不设置不影响编译。
:::

::: tip 产物名规则
Cargo `name` 字段中的 `-` 自动转为 `_`：
- `name = "hello-plugin"` → `hello_plugin.dll`
- `name = "my-cool-tool"` → `my_cool_tool.dll`
:::

### 2. 组装插件目录

把 .dll 复制到插件目录根：

```powershell
# 插件目录结构准备好：
# my-plugin/
#   ├── manifest.json
#   ├── index.html
#   └── assets/...

Copy-Item target\release\my_plugin.dll .\my-plugin\
```

### 3. 打包

```powershell
Compress-Archive -Path my-plugin\* -DestinationPath my-plugin.exero-pack -Force
```

---

## 一键市场构建脚本（`build-packs.ps1`）

项目提供 `scripts/build-packs.ps1` 自动完成：
1. 创建 `Market/action-packs/` + `Market/plugins/` 目录
2. 复制已有 `.exero-pack` 到市场目录
3. 构建内置 Lua 动作包（scripts/lua-scripts-pack.json + 3 个 .lua 脚本）
4. 构建 hello-plugin（从 `$env:CARGO_TARGET_DIR` 拿 .dll）
5. 扫描所有 `.exero-pack` 读取 manifest，生成 `Market/market-index.json`（**无 BOM UTF-8**）

```powershell
# 在项目根目录执行
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1
```

输出目录结构：

```
Market/
├── market-index.json          ← 市场元数据索引（扩展市场页面只下载此文件）
├── action-packs/              ← 动作包 .exero-pack
│   ├── base-pack.exero-pack
│   └── lua-scripts-pack.exero-pack
└── plugins/                   ← 插件 .exero-pack
    └── hello-plugin.exero-pack
```

---

## 市场索引（market-index.json）

扩展市场（应用内）只下载此文件展示列表，不逐个下载 zip 探测。结构：

```json
{
  "actions": [
    {
      "id": "base-pack",
      "version": "1.0.0",
      "name": "基础动作包",
      "description": "...",
      "author": "Exero",
      "exero_api_version": "0.4.0",
      "pack_type": "action",
      "file_name": "base-pack.exero-pack",
      "size": 1657,
      "action_count": 20,
      "has_sidebar": false,
      "download_url": "https://github.com/ansoukin/Exero/raw/main/Market/action-packs/base-pack.exero-pack"
    }
  ],
  "plugins": [ /* 同结构 */ ]
}
```

::: warning 无 BOM UTF-8
`build-packs.ps1` 用 .NET `UTF8Encoding($false)` 写入，确保无 BOM。Rust `serde_json` 带 BOM 解析会失败。请**不要**用 Windows 默认记事本或 `Out-File -Encoding utf8` 修改此文件。
:::

---

## 本地安装验证

打包完成后，本地安装验证：

1. 启动 Exero
2. 进入「设置」→「扩展包」
3. 点击「导入本地包」→ 选择 `.exero-pack` 文件
4. 安装成功后：
   - **动作包**：打开 Flow 编辑器，动作面板搜索新增动作 id 应该能搜到
   - **插件**：侧边栏出现新入口，点击能加载页面
5. 查看日志：`%APPDATA%\Exero\logs\exero.log`

---

## 发布到官方市场

当前官方市场基于 GitHub raw 分发：

| 项 | 值 |
|---|---|
| 主仓库 | `ansoukin/Exero`（main 分支） |
| 备源仓库 | `gitee.com/ansoukin/Exero`（GitHub Actions 自动同步，内容一致） |
| 动作包路径 | `Market/action-packs/<file_name>` |
| 插件路径 | `Market/plugins/<file_name>` |
| 索引路径 | `Market/market-index.json` |
| 下载 URL 模板 | `https://github.com/ansoukin/Exero/raw/main/Market/...` |

### 发布步骤

```powershell
# 1. 编译插件 .dll
cd examples\hello-plugin
cargo build --release
cd ..\..

# 2. 构建市场（含打包 + 索引）
powershell -ExecutionPolicy Bypass -File scripts\build-packs.ps1

# 3. 验证（检查 index 是否包含新包）
Get-Content Market\market-index.json | ConvertFrom-Json

# 4. 提交 + Push
git add Market/
git commit -m "feat(market): add xxx plugin"
git push
```

### 网络后备策略（用户端）

Exero 内部下载时的降级顺序：
1. `github.com` 直连
2. `gitee.com` 备源（与 GitHub 内容自动同步，直连失败时切换）
3. `ghproxy` 镜像加速（前两者均失败）
4. **离线模式**：仅展示/使用已安装包（完全断网时）

应用更新（UpdateManager 下载安装包）走同样的四级降级。

---

## 版本与更新

- **版本格式**：SemVer（`1.0.0`、`0.2.1`、`1.0.0-beta`）
- **更新判定**：相同 `id` 比较 `version` 字符串（语义化版本号比较）
- **兼容判定**：扩展包 `exero_api_version` 需包含于主程序兼容 API 版本区间

---

## 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 导入后动作没出现在 Flow 面板 | `pack_type` 不对或 `actions[]` 为空 | 检查 manifest `pack_type: "action"` 且 `actions` 非空 |
| 插件侧边栏无入口 | `sidebar` 声明缺失或 `pack_type != "plugin"` | 核对 manifest 两个字段 |
| 插件页面 404 | `ui.entry` 路径不对或 zip 有前缀目录 | 解压确认 `manifest.json` 在 zip 根目录 |
| market-index 解析失败 | 文件含 UTF-8 BOM | 用 `build-packs.ps1` 重新生成，不要用记事本修改 |
| Rust 动作找不到 | `executor_id` 与 `declare_actions!` 注册键不一致 | 必须严格相等（大小写敏感） |
