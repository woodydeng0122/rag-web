import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { getEmbedModelList, refreshEmbedModelStatus } from '@/api/embedModel'
import type { EmbedModelItem } from '@/api/model/embedModelModel'

export const useEmbedModelStore = defineStore('embedModel', () => {
  const models = ref<EmbedModelItem[]>([])
  const loading = ref(false)
  const lastFetchTime = ref(0)

  // 缓存有效期 5 分钟
  const CACHE_TTL = 5 * 60 * 1000

  const onlineModels = computed(() => models.value.filter(m => m.status === 'online'))
  const onlineEmbedModels = computed(() => models.value.filter(m => m.status === 'online' && m.model_type === 'embed'))
  const onlineRerankerModels = computed(() => models.value.filter(m => m.status === 'online' && m.model_type === 'reranker'))

  const isCacheValid = computed(() =>
    models.value.length > 0 && (Date.now() - lastFetchTime.value) < CACHE_TTL
  )

  /** 获取模型列表，缓存有效则直接返回 */
  async function fetchModels(force = false) {
    if (!force && isCacheValid.value) return models.value

    loading.value = true
    try {
      const res = await getEmbedModelList()
      models.value = res.models || []
      lastFetchTime.value = Date.now()
    } catch {
      message.error('获取模型列表失败')
    } finally {
      loading.value = false
    }
    return models.value
  }

  /** 刷新模型状态（重新扫描 + 更新列表） */
  async function refreshStatus() {
    loading.value = true
    try {
      const res = await refreshEmbedModelStatus()
      models.value = res.models || []
      lastFetchTime.value = Date.now()
      message.success('状态已刷新')
    } catch {
      message.error('刷新状态失败')
    } finally {
      loading.value = false
    }
    return models.value
  }

  /** 使缓存失效，下次访问时自动重新获取 */
  function invalidateCache() {
    lastFetchTime.value = 0
  }

  return {
    models,
    loading,
    onlineModels,
    onlineEmbedModels,
    onlineRerankerModels,
    fetchModels,
    refreshStatus,
    invalidateCache,
  }
})
