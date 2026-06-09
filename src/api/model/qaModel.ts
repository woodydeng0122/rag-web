/** 问答相关接口类型定义 */

/** 检索到的源文档片段 */
export interface QAChunk {
  chunk_id: string
  content: string
  score: number
  source_file: string
  heading: string
}

/** 问答会话 */
export interface QASession {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
}

/** 问答消息 */
export interface QAMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  chunks: QAChunk[]
  latency_ms: number | null
  created_at: string
}

/** 创建会话请求 */
export interface CreateSessionParams {
  title?: string
}

/** 流式提问请求 */
export interface AskStreamParams {
  query: string
  top_k?: number
}

/** SSE 流式事件 */
export interface SSEEvent {
  type: 'sources' | 'chunk' | 'done' | 'error'
  data?: string
  chunks?: QAChunk[]
  latency_ms?: number
}
