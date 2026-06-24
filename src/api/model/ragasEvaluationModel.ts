/** RAGAS 评估结果 */
export interface RagasEvaluationResult {
  id: string
  project_id: string
  context_recall: number
  context_precision: number
  faithfulness: number
  answer_relevancy: number
  top_k: number
  golden_total: number
  strategy: string
  embed_model_name: string
  avg_latency_ms: number
  ttfb_ms: number
  remark: string
  created_at: string
}

/** 触发 RAGAS 评估参数 */
export interface TriggerRagasEvaluationParams {
  top_k?: number
  strategy?: string
  remark?: string
}
