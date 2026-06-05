import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePageStore = defineStore('page', () => {
  const refreshTrigger = ref(0)

  function triggerRefresh() {
    refreshTrigger.value++
    console.log('[page store] triggerRefresh, count:', refreshTrigger.value)
  }

  return { refreshTrigger, triggerRefresh }
})
