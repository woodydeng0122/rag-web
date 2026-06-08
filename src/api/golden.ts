import { get, post, patch, del } from './request'
import instance from './request'
import type { GoldenItem, CreateGoldenParams, UpdateGoldenParams, ImportResult, BatchStatusUpdateParams, BatchStatusUpdateResult } from './model/goldenModel'

/** 获取项目下的黄金数据集列表 */
export const getGoldenList = (projectId: string, status?: string) =>
  get<GoldenItem[]>({ url: `/projects/${projectId}/golden`, params: status ? { status } : undefined })

/** 按文档 ID 查询关联的黄金记录 */
export const getDocumentGoldenRecords = (projectId: string, documentId: string) =>
  get<GoldenItem[]>({ url: `/projects/${projectId}/documents/${documentId}/golden` })

/** 新增黄金记录 */
export const createGolden = (projectId: string, params: CreateGoldenParams) =>
  post<GoldenItem>({ url: `/projects/${projectId}/golden`, data: params })

/** 更新黄金记录 */
export const updateGolden = (projectId: string, id: string, params: UpdateGoldenParams) =>
  patch<GoldenItem>({ url: `/projects/${projectId}/golden/${id}`, data: params })

/** 删除黄金记录 */
export const deleteGolden = (projectId: string, id: string) =>
  del({ url: `/projects/${projectId}/golden/${id}` })

/** 导入黄金数据集文件 */
export const importGolden = (projectId: string, file: File): Promise<ImportResult> => {
  const formData = new FormData()
  formData.append('file', file)
  return instance.post(`/projects/${projectId}/golden/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 批量审批通过 */
export const batchApprove = (projectId: string, params: BatchStatusUpdateParams) =>
  post<BatchStatusUpdateResult>({ url: `/projects/${projectId}/golden/batch-approve`, data: params })

/** 批量拒绝 */
export const batchReject = (projectId: string, params: BatchStatusUpdateParams) =>
  post<BatchStatusUpdateResult>({ url: `/projects/${projectId}/golden/batch-reject`, data: params })
