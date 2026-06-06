import { get, post, del } from './request'
import type {
  DocumentListResult,
  ProcessDocumentResult,
  UploadDocumentParams,
  BatchProcessResult,
  ChunkListResult,
  SourceContentResult,
  EmbeddingResult,
} from './model/documentModel'

enum Api {
  List = '/projects',
  Upload = '/projects',
  Documents = '/documents',
  Chunks = '/chunks',
}

/** 获取项目下的文档列表 */
export const getDocumentList = (projectId: string) =>
  get<DocumentListResult>({ url: `${Api.List}/${projectId}/documents` })

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

/** 处理单个文档 */
export const processDocument = (_projectId: string, documentId: string) =>
  post<ProcessDocumentResult>({ url: `${Api.Documents}/${documentId}/process` })

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

/** 批量处理文档 */
export const batchProcessDocuments = (_projectId: string, documentIds: string[]) =>
  post<BatchProcessResult>({ url: `${Api.Documents}/batch-process`, data: { document_ids: documentIds } })
