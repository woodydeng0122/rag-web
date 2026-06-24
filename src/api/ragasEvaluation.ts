import { get, post, del } from './request'
import type { RagasEvaluationResult, TriggerRagasEvaluationParams } from './model/ragasEvaluationModel'

enum Api {
  Base = '/projects',
}

/** 触发 RAGAS 评估 */
export const triggerRagasEvaluation = (projectId: string, params: TriggerRagasEvaluationParams) =>
  post<RagasEvaluationResult>({ url: `${Api.Base}/${projectId}/ragas-evaluations`, data: params })

/** 查询 RAGAS 评估历史 */
export const getRagasEvaluationHistory = (projectId: string) =>
  get<RagasEvaluationResult[]>({ url: `${Api.Base}/${projectId}/ragas-evaluations` })

/** 删除 RAGAS 评估记录 */
export const deleteRagasEvaluation = (projectId: string, evaluationId: string) =>
  del({ url: `${Api.Base}/${projectId}/ragas-evaluations/${evaluationId}` })
