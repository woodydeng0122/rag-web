<template>
  <div class="toolbar">
    <a-space>
      <h2 v-if="title" class="page-title">{{ title }}</h2>
      <slot name="left" />
    </a-space>
    <a-space :size="8">
      <slot name="actions" />
    </a-space>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
</style>
