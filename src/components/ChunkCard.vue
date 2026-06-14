<template>
  <div
    class="chunk-card"
    :class="{
      'chunk-card--even': even,
      'chunk-card--odd': !even,
      'chunk-card--clickable': clickable,
    }"
    @click="$emit('click')"
  >
    <div v-if="label || score != null" class="chunk-card__header">
      <span v-if="label" class="chunk-card__label">{{ label }}</span>
      <span v-if="score != null" class="chunk-card__score">score: {{ score.toFixed(4) }}</span>
    </div>
    <div v-if="heading" class="chunk-card__heading">{{ heading }}</div>
    <MarkdownRenderer :content="content" :file-type="fileType || ''" />
    <div v-if="sourceFile" class="chunk-card__source">{{ sourceFile }}</div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

withDefaults(defineProps<{
  content: string
  fileType?: string
  heading?: string
  sourceFile?: string
  score?: number
  label?: string
  even?: boolean
  clickable?: boolean
}>(), {
  even: true,
  clickable: false,
})

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.chunk-card {
  border-radius: 6px;
  padding: 10px 12px;
  flex-shrink: 0;
}
.chunk-card--even {
  background: var(--ant-color-error-bg);
  border: 1px solid var(--ant-color-error-border);
}
.chunk-card--odd {
  background: var(--ant-color-success-bg);
  border: 1px solid var(--ant-color-success-border);
}
.chunk-card--clickable {
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
}
.chunk-card--clickable:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}
.chunk-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.chunk-card__label {
  font-weight: 600;
  color: var(--ant-color-primary);
  font-size: 13px;
  flex-shrink: 0;
}
.chunk-card__score {
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
}
.chunk-card__heading {
  font-weight: 500;
  font-size: 12px;
  color: var(--ant-color-primary);
  margin-bottom: 4px;
}
.chunk-card__source {
  font-size: 11px;
  color: var(--ant-color-text-quaternary);
  margin-top: 4px;
}
</style>
