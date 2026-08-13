import { defineConfig } from 'vitepress'

// Exero 开发者文档 VitePress 配置
// 主题色：Exero 品牌蓝（浅色 #0078D4 / 深色 #2b9dff）

export default defineConfig({
  title: 'Exero',
  description: 'Exero 开发者文档 - Windows 桌面自动化管理工具',
  lastUpdated: true,
  cleanUrls: true,

  // GitHub Pages 部署路径：https://ansoukin.github.io/Exero/docs/
  // base 必须与实际访问路径一致，否则资源 404
  base: '/Exero/docs/',

  // 构建产物输出到 docs/docs/（GitHub Pages 静态站点目录）
  // outDir 相对于 srcDir（docs/），'docs' → docs/docs/
  srcExclude: ['docs/**'],
  outDir: 'docs',

  head: [
    ['meta', { name: 'theme-color', content: '#0078D4' }],
    ['link', { rel: 'icon', href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230078D4'/%3E%3Ctext x='50' y='72' font-size='64' font-weight='900' text-anchor='middle' fill='%23fff' font-family='system-ui'%3EE%3C/text%3E%3C/svg%3E" }],
  ],

  themeConfig: {
    siteTitle: 'Exero 文档',

    nav: [
      { text: '首页', link: '/' },
      { text: '快速入门', link: '/quick-start' },
      { text: '架构概览', link: '/architecture' },
      {
        text: '开发指南',
        items: [
          { text: '动作包开发', link: '/guides/action-pack' },
          { text: '插件开发', link: '/guides/plugin' },
          { text: 'UI 风格指南', link: '/guides/ui-style' },
        ]
      },
      {
        text: 'API 参考',
        items: [
          { text: 'Manifest 字段', link: '/api/manifest' },
          { text: '桥接 API', link: '/api/bridge-api' },
          { text: 'Lua API', link: '/api/lua-api' },
          { text: 'Rust SDK', link: '/api/sdk' },
          { text: '内置动作类型', link: '/api/action-types' },
        ]
      },
      {
        text: '更多',
        items: [
          { text: '构建与发布', link: '/build-and-publish' },
          { text: '调试与排错', link: '/troubleshooting' },
          { text: 'FAQ', link: '/faq' },
        ]
      },
      { text: 'GitHub', link: 'https://github.com/ansoukin/Exero' },
    ],

    sidebar: {
      '/': [
        {
          text: '开始',
          collapsed: false,
          items: [
            { text: '首页', link: '/' },
            { text: '快速入门', link: '/quick-start' },
            { text: '架构概览', link: '/architecture' },
          ]
        },
        {
          text: '开发指南',
          collapsed: false,
          items: [
            { text: '动作包开发', link: '/guides/action-pack' },
            { text: '插件开发', link: '/guides/plugin' },
            { text: 'UI 风格指南', link: '/guides/ui-style' },
          ]
        },
        {
          text: 'API 参考',
          collapsed: false,
          items: [
            { text: 'Manifest 字段', link: '/api/manifest' },
            { text: '桥接 API', link: '/api/bridge-api' },
            { text: 'Lua API', link: '/api/lua-api' },
            { text: 'Rust SDK', link: '/api/sdk' },
            { text: '内置动作类型', link: '/api/action-types' },
          ]
        },
        {
          text: '更多',
          collapsed: false,
          items: [
            { text: '构建与发布', link: '/build-and-publish' },
            { text: '调试与排错', link: '/troubleshooting' },
            { text: 'FAQ', link: '/faq' },
          ]
        },
      ]
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ansoukin/Exero' },
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 ansoukin'
    },

    outline: {
      label: '本页目录',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    lastUpdatedText: '最后更新',

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
  }
})
