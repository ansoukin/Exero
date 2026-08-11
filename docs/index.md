---
layout: home

hero:
  name: Exero
  text: 开发者文档
  tagline: Windows 桌面自动化管理工具 · 可视化积木 + 快捷指令 + 扩展市场
  actions:
    - theme: brand
      text: 快速入门
      link: /quick-start
    - theme: alt
      text: 架构概览
      link: /architecture
    - theme: alt
      text: GitHub
      link: https://github.com/ansoukin/Exero

features:
  - title: 可视化积木编辑器
    details: 拖拽连线组合工作流，6 大类 20 种动作节点，无需写一行代码。基于 React Flow 实现。
  - title: 双扩展形态
    details: 动作包（Action Pack）提供 Flow 积木，插件（Plugin）提供完整 UI 页面。支持 Rust .dll 和 Lua 两种执行器。
  - title: Rust 高性能后端
    details: Tauri v2 + Rust，libloading 动态加载 .dll，C ABI 稳定接口，exero-plugin-sdk 宏自动生成。
  - title: Lua 脚本沙箱
    details: LuaJIT 引擎，严格沙箱默认禁用危险 API，5 个核心 API（log/notify/var/result），10 秒超时保护。
  - title: 插件 UI 桥接
    details: iframe 隔离 + Tauri 自定义协议 + postMessage 桥接 API，插件崩溃不影响主程序。
  - title: 在线扩展市场
    details: GitHub 仓库分发，market-index.json 索引优化，一键安装/更新/卸载，镜像加速 + 离线兜底。
---
