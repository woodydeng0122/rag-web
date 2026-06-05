<template>
  <div class="document-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select v-model:value="filterStatus" placeholder="状态筛选" class="filter-select" @change="onFilter" allow-clear>
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="ready">已完成</a-select-option>
          <a-select-option value="processing">处理中</a-select-option>
          <a-select-option value="error">失败</a-select-option>
          <a-select-option value="uploaded">已上传</a-select-option>
          <a-select-option value="chunking">分块中</a-select-option>
          <a-select-option value="embedding">向量化中</a-select-option>
        </a-select>
      </div>
      <div class="toolbar-right">
        <a-button @click="handleBatchProcess" :disabled="selectedRowKeys.length === 0">
          <template #icon><play-circle-outlined /></template>
          批量处理 ({{ selectedRowKeys.length }})
        </a-button>
        <a-button type="primary" @click="handleUploadClick">
          <template #icon><upload-outlined /></template>
          上传文档
        </a-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <a-card :bordered="false" class="table-card">
      <a-spin :spinning="loading">
        <a-table
          :columns="columns"
          :data-source="filteredDocuments"
          row-key="id"
          :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
          :pagination="paginationConfig"
          size="middle"
          :scroll="{ x: 900 }"
        >
          <template #bodyCell="{ column, record }">
            <!-- 文件名 -->
            <template v-if="column.key === 'filename'">
              <div class="file-cell">
                <component :is="fileIcon(record.file_type)" class="file-icon" />
                <span class="file-name" :title="record.filename">{{ record.filename }}</span>
              </div>
            </template>

            <!-- 类型 -->
            <template v-if="column.key === 'file_type'">
              <span class="type-cell">{{ record.file_type?.toUpperCase() }}</span>
            </template>

            <!-- 状态 -->
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)" class="status-tag">
                {{ statusText(record.status) }}
              </a-tag>
            </template>

            <!-- 上传时间 -->
            <template v-if="column.key === 'created_at'">
              <span class="time-cell" :title="formatFullTime(record.created_at)">
                {{ formatTime(record.created_at) }}
              </span>
            </template>

            <!-- 操作 -->
            <template v-if="column.key === 'action'">
              <div class="action-cell">
                <a-button type="link" size="small" @click="handleViewDetail(record)">
                  详情
                </a-button>
                <a-button type="link" size="small" @click="handleProcess(record)" :loading="processingIds.includes(record.id)" :disabled="!canProcess(record.status)">
                  处理
                </a-button>
                <a-popconfirm title="确定删除此文档？此操作不可恢复" @confirm="handleDelete(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <!-- 空状态 -->
    <a-empty v-if="!loading && filteredDocuments.length === 0" description="暂无文档，点击右上角上传添加" />

    <!-- 上传弹窗 -->
    <a-modal
      v-model:open="uploadVisible"
      title="上传文档"
      :confirm-loading="uploadLoading"
      ok-text="上传"
      cancel-text="取消"
      @ok="handleUploadSubmit"
      @cancel="handleUploadCancel"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item label="文件" required>
          <a-upload-dragger
            :before-upload="beforeUpload"
            :max-count="1"
            :show-upload-list="false"
            accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html"
          >
            <p class="upload-icon">
              <inbox-outlined />
            </p>
            <p class="upload-text">点击或拖拽文件到此区域</p>
            <p class="upload-hint">支持 PDF、TXT、MD、DOC、CSV 等格式</p>
          </a-upload-dragger>
          <p v-if="uploadFileName" class="selected-file">已选择: {{ uploadFileName }}</p>
        </a-form-item>
        <a-form-item label="分块大小">
          <a-input-number v-model:value="uploadForm.chunk_size" :min="100" :max="8000" :step="100" />
          <span class="form-hint">单个分块最大字符数</span>
        </a-form-item>
        <a-form-item label="重叠大小">
          <a-input-number v-model:value="uploadForm.chunk_overlap" :min="0" :max="500" :step="10" />
          <span class="form-hint">相邻分块重叠字符数</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 文档详情 Drawer -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="currentDoc?.filename || '文档详情'"
      width="520"
      placement="right"
    >
      <template v-if="currentDoc">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="文件名">{{ currentDoc.filename }}</a-descriptions-item>
          <a-descriptions-item label="文件类型">{{ currentDoc.file_type?.toUpperCase() }}</a-descriptions-item>
          <a-descriptions-item label="文件大小">{{ formatSize(currentDoc.file_size) }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(currentDoc.status)">{{ statusText(currentDoc.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="分块数量">{{ currentDoc.chunk_count || 0 }}</a-descriptions-item>
          <a-descriptions-item label="分块策略">{{ currentDoc.splitter_strategy || '--' }}</a-descriptions-item>
          <a-descriptions-item label="嵌入模型">{{ currentDoc.embedder_model || '--' }}</a-descriptions-item>
          <a-descriptions-item label="上传时间">{{ formatFullTime(currentDoc.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullTime(currentDoc.updated_at) }}</a-descriptions-item>
          <a-descriptions-item label="错误信息" v-if="currentDoc.error_message">
            <span class="error-text">{{ currentDoc.error_message }}</span>
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-drawer>

    <!-- 分块列表 Drawer -->
    <a-drawer
      v-model:open="chunksVisible"
      :title="`分块列表 - ${chunkDocName}`"
      width="720"
      placement="right"
    >
      <a-spin :spinning="chunksLoading">
        <div class="chunk-list">
          <div v-for="chunk in chunks" :key="chunk.index" class="chunk-item">
            <div class="chunk-header">
              <span class="chunk-index">Chunk #{{ chunk.index }}</span>
            </div>
            <pre class="chunk-content">{{ chunk.content }}</pre>
          </div>
        </div>
        <a-empty v-if="!chunksLoading && chunks.length === 0" description="暂无分块" />
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import {
  UploadOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  FileExcelOutlined,
  FileOutlined,
} from '@ant-design/icons-vue'
import { getDocumentList, uploadDocument, processDocument, deleteDocument, getChunkList } from '@/api/document'
import { getProject } from '@/api/project'
import type { DocumentItem, ChunkItem, UploadDocumentParams } from '@/api/model/documentModel'

dayjs.locale('zh-cn')
dayjs.extend(relativeTime)

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params as any).id as string)

