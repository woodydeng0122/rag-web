<template>
  <div class="document-list">
    <!-- 无激活项目引导 -->
    <a-empty v-if="!activeProjectStore.hasActiveProject" description="请先在项目页激活一个项目">
      <a-button type="primary" @click="router.push('/projects')">前往项目页</a-button>
    </a-empty>

    <template v-else>
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
              <a-tag :color="fileTypeColor(record.file_type)">{{ record.file_type?.toUpperCase() }}</a-tag>
            </template>

            <!-- 分块数 -->
            <template v-if="column.key === 'chunk_count'">
              <a-button v-if="record.chunk_count > 0" type="link" size="small" @click="handleViewChunks(record)">
                {{ record.chunk_count }}
              </a-button>
              <span v-else class="chunk-count-zero">0</span>
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
                <a-button size="small" type="primary" @click="handleProcess(record)" :loading="processingIds.includes(record.id)" :disabled="!canProcess(record.status)">
                  处理
                </a-button>
                <a-button size="small" @click="handleViewDetail(record)">
                  详情
                </a-button>
                <a-popconfirm title="确定删除此文档？此操作不可恢复" @confirm="handleDelete(record.id)">
                  <a-button size="small" danger>删除</a-button>
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
          <a-descriptions-item label="嵌入模型">{{ activeProjectStore.activeProject?.embed_model_name || '--' }}</a-descriptions-item>
          <a-descriptions-item label="上传时间">{{ formatFullTime(currentDoc.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullTime(currentDoc.updated_at) }}</a-descriptions-item>
          <a-descriptions-item label="错误信息" v-if="currentDoc.error_message">
            <span class="error-text">{{ currentDoc.error_message }}</span>
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-drawer>

    <!-- 分块详情 Drawer -->
    <a-drawer
      v-model:open="chunksVisible"
      :title="`分块详情 - ${chunkDocName}`"
      width="80%"
      placement="right"
    >
      <div class="chunk-detail-layout">
        <!-- 左侧：源文档 -->
        <div class="chunk-detail-left">
          <div class="panel-title">源文档</div>
          <a-spin :spinning="sourceLoading">
            <div v-if="sourceContent" class="source-content" ref="sourceRef" @scroll="onSourceScroll">
              <MarkdownRenderer :content="sourceContent" :file-type="chunkDocFileType" full-height />
            </div>
            <a-empty v-else-if="!sourceLoading" description="PDF 文件不支持源文件预览" />
          </a-spin>
        </div>

        <!-- 右侧：分块列表 -->
        <div class="chunk-detail-right">
          <div class="panel-title">分块列表 ({{ chunks.length }})</div>
          <a-spin :spinning="chunksLoading">
            <div class="chunk-list" ref="chunkListRef" @scroll="onChunkListScroll">
              <div v-for="chunk in chunks" :key="chunk.index" class="chunk-item" :class="chunk.index % 2 === 0 ? 'chunk-item--even' : 'chunk-item--odd'" @click="handleChunkClick(chunk)">
                <MarkdownRenderer :content="chunk.content" :file-type="chunk.file_type" />
              </div>
            </div>
            <a-empty v-if="!chunksLoading && chunks.length === 0" description="暂无分块" />
          </a-spin>
        </div>
      </div>
    </a-drawer>
    <!-- Embedding 弹窗 -->
    <EmbeddingViewer :project-id="projectId" :chunk-id="activeChunkId" v-model:visible="embeddingVisible" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
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
import { getDocumentList, uploadDocument, processDocument, deleteDocument, getChunkList, getSourceContent } from '@/api/document'
import type { DocumentItem, ChunkItem, UploadDocumentParams } from '@/api/model/documentModel'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import EmbeddingViewer from '@/components/EmbeddingViewer.vue'

dayjs.locale('zh-cn')
dayjs.extend(relativeTime)

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const projectId = computed(() => activeProjectStore.activeProjectId)

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

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50'],
  onChange: (page: number) => {
    paginationConfig.current = page
  },
  onShowSizeChange: (_current: number, size: number) => {
    paginationConfig.pageSize = size
    paginationConfig.current = 1
  },
})

// Drawer
const drawerVisible = ref(false)
const currentDoc = ref<DocumentItem | null>(null)

// Chunks
const chunksVisible = ref(false)
const chunksLoading = ref(false)
const chunks = ref<ChunkItem[]>([])
const chunkDocName = ref('')
const chunkDocFileType = ref('')

// Source
const sourceLoading = ref(false)
const sourceContent = ref('')

