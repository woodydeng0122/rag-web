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
  Process = '/documents',
  Delete = '/documents',
  Chunks = '/documents',
  Source = '/documents',
  Embedding = '/chunks',
  BatchProcess = '/documents/batch-process',
}

/** 获取项目下的文档列表 */
export const getDocumentList = (projectId: string) =>
  get<DocumentListResult>({ url: `${Api.List}/${projectId}/documents` })

/** 上传文档 */
export const uploadDocument = (params: UploadDocumentParams) => {
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.embedder_model) formData.append('embedder_model', params.embedder_model)
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
export const processDocument = (documentId: string) =>
  post<ProcessDocumentResult>({ url: `${Api.Process}/${documentId}/process` })

/** 删除文档 */
export const deleteDocument = (documentId: string) =>
  del({ url: `${Api.Delete}/${documentId}` })

/** 获取文档分块列表 */
export const getChunkList = (documentId: string) =>
  get<ChunkListResult>({ url: `${Api.Chunks}/${documentId}/chunks` })

/** 获取文档源文件内容 */
export const getSourceContent = (documentId: string) =>
  get<SourceContentResult>({ url: `${Api.Source}/${documentId}/source` })

/** 获取分块的 embedding 向量 */
export const getChunkEmbedding = (chunkId: string) =>
  get<EmbeddingResult>({ url: `${Api.Embedding}/${chunkId}/embedding` })
