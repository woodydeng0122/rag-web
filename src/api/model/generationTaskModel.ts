/** 生成任务相关接口类型定义 */

export interface GenerateConfig {
  per_chunk?: number
  question_types?: Record<string, number>
  difficulty?: string
  user_persona?: string
  chunk_batch_size?: number
  file_char_threshold?: number
}

export interface GenerateGoldenParams {
  document_ids?: string[]
  chunk_ids?: string[]
  config?: GenerateConfig
}

export interface GenerateGoldenResult {
  task_id: string
  status: string
}

export interface GenerationTaskItem {
  id: string
  project_id: string
  status: string
  total: number
  completed: number
  failed: number
  document_ids: string[]
  chunk_ids: string[]
  config: Record<string, any>
  error_message: string
  created_at: string
  finished_at: string | null
}
