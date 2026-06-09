import { get, post } from './request'
import type { AskQuestionParams, AskQuestionResponse, QAHistoryItem } from './model/qaModel'

/** 提问 */
export const askQuestion = (projectId: string, params: AskQuestionParams) =>
  post<AskQuestionResponse>({ url: `/projects/${projectId}/qa/ask`, data: params, timeout: 60000 })

/** 获取问答历史 */
export const getQAHistory = (projectId: string) =>
  get<QAHistoryItem[]>({ url: `/projects/${projectId}/qa/history` })

/** 获取单条问答详情 */
export const getQADetail = (projectId: string, id: string) =>
  get<AskQuestionResponse>({ url: `/projects/${projectId}/qa/${id}` })
