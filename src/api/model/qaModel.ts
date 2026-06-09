/** 问答相关接口类型定义 */

/** 检索到的源文档片段 */
export interface QAChunk {
  chunk_id: string
  content: string
  score: number
  source_file: string
  file_type: string
  heading: string
}

/** 单条问答消息 */
export interface QAMessage {
  id: string
  question: string
  answer: string
  chunks: QAChunk[]
  latency_ms: number
  created_at: string
}

/** 提问请求参数 */
export interface AskQuestionParams {
  question: string
  max_k?: number
}

/** 提问响应 */
export interface AskQuestionResponse {
  id: string
  question: string
  answer: string
  chunks: QAChunk[]
  latency_ms: number
  embed_model_name: string
  created_at: string
}

/** 历史问答列表项 */
export interface QAHistoryItem {
  id: string
  question: string
  answer: string
  chunk_count: number
  latency_ms: number
  created_at: string
}
