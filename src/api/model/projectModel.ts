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

export interface EvaluationStatsResult {
  id: string
  project_id: string
  top_k: number
  golden_total: number
  golden_retrieved: number
  recall_at_k: number
  mrr: number
  hit_rate: number
  full_hit_count: number
  zero_hit_count: number
  avg_latency_ms: number
  avg_embed_latency_ms: number
  avg_search_latency_ms: number
  embed_model_name: string
  created_at: string
}
