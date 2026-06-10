import { get, post, del } from './request'
import instance from './request'
import type { QASession, QAMessage, CreateSessionParams, AskStreamParams, SSEEvent } from './model/qaModel'

/** 创建会话 */
export const createSession = (projectId: string, params?: CreateSessionParams) =>
  post<QASession>({ url: `/projects/${projectId}/qa/sessions`, data: params || {} })

/** 获取会话列表 */
export const getSessions = (projectId: string) =>
  get<QASession[]>({ url: `/projects/${projectId}/qa/sessions` })

/** 获取会话详情 */
export const getSession = (projectId: string, sessionId: string) =>
  get<QASession>({ url: `/projects/${projectId}/qa/sessions/${sessionId}` })

/** 删除会话 */
export const deleteSession = (projectId: string, sessionId: string) =>
  del({ url: `/projects/${projectId}/qa/sessions/${sessionId}` })

/** 获取会话消息列表 */
export const getMessages = (projectId: string, sessionId: string) =>
  get<QAMessage[]>({ url: `/projects/${projectId}/qa/sessions/${sessionId}/messages` })

/** 流式提问 (SSE) */
export async function askStream(
  projectId: string,
  sessionId: string,
  params: AskStreamParams,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const baseURL = instance.defaults.baseURL || ''
  const url = `${baseURL}/projects/${projectId}/qa/sessions/${sessionId}/ask`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('rag_access_token')
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE 协议：事件以 \n\n 分隔
    const eventBlocks = buffer.split('\n\n')
    buffer = eventBlocks.pop() || ''

    for (const block of eventBlocks) {
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6))
            onEvent(event)
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  // 处理 buffer 中剩余内容
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const event: SSEEvent = JSON.parse(line.slice(6))
          onEvent(event)
        } catch {
          // 忽略
        }
      }
    }
  }
}
