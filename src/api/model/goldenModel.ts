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
