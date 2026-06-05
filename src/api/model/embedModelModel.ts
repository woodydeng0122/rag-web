/** 嵌入模型相关接口类型定义 */

export interface EmbedModelItem {
  id: string
  name: string
  dimension: number
  description: string
  status: string  // online / offline
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface EmbedModelListResult {
  models: EmbedModelItem[]
}

export interface CreateEmbedModelParams {
  name: string
  description?: string
  dimension?: number  // 本地无 config.json 时由用户指定
}

export interface UpdateEmbedModelParams {
  name: string
  description?: string
}
