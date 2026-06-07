import { get, post, patch, del } from './request'
import instance from './request'
import type { GoldenDatasetItem, CreateGoldenDatasetParams, UpdateGoldenDatasetParams, EvaluateByProjectParams, EvaluateResult, ImportResult, BatchStatusUpdateParams, BatchStatusUpdateResult } from './model/goldenDatasetModel'

/** 获取项目下的黄金数据集列表 */
export const getGoldenDatasetList = (projectId: string, status?: string) =>
  get<GoldenDatasetItem[]>({ url: `/projects/${projectId}/golden-datasets`, params: status ? { status } : undefined })

/** 按文档 ID 查询关联的黄金记录 */
export const getDocumentGoldenRecords = (projectId: string, documentId: string) =>
  get<GoldenDatasetItem[]>({ url: `/projects/${projectId}/documents/${documentId}/golden-datasets` })

/** 新增黄金记录 */
export const createGoldenDataset = (projectId: string, params: CreateGoldenDatasetParams) =>
  post<GoldenDatasetItem>({ url: `/projects/${projectId}/golden-datasets`, data: params })

/** 更新黄金记录 */
export const updateGoldenDataset = (projectId: string, id: string, params: UpdateGoldenDatasetParams) =>
  patch<GoldenDatasetItem>({ url: `/projects/${projectId}/golden-datasets/${id}`, data: params })

/** 删除黄金记录 */
export const deleteGoldenDataset = (projectId: string, id: string) =>
  del({ url: `/projects/${projectId}/golden-datasets/${id}` })

/** 按项目评测 */
export const evaluateByProject = (projectId: string, params: EvaluateByProjectParams) =>
  post<EvaluateResult>({ url: `/projects/${projectId}/evaluations`, data: params })

/** 导入黄金数据集文件 */
export const importGoldenDataset = (projectId: string, file: File): Promise<ImportResult> => {
  const formData = new FormData()
  formData.append('file', file)
  return instance.post(`/projects/${projectId}/golden-datasets/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 批量审批通过 */
export const batchApprove = (projectId: string, params: BatchStatusUpdateParams) =>
  post<BatchStatusUpdateResult>({ url: `/projects/${projectId}/golden-datasets/batch-approve`, data: params })

/** 批量拒绝 */
export const batchReject = (projectId: string, params: BatchStatusUpdateParams) =>
  post<BatchStatusUpdateResult>({ url: `/projects/${projectId}/golden-datasets/batch-reject`, data: params })
