/** 项目相关接口类型定义 */

export interface CreateProjectParams {
  name: string
  description?: string
}

export interface ProjectItem {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}
