// Exero 自定义主题 - 继承默认主题 + 品牌色覆盖 + 版本徽章全局组件
import DefaultTheme from 'vitepress/theme'
import VersionBadge from './VersionBadge.vue'
import './overrides.css'

export default {
  extends: DefaultTheme,
  enhanceApp(ctx) {
    // 注册版本徽章为全局组件，可在 markdown 中直接使用 <VersionBadge />
    ctx.app.component('VersionBadge', VersionBadge)
  }
}
