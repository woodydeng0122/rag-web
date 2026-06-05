/** 嵌入模型相关接口类型定义 */

export interface EmbedModelItem {
  id: string
  name: string
  dimension: number
  description: string
  status: string  // online / offline
  created_at: string
  updated_at: string
}

export interface EmbedModelListResult {
  models: EmbedModelItem[]
}
