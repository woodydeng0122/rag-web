import { get, post, patch, del } from './request'
import instance from './request'
import type { GoldenItem, GoldenListResult, CreateGoldenParams, UpdateGoldenParams, ImportResult, RetrievalResponse, CreateRetrievalParams, RerankResponse, CreateRerankParams } from './model/goldenModel'

/** 获取项目下的黄金数据集列表 */
export const getGoldenList = (projectId: string, params?: { status?: string; retrieval_status?: string; limit?: number; offset?: number }) =>
  get<GoldenListResult>({ url: `/projects/${projectId}/golden`, params })

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

/** 触发检索 */
export const createRetrieval = (projectId: string, recordId: string, params: CreateRetrievalParams) =>
  post<RetrievalResponse>({ url: `/projects/${projectId}/golden/${recordId}/retrieval`, data: params, timeout: 60000 })

/** 获取检索结果 */
export const getRetrieval = (projectId: string, recordId: string) =>
  get<RetrievalResponse>({ url: `/projects/${projectId}/golden/${recordId}/retrieval` })

/** 触发重排 */
export const createRerank = (projectId: string, recordId: string, params: CreateRerankParams) =>
  post<RerankResponse>({ url: `/projects/${projectId}/golden/${recordId}/rerank`, data: params, timeout: 60000 })

/** 获取重排结果 */
export const getRerank = (projectId: string, recordId: string) =>
  get<RerankResponse>({ url: `/projects/${projectId}/golden/${recordId}/rerank` })
