<script setup lang="ts">
// 版本徽章组件 - 在每个文档页面顶部显示适用版本号
// 用法：在 markdown 文件顶部写 <VersionBadge />
const version = 'V0.4.0-Beta6'
</script>

<template>
  <div class="version-badge">
    <span class="version-badge-label">适用版本</span>
    <span class="version-badge-version">{{ version }}</span>
  </div>
</template>

<style scoped>
.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  background: var(--vp-version-badge-bg, #0078D4);
  color: var(--vp-version-badge-text, #ffffff);
  margin-bottom: 16px;
}

.version-badge-label {
  opacity: 0.8;
}

.version-badge-version {
  font-weight: 600;
}
</style>