// Embedding 弹窗
const embeddingVisible = ref(false)
const activeChunkId = ref('')

function handleChunkClick(chunk: ChunkItem) {
  activeChunkId.value = chunk.id
  embeddingVisible.value = true
}

// 联动滚动
const sourceRef = ref<HTMLElement | null>(null)
const chunkListRef = ref<HTMLElement | null>(null)
let isSyncingScroll = false

function onSourceScroll() {
  if (isSyncingScroll) return
  const source = sourceRef.value
  const target = chunkListRef.value
  if (!source || !target) return

  const sourceMax = source.scrollHeight - source.clientHeight
  if (sourceMax <= 0) return

  isSyncingScroll = true
  const percent = source.scrollTop / sourceMax
  const targetMax = target.scrollHeight - target.clientHeight
  target.scrollTop = percent * targetMax
  requestAnimationFrame(() => { isSyncingScroll = false })
}

function onChunkListScroll() {
  if (isSyncingScroll) return
  const source = sourceRef.value
  const target = chunkListRef.value
  if (!source || !target) return

  const targetMax = target.scrollHeight - target.clientHeight
  if (targetMax <= 0) return

  isSyncingScroll = true
  const percent = target.scrollTop / targetMax
  const sourceMax = source.scrollHeight - source.clientHeight
  source.scrollTop = percent * sourceMax
  requestAnimationFrame(() => { isSyncingScroll = false })
}

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

function fileTypeColor(fileType?: string) {
  const t = (fileType || '').toLowerCase()
  if (t === 'pdf') return 'red'
  if (['txt', 'md'].includes(t)) return 'blue'
  if (['doc', 'docx'].includes(t)) return 'cyan'
  if (['csv', 'xls', 'xlsx'].includes(t)) return 'green'
  return 'default'
}

function canProcess(status: string) {
  return !['ready', 'embedding', 'chunking'].includes(status)
}

async function fetchList() {
  if (!projectId.value) return
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
  chunkDocFileType.value = record.file_type
  chunksVisible.value = true
  fetchChunks(record.id)
  fetchSource(record.id)
}

function handleViewDetail(record: DocumentItem) {
  currentDoc.value = record
  drawerVisible.value = true
}

async function handleProcess(record: DocumentItem) {
  processingIds.value.push(record.id)
  try {
    await processDocument(projectId.value, record.id)
    message.success('处理成功')
    await fetchList()
  } catch {
    message.error('处理失败')
  } finally {
    processingIds.value = processingIds.value.filter(id => id !== record.id)
  }
}

function handleDelete(id: string) {
  deleteDocument(projectId.value, id)
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
      const promises = selectedRowKeys.value.map(id => processDocument(projectId.value, id))
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
    const res = await getChunkList(projectId.value, documentId)
    chunks.value = res.chunks || []
  } catch {
    message.error('获取分块列表失败')
  } finally {
    chunksLoading.value = false
  }
}

async function fetchSource(documentId: string) {
  sourceLoading.value = true
  sourceContent.value = ''
  try {
    const res = await getSourceContent(projectId.value, documentId)
    sourceContent.value = res.content || ''
  } catch {
    // PDF 等不支持预览的文件类型，静默处理
  } finally {
    sourceLoading.value = false
  }
}

watch(() => projectId.value, () => {
  if (projectId.value) fetchList()
}, { immediate: true })

watch(() => pageStore.refreshTrigger, fetchList)
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
.table-card :deep(.ant-pagination) {
  margin-right: 16px;
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
  gap: 6px;
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

/* 分块数 */
.chunk-count-zero {
  color: #bbb;
  font-size: 13px;
}

/* 分块详情布局 */
.chunk-detail-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 120px);
}
.chunk-detail-left {
  flex: 1;
  min-width: 0;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.chunk-detail-right {
  flex: 1;
  min-width: 0;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-title {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #1677ff;
  flex-shrink: 0;
}
.chunk-detail-left .panel-title {
  background: #1677ff;
}
.chunk-detail-right .panel-title {
  background: #52c41a;
}
.source-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}
.chunk-detail-left :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chunk-detail-left :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chunk-detail-right :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chunk-detail-right :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chunk-detail-right .chunk-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 分块列表 */
.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chunk-item {
  border-radius: 6px;
  flex-shrink: 0;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
  padding: 12px;
}
.chunk-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}
.chunk-item--even {
  background: #fff1f0;
}
.chunk-item--odd {
  background: #f6ffed;
}
</style>
