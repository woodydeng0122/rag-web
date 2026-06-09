<template>
  <a-card :bordered="false" size="small">
    <template #title>
      <a-space :size="8">
        <span>{{ title }}</span>
        <a-tag :color="tagColor">{{ tag }}</a-tag>
      </a-space>
    </template>
    <a-statistic :value="value" :suffix="suffix" :value-style="{ fontSize: '24px', fontWeight: 600 }" />
    <div v-if="showDiff">
      <a-space :size="4" v-if="diff !== 0">
        <arrow-up-outlined v-if="diff > 0" style="color: var(--ant-color-success)" />
        <arrow-down-outlined v-else style="color: var(--ant-color-error)" />
        <span :style="{ color: diff > 0 ? 'var(--ant-color-success)' : 'var(--ant-color-error)', fontSize: '12px' }">
          {{ formatDiff(Math.abs(diff)) }}
        </span>
        <span style="color: var(--ant-color-text-quaternary); font-size: 12px">较上次</span>
      </a-space>
      <span v-else style="color: var(--ant-color-text-quaternary); font-size: 12px">- 较上次</span>
    </div>
    <slot name="extra" />
  </a-card>
</template>

<script setup lang="ts">
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons-vue'

withDefaults(defineProps<{
  title: string
  tag: string
  tagColor: string
  value: string | number
  suffix?: string
  diff?: number
  showDiff?: boolean
  formatDiff?: (v: number) => string
}>(), {
  suffix: '',
  diff: 0,
  showDiff: false,
  formatDiff: (v: number) => String(v),
})
</script>
