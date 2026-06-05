import { get, post, put, del } from './request'
import type { EmbedModelListResult, EmbedModelItem, CreateEmbedModelParams, UpdateEmbedModelParams } from './model/embedModelModel'

/** 获取嵌入模型列表 */
export const getEmbedModelList = () =>
  get<EmbedModelListResult>({ url: '/embed-models' })

/** 获取嵌入模型详情 */
export const getEmbedModelDetail = (id: string) =>
  get<EmbedModelItem>({ url: `/embed-models/${id}` })

/** 刷新模型状态 */
export const refreshEmbedModelStatus = () =>
  post<EmbedModelListResult>({ url: '/embed-models/status' })

/** 新增嵌入模型 */
export const createEmbedModel = (data: CreateEmbedModelParams) =>
  post<EmbedModelItem>({ url: '/embed-models', data })

/** 更新嵌入模型 */
export const updateEmbedModel = (id: string, data: UpdateEmbedModelParams) =>
  put<EmbedModelItem>({ url: `/embed-models/${id}`, data })

/** 删除嵌入模型 */
export const deleteEmbedModel = (id: string) =>
  del<{ detail: string }>({ url: `/embed-models/${id}` })
