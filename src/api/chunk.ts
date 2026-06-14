import { get, post } from './request'
import type { ChunkItem } from './model/documentModel'
import type { GoldenItem, GroundTruthRef } from './model/goldenModel'

export interface ChunkSearchResult {
  document_id: string
  total: number
  chunks: ChunkItem[]
}

/** 搜索项目下的分块 */
export const searchProjectChunks = (projectId: string, q: string = '', limit: number = 20, offset: number = 0) =>
  get<ChunkSearchResult>({ url: `/projects/${projectId}/chunks/search`, params: { q, limit, offset } })

/** 按 ID 列表批量查询分块内容 */
export const getChunksByIds = (projectId: string, chunkIds: string[]) =>
  get<ChunkSearchResult>({ url: `/projects/${projectId}/chunks/batch`, params: { ids: chunkIds.join(',') } })

/** 查询分块关联的黄金记录 */
export const getChunkGoldenRecords = (projectId: string, chunkId: string) =>
  get<GoldenItem[]>({ url: `/projects/${projectId}/chunks/${chunkId}/golden-records` })

/** 按 storage_key + chunk_index 批量查询分块内容 */
export const getChunksByRefs = (projectId: string, refs: GroundTruthRef[]) =>
  post<ChunkSearchResult>({ url: `/projects/${projectId}/chunks/by-refs`, data: { refs } })

/** 统计项目下的分块总数 */
export const getChunkCount = (projectId: string) =>
  get<{ count: number }>({ url: `/projects/${projectId}/chunks/count` })
