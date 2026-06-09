export interface StatusOption {
  color: string
  text: string
}

export type StatusMap = Record<string, StatusOption>

export const DOC_STATUS_MAP: StatusMap = {
  ready: { color: 'success', text: '已完成' },
  processing: { color: 'processing', text: '处理中' },
  uploaded: { color: 'default', text: '已上传' },
  chunking: { color: 'processing', text: '分块中' },
  embedding: { color: 'processing', text: '向量化中' },
  error: { color: 'error', text: '失败' },
}

export const GOLDEN_STATUS_MAP: StatusMap = {
  pending_review: { color: 'warning', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已拒绝' },
}

export const EMBED_MODEL_STATUS_MAP: StatusMap = {
  online: { color: 'success', text: '在线' },
  offline: { color: 'default', text: '离线' },
}

export function getStatusInfo(map: StatusMap, status: string): StatusOption {
  return map[status] ?? { color: 'default', text: status }
}
