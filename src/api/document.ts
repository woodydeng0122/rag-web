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
  Process = '/projects',
  Delete = '/projects',
  Chunks = '/projects',
  Source = '/projects',
  Embedding = '/projects',
  BatchProcess = '/projects',
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
export const processDocument = (projectId: string, documentId: string) =>
  post<ProcessDocumentResult>({ url: `${Api.Process}/${projectId}/documents/${documentId}/process` })

/** 删除文档 */
export const deleteDocument = (projectId: string, documentId: string) =>
  del({ url: `${Api.Delete}/${projectId}/documents/${documentId}` })

/** 获取文档分块列表 */
export const getChunkList = (projectId: string, documentId: string) =>
  get<ChunkListResult>({ url: `${Api.Chunks}/${projectId}/documents/${documentId}/chunks` })

/** 获取文档源文件内容 */
export const getSourceContent = (projectId: string, documentId: string) =>
  get<SourceContentResult>({ url: `${Api.Source}/${projectId}/documents/${documentId}/source` })

/** 获取分块的 embedding 向量 */
export const getChunkEmbedding = (projectId: string, chunkId: string) =>
  get<EmbeddingResult>({ url: `${Api.Embedding}/${projectId}/chunks/${chunkId}/embedding` })

/** 批量处理文档 */
export const batchProcessDocuments = (projectId: string, documentIds: string[]) =>
  post<BatchProcessResult>({ url: `${Api.BatchProcess}/${projectId}/documents/batch-process`, data: { document_ids: documentIds } })
