<template>
  <a-empty :description="description">
    <a-button type="primary" @click="router.push('/projects')">{{ buttonText }}</a-button>
  </a-empty>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  description?: string
  buttonText?: string
}>(), {
  description: '请先选择一个项目',
  buttonText: '前往项目页',
})

const router = useRouter()
</script>
