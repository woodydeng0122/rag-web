/** 项目相关接口类型定义 */

export interface CreateProjectParams {
  name: string
  description?: string
  embed_model_id: string
}

export interface ProjectItem {
  id: string
  name: string
  description: string
  embed_model_id: string
  embed_model_name: string
  embed_dimension: number
  created_at: string
  updated_at: string
}
