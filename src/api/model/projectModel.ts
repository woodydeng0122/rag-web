/** 项目相关接口类型定义 */

export interface CreateProjectParams {
  name: string
  description?: string
}

export interface ProjectItem {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  // 评测汇总字段
  eval_recall_at_10: number | null
  eval_mrr: number | null
  eval_answerable: number | null
  eval_total: number | null
  eval_latency_avg_ms: number | null
  evaluated_at: string | null
}
