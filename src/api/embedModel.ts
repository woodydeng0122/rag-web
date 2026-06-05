import { get, post } from './request'
import type { EmbedModelListResult } from './model/embedModelModel'

/** 获取嵌入模型列表 */
export const getEmbedModelList = () =>
  get<EmbedModelListResult>({ url: '/embed-models' })

/** 刷新模型状态 */
export const checkEmbedModelStatus = () =>
  post<EmbedModelListResult>({ url: '/embed-models/check-status' })
