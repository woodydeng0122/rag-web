<template>
  <a-form-item label="分块策略">
    <a-select v-model:value="formState.strategy">
      <a-select-option value="fixed">固定大小</a-select-option>
      <a-select-option value="recursive">递归字符</a-select-option>
      <a-select-option value="semantic">语义分块</a-select-option>
      <a-select-option value="section_heading">按章节标题</a-select-option>
      <a-select-option value="heading_aware">多级标题感知</a-select-option>
    </a-select>
  </a-form-item>
  <template v-if="formState.strategy === 'fixed' || formState.strategy === 'recursive'">
    <a-form-item label="分块大小">
      <a-input-number v-model:value="formState.chunk_size" :min="100" :max="8000" :step="100" />
      <span class="form-hint">单个分块最大字符数</span>
    </a-form-item>
    <a-form-item label="重叠大小">
      <a-input-number v-model:value="formState.chunk_overlap" :min="0" :max="500" :step="10" />
      <span class="form-hint">相邻分块重叠字符数</span>
    </a-form-item>
  </template>
  <template v-else-if="formState.strategy === 'semantic'">
    <a-form-item label="最大字符数">
      <a-input-number v-model:value="formState.max_chars" :min="200" :max="8000" :step="100" />
      <span class="form-hint">单个分块最大字符数</span>
    </a-form-item>
    <a-typography-text type="secondary" style="display: block; padding-left: 108px">
      语义分块会根据句子间的语义相似度自动切分，相似度低于阈值时切分
    </a-typography-text>
  </template>
  <template v-else>
    <a-form-item label="最小字符数">
      <a-input-number v-model:value="formState.min_chars" :min="50" :max="4000" :step="50" />
      <span class="form-hint">分块最小字符数</span>
    </a-form-item>
    <a-form-item label="最大字符数">
      <a-input-number v-model:value="formState.max_chars" :min="200" :max="8000" :step="100" />
      <span class="form-hint">分块最大字符数</span>
    </a-form-item>
    <a-form-item v-if="formState.strategy === 'heading_aware'" label="合并阈值">
      <a-input-number v-model:value="formState.merge_threshold" :min="0" :max="1" :step="0.1" />
      <span class="form-hint">短块合并的语义相似度阈值，0=仅按标题层级判断</span>
    </a-form-item>
  </template>
</template>

<script setup lang="ts">
import type { SplitterConfigFormState } from '@/composables/useSplitterConfig'

defineProps<{
  formState: SplitterConfigFormState
}>()
</script>

<style scoped>
@import '@/styles/common-table.css';
</style>
