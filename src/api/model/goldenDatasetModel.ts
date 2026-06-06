/** 黄金数据集相关接口类型定义 */

export interface EvaluationMetrics {
  retrieved_chunk_ids: string[]
  is_hit: boolean | null
  hit_rank: number | null
  evaluated_at: string | null
}

export interface GoldenDatasetItem {
  id: string
  project_id: string
  query: string
  ground_truth_chunks: string[]
  reference_answer: string
  status: string
  evaluation: EvaluationMetrics | null
  created_at: string
  metadata: Record<string, any>
}

export interface CreateGoldenDatasetParams {
  query: string
  ground_truth_chunks: string[]
  reference_answer?: string
}

export interface UpdateGoldenDatasetParams {
  query?: string
  ground_truth_chunks?: string[]
  reference_answer?: string
  status?: string
}

export interface EvaluateByProjectParams {
  golden_ids: string[]
  k_list?: number[]
}

export interface EvaluateResult {
  time: string
  embedding_file: string
  golden_file: string
  embedder_model: string
  answerable_count: number
  recall: Record<string, { hits: number; recall: number }>
  mrr: number
  latency_total_ms: number
  latency_avg_ms: number
  failure: string[]
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
