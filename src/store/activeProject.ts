import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { getProfile, updateProfile } from '@/api/profile'
import { getProject } from '@/api/project'
import type { ProjectItem } from '@/api/model/projectModel'

export const useActiveProjectStore = defineStore('activeProject', () => {
  const activeProjectId = ref<string>('')
  const activeProject = ref<ProjectItem | null>(null)
  const appLoading = ref(true)

  const hasActiveProject = computed(() => !!activeProjectId.value)

  async function fetchActiveProject() {
    appLoading.value = true
    try {
      const profile = await getProfile()
      const projectId = profile.active_project_id || ''
      activeProjectId.value = projectId
      if (projectId) {
        activeProject.value = await getProject(projectId)
      } else {
        activeProject.value = null
      }
    } catch {
      activeProjectId.value = ''
      activeProject.value = null
    } finally {
      appLoading.value = false
    }
  }

  async function setActiveProject(id: string) {
    if (id === activeProjectId.value) return
    try {
      await updateProfile(id)
      activeProjectId.value = id
      activeProject.value = await getProject(id)
    } catch {
      message.error('激活项目失败')
    }
  }

  function clearActiveProject() {
    activeProjectId.value = ''
    activeProject.value = null
  }

  return {
    activeProjectId,
    activeProject,
    appLoading,
    hasActiveProject,
    fetchActiveProject,
    setActiveProject,
    clearActiveProject,
  }
})
