import { get, post, put, del } from './request'
import instance from './request'
import type { GoldenDatasetItem, CreateGoldenDatasetParams, UpdateGoldenDatasetParams, EvaluateByProjectParams, EvaluateResult, ImportResult } from './model/goldenDatasetModel'

/** 获取项目下的黄金数据集列表 */
export const getGoldenDatasetList = (projectId: string) =>
  get<GoldenDatasetItem[]>({ url: `/projects/${projectId}/golden-datasets` })

/** 新增黄金记录 */
export const createGoldenDataset = (projectId: string, params: CreateGoldenDatasetParams) =>
  post<GoldenDatasetItem>({ url: `/projects/${projectId}/golden-datasets`, data: params })

/** 更新黄金记录 */
export const updateGoldenDataset = (projectId: string, id: string, params: UpdateGoldenDatasetParams) =>
  put<GoldenDatasetItem>({ url: `/projects/${projectId}/golden-datasets/${id}`, data: params })

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