const loading = ref(false)
const documents = ref<DocumentItem[]>([])
const filterStatus = ref('')

const columns = [
  { title: '文件名', dataIndex: 'filename', key: 'filename', ellipsis: true, width: 280 },
  { title: '类型', dataIndex: 'file_type', key: 'file_type', width: 80 },
  { title: '大小', dataIndex: 'file_size', key: 'file_size', width: 100 },
  { title: '分块数', dataIndex: 'chunk_count', key: 'chunk_count', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 130 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 180 },
]

const selectedRowKeys = ref<string[]>([])
const processingIds = ref<string[]>([])

const filteredDocuments = computed(() => {
  if (!filterStatus.value) return documents.value
  return documents.value.filter(d => d.status === filterStatus.value)
})

const paginationConfig = {
  pageSize: 10,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50'],
}

// Drawer
const drawerVisible = ref(false)
const currentDoc = ref<DocumentItem | null>(null)

// Chunks
const chunksVisible = ref(false)
const chunksLoading = ref(false)
const chunks = ref<ChunkItem[]>([])
const chunkDocName = ref('')

// Upload
const uploadVisible = ref(false)
const uploadLoading = ref(false)
const uploadFile = ref<File | null>(null)
const uploadFileName = ref('')
const uploadForm = ref({ chunk_size: 500, chunk_overlap: 50 })

function fileIcon(fileType?: string) {
  const t = (fileType || '').toLowerCase()
  if (t === 'pdf') return FilePdfOutlined
  if (['txt', 'md'].includes(t)) return FileTextOutlined
  if (['doc', 'docx'].includes(t)) return FileMarkdownOutlined
  if (['csv', 'xls', 'xlsx'].includes(t)) return FileExcelOutlined
  return FileOutlined
}

function canProcess(status: string) {
  return !['ready', 'embedding', 'chunking'].includes(status)
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getDocumentList(projectId.value)
    documents.value = res || []
  } catch {
    message.error('获取文档列表失败')
  } finally {
    loading.value = false
  }
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    ready: 'success',
    processing: 'processing',
    uploaded: 'default',
    chunking: 'processing',
    embedding: 'processing',
    error: 'error',
  }
  return map[status] || 'default'
}

function statusText(status: string) {
  const map: Record<string, string> = {
    ready: '已完成',
    processing: '处理中',
    uploaded: '已上传',
    chunking: '分块中',
    embedding: '向量化中',
    error: '失败',
  }
  return map[status] || status
}

function formatSize(bytes: number) {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(dateStr: string) {
  if (!dateStr) return '--'
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffMs = now.diff(d, 'millisecond')
  if (diffMs < 60 * 1000) return '刚刚'
  if (diffMs < 3600 * 1000) return `${Math.floor(diffMs / 60000)} 分钟前`
  if (diffMs < 24 * 3600 * 1000) return `${Math.floor(diffMs / 3600000)} 小时前`
  if (diffMs < 7 * 24 * 3600 * 1000) return `${Math.floor(diffMs / 86400000)} 天前`
  return d.format('MM-DD HH:mm')
}

function formatFullTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}

