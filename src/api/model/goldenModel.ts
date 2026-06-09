/** 黄金数据集相关接口类型定义 */

export interface GoldenItem {
  id: string
  project_id: string
  query: string
  ground_truth_chunks: string[]
  reference_answer: string
  status: string
  created_at: string
  metadata: Record<string, any>
  has_retrieval: boolean
}

export interface CreateGoldenParams {
  query: string
  ground_truth_chunks: string[]
  reference_answer?: string
}

export interface UpdateGoldenParams {
  query?: string
  ground_truth_chunks?: string[]
  reference_answer?: string
  status?: string
}

export interface SkippedRecord {
  row: number
  reason: string
}

export interface ImportResult {
  success_count: number
  skipped_count: number
  skipped: SkippedRecord[]
}

export interface BatchStatusUpdateParams {
  record_ids: string[]
}

export interface BatchStatusUpdateResult {
  updated_count: number
}

/** 检索结果项 */
export interface RetrievalItem {
  chunk_id: string
  score: number
  rank: number
  content: string
  heading: string
  source_file: string
  is_ground_truth: boolean
}

/** 检索结果 */
export interface RetrievalResponse {
  id: string
  golden_id: string
  max_k: number
  latency_ms: number
  embed_model_name: string
  created_at: string
  items: RetrievalItem[]
}

/** 触发检索请求参数 */
export interface CreateRetrievalParams {
  max_k: number
}
