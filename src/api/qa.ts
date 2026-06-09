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
  const response = await fetch(
    `${instance.defaults.baseURL}/projects/${projectId}/qa/sessions/${sessionId}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
  )

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
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
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
