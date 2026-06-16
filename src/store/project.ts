import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getProjectList } from '@/api/project'
import type { ProjectItem } from '@/api/model/projectModel'

export const useProjectStore = defineStore('project', () => {
  const projectList = ref<ProjectItem[]>([])

  async function fetchProjectList() {
    projectList.value = await getProjectList()
  }

  return { projectList, fetchProjectList }
})
