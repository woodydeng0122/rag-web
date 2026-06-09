<template>
  <div class="split-panel-layout">
    <div class="split-panel-left">
      <div class="panel-title" :style="{ background: leftTitleBg === 'success' ? 'var(--ant-color-success)' : 'var(--ant-color-primary)' }">{{ leftTitle }}</div>
      <div class="split-panel-body">
        <slot name="left" />
      </div>
    </div>
    <div class="split-panel-right">
      <div class="panel-title" :style="{ background: rightTitleBg === 'primary' ? 'var(--ant-color-primary)' : 'var(--ant-color-success)' }">{{ rightTitle }}</div>
      <div class="split-panel-body">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  leftTitle: string
  rightTitle: string
  leftTitleBg?: 'primary' | 'success'
  rightTitleBg?: 'primary' | 'success'
}>(), {
  leftTitleBg: 'primary',
  rightTitleBg: 'success',
})
</script>

<style scoped>
.split-panel-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 120px);
}

.split-panel-left,
.split-panel-right {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-title {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ant-color-text-light-solid);
  flex-shrink: 0;
}

.split-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.split-panel-left :deep(.ant-spin-nested-loading),
.split-panel-right :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.split-panel-left :deep(.ant-spin-container),
.split-panel-right :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
