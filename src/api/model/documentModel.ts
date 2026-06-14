/** 文档相关接口类型定义 */

export interface SplitterConfig {
  strategy: string
  chunk_size: number
  chunk_overlap: number
  min_chars: number
  max_chars: number
}

export interface DocumentItem {
  id: string
  project_id: string
  filename: string
  storage_key: string
  file_size: number
  file_type: string
  checksum: string
  status: string
  splitter_config: SplitterConfig
  chunk_count: number
  golden_record_count: number
  error_message: string
  created_at: string
  updated_at: string
}

export interface DocumentListResult {
  documents: DocumentItem[]
}

export interface ProcessDocumentResult {
  id: string
  status: string
  chunk_count: number
  error_message: string
}

export interface UploadDocumentParams {
  project_id: string
  file: File
  splitter_strategy?: string
  chunk_size?: number
  chunk_overlap?: number
  splitter_min_chars?: number
  splitter_max_chars?: number
}

export interface UploadDocumentResult {
  documents: Record<string, string | number>[]
  count: number
}

export interface BatchProcessResult {
  total: number
  success: number
  failed: number
  results: { id: string; status: string; chunk_count: number; error_message: string }[]
}

export interface ChunkItem {
  id: string
  index: number
  heading: string
  content: string
  source_file: string
  file_type: string
}

export interface ChunkListResult {
  document_id: string
  total: number
  chunks: ChunkItem[]
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
  READY = 'ready',
  ERROR = 'error',
}

export interface SourceContentResult {
  document_id: string
  file_type: string
  content: string
}

export interface EmbeddingResult {
  chunk_id: string
  vector: number[]
  dimension: number
}

export interface InheritDocumentItem {
  id: string
  filename: string
  file_type: string
  file_size: number
  storage_key: string
  status: string
}

export interface InheritResult {
  inherited_count: number
  skipped_count: number
  documents: InheritDocumentItem[]
}