function onSelectChange(keys: any[]) {
  selectedRowKeys.value = keys as string[]
}

function onFilter() {}

function handleViewChunks(record: DocumentItem) {
  chunkDocName.value = record.filename
  chunksVisible.value = true
  fetchChunks(record.id)
}

function handleViewDetail(record: DocumentItem) {
  currentDoc.value = record
  drawerVisible.value = true
}

async function handleProcess(record: DocumentItem) {
  processingIds.value.push(record.id)
  try {
    await processDocument(record.id)
    message.success('处理成功')
    await fetchList()
  } catch {
    message.error('处理失败')
  } finally {
    processingIds.value = processingIds.value.filter(id => id !== record.id)
  }
}

function handleDelete(id: string) {
  deleteDocument(id)
    .then(() => {
      message.success('删除成功')
      fetchList()
    })
    .catch(() => {
      message.error('删除失败')
    })
}

function handleBatchProcess() {
  AModal.confirm({
    title: '批量处理',
    content: `确定要处理选中的 ${selectedRowKeys.value.length} 个文档吗？`,
    async onOk() {
      const promises = selectedRowKeys.value.map(id => processDocument(id))
      await Promise.all(promises)
      message.success('批量处理完成')
      selectedRowKeys.value = []
      await fetchList()
    },
  })
}

// Upload
function handleUploadClick() {
  uploadFile.value = null
  uploadFileName.value = ''
  uploadForm.value = { chunk_size: 500, chunk_overlap: 50 }
  uploadVisible.value = true
}

function beforeUpload(file: File) {
  uploadFile.value = file
  uploadFileName.value = file.name
  return false
}

function handleUploadCancel() {
  uploadVisible.value = false
  uploadFile.value = null
  uploadFileName.value = ''
}

async function handleUploadSubmit() {
  if (!uploadFile.value) {
    message.warning('请选择文件')
    return
  }
  uploadLoading.value = true
  try {
    const params: UploadDocumentParams = {
      project_id: projectId.value,
      file: uploadFile.value,
      chunk_size: uploadForm.value.chunk_size,
      chunk_overlap: uploadForm.value.chunk_overlap,
    }
    await uploadDocument(params)
    message.success('上传成功')
    uploadVisible.value = false
    uploadFile.value = null
    uploadFileName.value = ''
    await fetchList()
  } catch {
    message.error('上传失败')
  } finally {
    uploadLoading.value = false
  }
}

async function fetchChunks(documentId: string) {
  chunksLoading.value = true
  try {
    const res = await getChunkList(documentId)
    chunks.value = res.chunks || []
  } catch {
    message.error('获取分块列表失败')
  } finally {
    chunksLoading.value = false
  }
}

watch(() => projectId.value, () => {
  fetchList()
}, { immediate: true })
</script>

<style scoped>
/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-left {
  display: flex;
  align-items: center;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-select {
  width: 160px;
}

/* 表格卡片 */
.table-card {
  border-radius: 10px;
}
.table-card :deep(.ant-card-body) {
  padding: 0;
}
.table-card :deep(.ant-table-thead > tr > th) {
  font-weight: 500;
  color: #666;
  font-size: 13px;
}
.table-card :deep(.ant-table-tbody > tr > td) {
  padding: 12px 16px;
}
.table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: #f5f7fa;
}

/* 文件单元格 */
.file-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-icon {
  font-size: 16px;
  color: #1677ff;
  flex-shrink: 0;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 类型单元格 */
.type-cell {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
}

/* 状态标签 */
.status-tag {
  margin: 0;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
}

/* 时间单元格 */
.time-cell {
  color: #888;
  font-size: 13px;
}

/* 操作单元格 */
.action-cell {
  display: flex;
  align-items: center;
  gap: 0;
}
.action-cell .ant-btn {
  padding: 0 4px;
}

/* 上传弹窗 */
.upload-icon {
  font-size: 36px;
  color: #1677ff;
  margin-bottom: 8px;
}
.upload-text {
  font-size: 14px;
  color: #333;
}
.upload-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.selected-file {
  margin-top: 8px;
  font-size: 13px;
  color: #1677ff;
}
.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

/* 错误文本 */
.error-text {
  color: #ff4d4f;
  word-break: break-all;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 12px;
}

/* 分块列表 */
.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chunk-item {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}
.chunk-header {
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.chunk-index {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  font-family: ui-monospace, 'SF Mono', monospace;
}
.chunk-content {
  padding: 12px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
