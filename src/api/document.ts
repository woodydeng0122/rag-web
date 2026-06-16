import { get, post, del } from './request'
import type {
  DocumentListResult,
  ProcessDocumentResult,
  UploadDocumentParams,
  ChunkListResult,
  SourceContentResult,
  EmbeddingResult,
  InheritResult,
  SplitterConfig,
} from './model/documentModel'

enum Api {
  List = '/projects',
  Upload = '/projects',
  Documents = '/documents',
  Chunks = '/chunks',
}

/** 获取项目下的文档列表 */
export const getDocumentList = (projectId: string, params?: { limit?: number; offset?: number; status?: string }) =>
  get<DocumentListResult>({ url: `${Api.List}/${projectId}/documents`, params })

/** 上传文档 */
export const uploadDocument = (params: UploadDocumentParams) => {
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.splitter_strategy) formData.append('splitter_strategy', params.splitter_strategy)
  if (params.chunk_size) formData.append('chunk_size', String(params.chunk_size))
  if (params.chunk_overlap) formData.append('chunk_overlap', String(params.chunk_overlap))
  if (params.splitter_min_chars) formData.append('splitter_min_chars', String(params.splitter_min_chars))
  if (params.splitter_max_chars) formData.append('splitter_max_chars', String(params.splitter_max_chars))

  return post<UploadDocumentParams>({
    url: `${Api.Upload}/${params.project_id}/documents`,
    data: formData,
  })
}

/** 仅分块单个文档，支持可选的策略覆盖 */
export const chunkDocument = (_projectId: string, documentId: string, splitterConfig?: SplitterConfig) =>
  post<ProcessDocumentResult>({
    url: `${Api.Documents}/${documentId}/chunk`,
    data: { splitter_config: splitterConfig || null },
  })

/** 仅向量化单个文档 */
export const embedDocument = (_projectId: string, documentId: string) =>
  post<ProcessDocumentResult>({ url: `${Api.Documents}/${documentId}/embed` })

/** 删除文档 */
export const deleteDocument = (_projectId: string, documentId: string) =>
  del({ url: `${Api.Documents}/${documentId}` })

/** 获取文档分块列表 */
export const getChunkList = (_projectId: string, documentId: string) =>
  get<ChunkListResult>({ url: `${Api.Documents}/${documentId}/chunks` })

/** 获取文档源文件内容 */
export const getSourceContent = (_projectId: string, documentId: string) =>
  get<SourceContentResult>({ url: `${Api.Documents}/${documentId}/source` })

/** 获取分块的 embedding 向量 */
export const getChunkEmbedding = (_projectId: string, chunkId: string) =>
  get<EmbeddingResult>({ url: `${Api.Chunks}/${chunkId}/embedding` })

/** 继承文档 */
export const inheritDocuments = (projectId: string, sourceProjectId: string) =>
  post<InheritResult>({ url: `${Api.List}/${projectId}/documents/inherit`, data: { source_project_id: sourceProjectId } })
