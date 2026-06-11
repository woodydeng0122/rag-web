/** 黄金数据集相关接口类型定义 */

export interface RetrievalSummary {
  hit_count: number
  gt_total: number
}

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
  retrieval_summary: RetrievalSummary | null
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

/** 检索结果项 */
export interface RetrievalItem {
  chunk_id: string
  score: number
  rank: number
  content: string
  heading: string
  source_file: string
  file_type: string
  is_ground_truth: boolean
}

/** 检索结果 */
export interface RetrievalResponse {
  id: string
  golden_id: string
  max_k: number
  latency_ms: number
  strategy: string
  embed_latency_ms: number
  search_latency_ms: number
  load_embeddings_latency_ms: number
  load_project_latency_ms: number
  load_embed_model_latency_ms: number
  get_embedder_latency_ms: number
  build_matrix_latency_ms: number
  embed_model_name: string
  created_at: string
  items: RetrievalItem[]
}

/** 检索策略 */
export type RetrievalStrategy = 'cosine' | 'vector' | 'bm25' | 'hybrid'

/** 触发检索请求参数 */
export interface CreateRetrievalParams {
  max_k: number
  strategy?: RetrievalStrategy
}
