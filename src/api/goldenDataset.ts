import { get, post, put, del } from './request'
import type { GoldenDatasetItem, CreateGoldenDatasetParams, UpdateGoldenDatasetParams, EvaluateByProjectParams, EvaluateResult } from './model/goldenDatasetModel'

/** 获取项目下的黄金数据集列表 */
export const getGoldenDatasetList = (projectId: string) =>
  get<GoldenDatasetItem[]>({ url: `/projects/${projectId}/golden-dataset` })

/** 新增黄金记录 */
export const createGoldenDataset = (projectId: string, params: CreateGoldenDatasetParams) =>
  post<GoldenDatasetItem>({ url: `/projects/${projectId}/golden-dataset`, data: params })

/** 更新黄金记录 */
export const updateGoldenDataset = (id: string, params: UpdateGoldenDatasetParams) =>
  put<GoldenDatasetItem>({ url: `/golden-dataset/${id}`, data: params })

/** 删除黄金记录 */
export const deleteGoldenDataset = (id: string) =>
  del({ url: `/golden-dataset/${id}` })

/** 按项目评测 */
export const evaluateByProject = (projectId: string, params: EvaluateByProjectParams) =>
  post<EvaluateResult>({ url: `/evaluate/projects/${projectId}`, data: params })
