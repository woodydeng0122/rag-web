import { get } from './request'
import type { ChunkItem } from './model/documentModel'
import type { GoldenItem } from './model/goldenModel'

export interface ChunkSearchResult {
  document_id: string
  total: number
  chunks: ChunkItem[]
}

/** 搜索项目下的分块 */
export const searchProjectChunks = (projectId: string, q: string = '', limit: number = 20, offset: number = 0) =>
  get<ChunkSearchResult>({ url: `/projects/${projectId}/chunks/search`, params: { q, limit, offset } })

/** 查询分块关联的黄金记录 */
export const getChunkGoldenRecords = (projectId: string, chunkId: string) =>
  get<GoldenItem[]>({ url: `/projects/${projectId}/chunks/${chunkId}/golden-records` })
