<template>
  <div class="document-list">
    <!-- 无激活项目引导 -->
    <NoProjectPrompt v-if="!activeProjectStore.hasActiveProject" description="请先在项目页激活一个项目" />

    <template v-else>
    <!-- 工具栏 -->
    <PageToolbar>
      <template #left>
        <a-select v-model:value="filterStatus" placeholder="状态筛选" class="filter-select" @change="onFilter" allow-clear>
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="ready">已完成</a-select-option>
          <a-select-option value="processing">处理中</a-select-option>
          <a-select-option value="error">失败</a-select-option>
          <a-select-option value="uploaded">已上传</a-select-option>
          <a-select-option value="chunking">分块中</a-select-option>
          <a-select-option value="embedding">向量化中</a-select-option>
        </a-select>
      </template>
      <template #actions>
        <a-button @click="handleBatchChunk" :disabled="chunkableCount === 0 || batchChunkProcessing" :loading="batchChunkProcessing">
          <template #icon><play-circle-outlined /></template>
          批量分块 ({{ chunkableCount }})
        </a-button>
        <a-button @click="handleBatchEmbed" :disabled="embeddableCount === 0 || batchEmbedProcessing" :loading="batchEmbedProcessing">
          <template #icon><play-circle-outlined /></template>
          批量向量化 ({{ embeddableCount }})
        </a-button>
        <a-button @click="handleInheritClick">
          <template #icon><copy-outlined /></template>
          继承文档
        </a-button>
        <a-button type="primary" @click="handleUploadClick">
          <template #icon><upload-outlined /></template>
          上传文档
        </a-button>
      </template>
    </PageToolbar>

    <!-- 数据表格 -->
    <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
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
              <a-typography-text v-else type="secondary">0</a-typography-text>
            </template>

            <!-- 分块策略 -->
            <template v-if="column.key === 'splitter_strategy'">
              <a-tag>{{ strategyLabel(record.splitter_config?.strategy) }}</a-tag>
            </template>

            <!-- 黄金数据集 -->
            <template v-if="column.key === 'golden_record_count'">
              <a-typography-text v-if="record.golden_record_count > 0" :style="{ color: 'var(--ant-color-success)', fontWeight: 500 }">{{ record.golden_record_count }}</a-typography-text>
              <a-typography-text v-else type="secondary">0</a-typography-text>
            </template>

            <!-- 状态 -->
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusInfo(DOC_STATUS_MAP, record.status).color" class="status-tag">
                {{ getStatusInfo(DOC_STATUS_MAP, record.status).text }}
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
                <a-button size="small" @click="handleChunk(record)" :loading="chunkingIds.includes(record.id)" :disabled="!canChunk(record.status)">
                  分块
                </a-button>
                <a-button size="small" type="primary" @click="handleEmbed(record)" :loading="embeddingIds.includes(record.id)" :disabled="!canEmbed(record.status)">
                  向量化
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
            accept=".pdf,.txt,.md,.zip"
          >
            <p class="upload-icon">
              <inbox-outlined />
            </p>
            <p class="upload-text">点击或拖拽文件到此区域</p>
            <p class="upload-hint">支持 PDF、TXT、MD、ZIP 格式</p>
          </a-upload-dragger>
          <p v-if="uploadFileName" class="selected-file">已选择: {{ uploadFileName }}</p>
        </a-form-item>
        <a-form-item label="分块策略">
          <a-select v-model:value="uploadForm.splitter_strategy">
            <a-select-option value="section_heading">按章节标题</a-select-option>
            <a-select-option value="heading_aware">多级标题感知</a-select-option>
            <a-select-option value="fixed">固定大小</a-select-option>
            <a-select-option value="recursive">递归字符</a-select-option>
            <a-select-option value="semantic">语义分块</a-select-option>
          </a-select>
        </a-form-item>
        <template v-if="uploadForm.splitter_strategy === 'fixed' || uploadForm.splitter_strategy === 'recursive'">
          <a-form-item label="分块大小">
            <a-input-number v-model:value="uploadForm.chunk_size" :min="100" :max="8000" :step="100" />
            <span class="form-hint">单个分块最大字符数</span>
          </a-form-item>
          <a-form-item label="重叠大小">
            <a-input-number v-model:value="uploadForm.chunk_overlap" :min="0" :max="500" :step="10" />
            <span class="form-hint">相邻分块重叠字符数</span>
          </a-form-item>
        </template>
        <template v-else-if="uploadForm.splitter_strategy === 'semantic'">
          <a-form-item label="最大字符数">
            <a-input-number v-model:value="uploadForm.splitter_max_chars" :min="200" :max="8000" :step="100" />
            <span class="form-hint">单个分块最大字符数</span>
          </a-form-item>
          <a-typography-text type="secondary" style="display: block; margin-top: 8px; padding-left: 25%">
            语义分块会根据句子间的语义相似度自动切分，相似度低于阈值时切分
          </a-typography-text>
        </template>
        <template v-else>
          <a-form-item label="最小字符数">
            <a-input-number v-model:value="uploadForm.splitter_min_chars" :min="50" :max="4000" :step="50" />
            <span class="form-hint">分块最小字符数</span>
          </a-form-item>
          <a-form-item label="最大字符数">
            <a-input-number v-model:value="uploadForm.splitter_max_chars" :min="200" :max="8000" :step="100" />
            <span class="form-hint">分块最大字符数</span>
          </a-form-item>
        </template>
      </a-form>
    </a-modal>

    <!-- 继承文档弹窗 -->
    <a-modal
      v-model:open="inheritVisible"
      title="继承文档"
      :confirm-loading="inheritLoading"
      ok-text="确认继承"
      cancel-text="取消"
      @ok="handleInheritSubmit"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" style="margin-top: 16px">
        <a-form-item label="源项目" required>
          <a-select v-model:value="inheritSourceProjectId" placeholder="选择要继承文档的项目" :loading="projectsLoading">
            <a-select-option v-for="p in projectList" :key="p.id" :value="p.id">{{ p.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-typography-text type="secondary" style="display: block; margin-top: 8px; padding-left: 25%">
          将继承源项目的全部文档，已存在的文档会自动跳过。继承后需重新执行分块和向量化。
        </a-typography-text>
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
            <a-tag :color="getStatusInfo(DOC_STATUS_MAP, currentDoc.status).color">{{ getStatusInfo(DOC_STATUS_MAP, currentDoc.status).text }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="分块数量">{{ currentDoc.chunk_count || 0 }}</a-descriptions-item>
          <a-descriptions-item label="分块策略">{{ currentDoc.splitter_config?.strategy || '--' }}</a-descriptions-item>
          <a-descriptions-item label="嵌入模型">{{ activeProjectStore.activeProject?.embed_model_name || '--' }}</a-descriptions-item>
          <a-descriptions-item label="上传时间">{{ formatFullTime(currentDoc.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullTime(currentDoc.updated_at) }}</a-descriptions-item>
          <a-descriptions-item label="错误信息" v-if="currentDoc.error_message">
            <a-typography-text type="danger" :style="{ fontFamily: 'var(--ant-font-family-code)', fontSize: '12px', wordBreak: 'break-all' }">{{ currentDoc.error_message }}</a-typography-text>
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
      @close="chunkDetailVisible = false"
    >
      <SplitPanelLayout left-title="源文档" right-title="分块列表">
        <template #left>
          <a-spin :spinning="sourceLoading">
            <div v-if="sourceContent" class="source-content" ref="sourceRef" @scroll="onSourceScroll">
              <MarkdownRenderer :content="sourceContent" :file-type="chunkDocFileType" full-height />
            </div>
            <a-empty v-else-if="!sourceLoading" :description="sourceError || '加载源文件失败'" />
          </a-spin>
        </template>
        <template #right>
          <a-spin :spinning="chunksLoading">
            <div class="chunk-list" ref="chunkListRef" @scroll="onChunkListScroll">
              <ChunkCard
                v-for="chunk in chunks"
                :key="chunk.index"
                :content="chunk.content"
                :file-type="chunk.file_type"
                :even="chunk.index % 2 === 0"
                clickable
                @click="handleChunkClick(chunk)"
              />
            </div>
            <a-empty v-if="!chunksLoading && chunks.length === 0" description="暂无分块" />
          </a-spin>
        </template>
      </SplitPanelLayout>
    </a-drawer>

    <!-- 分块详情弹窗 -->
    <a-modal
      v-model:open="chunkDetailVisible"
      :title="`分块 #${activeChunkIndex}`"
      width="50%"
      :footer="null"
    >
      <div class="chunk-modal-body">
        <!-- 向量信息 & 黄金记录 -->
        <a-tabs v-model:activeKey="chunkDetailTab" class="chunk-detail-tabs">
          <a-tab-pane key="embedding" tab="向量信息">
            <EmbeddingViewer :project-id="projectId" :chunk-id="activeChunkId" :visible="chunkDetailVisible && chunkDetailTab === 'embedding'" />
          </a-tab-pane>
          <a-tab-pane key="golden" tab="关联黄金记录">
            <a-spin :spinning="goldenRecordsLoading">
              <div v-if="chunkGoldenRecords.length" class="golden-records-list">
                <div v-for="record in chunkGoldenRecords" :key="record.id" class="golden-record-item">
                  <div class="golden-record-header">
                    <span class="golden-record-query">{{ record.query }}</span>
                    <a-tag :color="record.status === 'approved' ? 'green' : record.status === 'pending_review' ? 'orange' : 'red'" size="small">
                      {{ record.status === 'approved' ? '已通过' : record.status === 'pending_review' ? '待审核' : '已拒绝' }}
                    </a-tag>
                  </div>
                  <div class="golden-record-meta">
                    <a-tag v-if="record.metadata?.type" size="small">{{ record.metadata.type }}</a-tag>
                    <span v-if="record.metadata?.quality_score" class="golden-record-score">质量: {{ record.metadata.quality_score }}</span>
                  </div>
                  <div v-if="record.reference_answer" class="golden-record-answer">{{ record.reference_answer }}</div>
                </div>
              </div>
              <a-empty v-else-if="!goldenRecordsLoading" description="该分块暂无关联的黄金记录" />
            </a-spin>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { formatTime, formatFullTime } from '@/utils/time'
import { usePagination } from '@/composables/usePagination'
import { useBatchProcess } from '@/composables/useBatchProcess'
import { getStatusInfo, DOC_STATUS_MAP } from '@/utils/status'
import {
  UploadOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  CopyOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  FileExcelOutlined,
  FileOutlined,
  FileZipOutlined,
} from '@ant-design/icons-vue'
import { getDocumentList, uploadDocument, chunkDocument, embedDocument, deleteDocument, getChunkList, getSourceContent, batchChunkDocuments, batchEmbedDocuments, inheritDocuments } from '@/api/document'
import { getChunkGoldenRecords } from '@/api/chunk'
import { getProjectList } from '@/api/project'
import type { DocumentItem, ChunkItem, UploadDocumentParams } from '@/api/model/documentModel'
import type { GoldenItem } from '@/api/model/goldenModel'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import ChunkCard from '@/components/ChunkCard.vue'
import EmbeddingViewer from '@/components/EmbeddingViewer.vue'
import NoProjectPrompt from '@/components/NoProjectPrompt.vue'
import PageToolbar from '@/components/PageToolbar.vue'
import SplitPanelLayout from '@/components/SplitPanelLayout.vue'

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
  { title: '分块策略', dataIndex: 'splitter_strategy', key: 'splitter_strategy', width: 110 },
  { title: '黄金数据集', dataIndex: 'golden_record_count', key: 'golden_record_count', width: 110 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 130 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 240 },
]

const selectedRowKeys = ref<string[]>([])
const chunkingIds = ref<string[]>([])
const embeddingIds = ref<string[]>([])

const chunkableCount = computed(() =>
  selectedRowKeys.value.filter(id => {
    const doc = documents.value.find(d => d.id === id)
    return doc ? canChunk(doc.status) : false
  }).length
)

const embeddableCount = computed(() =>
  selectedRowKeys.value.filter(id => {
    const doc = documents.value.find(d => d.id === id)
    return doc ? canEmbed(doc.status) : false
  }).length
)

const { batchProcessing: batchChunkProcessing, handleBatchProcess: handleBatchChunk } = useBatchProcess({
  selectedRowKeys: () => selectedRowKeys.value,
  canProcess: (id) => {
    const doc = documents.value.find(d => d.id === id)
    return doc ? canChunk(doc.status) : false
  },
  action: (id) => chunkDocument(projectId.value, id),
  skipLabel: '已分块',
  onBatchComplete: (results) => {
    for (const r of results) {
      const doc = documents.value.find(d => d.id === r.id)
      if (doc) {
        doc.status = r.status
        doc.chunk_count = r.chunk_count
        doc.error_message = r.error_message
      }
    }
  },
})

const { batchProcessing: batchEmbedProcessing, handleBatchProcess: handleBatchEmbed } = useBatchProcess({
  selectedRowKeys: () => selectedRowKeys.value,
  canProcess: (id) => {
    const doc = documents.value.find(d => d.id === id)
    return doc ? canEmbed(doc.status) : false
  },
  action: (id) => embedDocument(projectId.value, id),
  skipLabel: '未分块/已向量化',
  onBatchComplete: (results) => {
    for (const r of results) {
      const doc = documents.value.find(d => d.id === r.id)
      if (doc) {
        doc.status = r.status
        doc.chunk_count = r.chunk_count
        doc.error_message = r.error_message
      }
    }
  },
})

const filteredDocuments = computed(() => {
  if (!filterStatus.value) return documents.value
  return documents.value.filter(d => d.status === filterStatus.value)
})

const paginationConfig = usePagination()

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
const sourceError = ref('')
const sourceLoading = ref(false)
const sourceContent = ref('')

// Embedding 详情（合并到 Drawer 右侧面板）
const chunkDetailVisible = ref(false)
const activeChunkId = ref('')
const activeChunkIndex = ref(0)
const activeChunkContent = ref('')
const activeChunkFileType = ref('')
const chunkDetailTab = ref('embedding')
const chunkGoldenRecords = ref<GoldenItem[]>([])
const goldenRecordsLoading = ref(false)

async function handleChunkClick(chunk: ChunkItem) {
  activeChunkId.value = chunk.id
  activeChunkIndex.value = chunk.index
  activeChunkContent.value = chunk.content
  activeChunkFileType.value = chunk.file_type
  chunkDetailTab.value = 'embedding'
  chunkDetailVisible.value = true
  goldenRecordsLoading.value = true
  try {
    const records = await getChunkGoldenRecords(projectId.value, chunk.id)
    chunkGoldenRecords.value = records || []
  } catch {
    chunkGoldenRecords.value = []
  } finally {
    goldenRecordsLoading.value = false
  }
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
const uploadForm = ref({ splitter_strategy: 'section_heading', chunk_size: 500, chunk_overlap: 50, splitter_min_chars: 200, splitter_max_chars: 2000 })

// Inherit
const inheritVisible = ref(false)
const inheritLoading = ref(false)
const inheritSourceProjectId = ref('')
const projectsLoading = ref(false)
const projectList = ref<{ id: string; name: string }[]>([])

function fileIcon(fileType?: string) {
  const t = (fileType || '').toLowerCase()
  if (t === 'pdf') return FilePdfOutlined
  if (['txt', 'md'].includes(t)) return FileTextOutlined
  if (t === 'zip') return FileZipOutlined
  return FileOutlined
}

function fileTypeColor(fileType?: string) {
  const t = (fileType || '').toLowerCase()
  if (t === 'pdf') return 'red'
  if (['txt', 'md'].includes(t)) return 'blue'
  if (t === 'zip') return 'orange'
  return 'default'
}

async function fetchList() {
  if (!projectId.value) return
  loading.value = true
  try {
    const res = await getDocumentList(projectId.value)
    documents.value = res?.documents ?? []
  } catch {
    message.error('获取文档列表失败')
  } finally {
    loading.value = false
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

function canChunk(status: string): boolean {
  return ['uploaded', 'error'].includes(status)
}

const STRATEGY_LABELS: Record<string, string> = {
  section_heading: '章节标题',
  heading_aware: '多级标题感知',
  fixed: '固定大小',
  recursive: '递归字符',
  semantic: '语义分块',
}

function strategyLabel(strategy?: string): string {
  return STRATEGY_LABELS[strategy || 'section_heading'] || strategy || '-'
}

function canEmbed(status: string): boolean {
  return ['chunked'].includes(status)
}

async function handleChunk(record: DocumentItem) {
  if (!canChunk(record.status)) {
    message.info('文档已分块，无需重复操作')
    return
  }
  chunkingIds.value.push(record.id)
  try {
    await chunkDocument(projectId.value, record.id)
    message.success('分块成功')
    await fetchList()
  } catch {
    message.error('分块失败')
  } finally {
    chunkingIds.value = chunkingIds.value.filter(id => id !== record.id)
  }
}

async function handleEmbed(record: DocumentItem) {
  if (!canEmbed(record.status)) {
    if (['uploaded', 'chunking'].includes(record.status)) {
      message.info('文档尚未分块，请先执行分块')
    } else {
      message.info('文档已向量化，无需重复操作')
    }
    return
  }
  embeddingIds.value.push(record.id)
  try {
    await embedDocument(projectId.value, record.id)
    message.success('向量化成功')
    await fetchList()
  } catch {
    message.error('向量化失败')
  } finally {
    embeddingIds.value = embeddingIds.value.filter(id => id !== record.id)
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

// Upload
function handleUploadClick() {
  uploadFile.value = null
  uploadFileName.value = ''
  uploadForm.value = { splitter_strategy: 'section_heading', chunk_size: 500, chunk_overlap: 50, splitter_min_chars: 200, splitter_max_chars: 2000 }
  uploadVisible.value = true
}

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.zip']

function beforeUpload(file: File) {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    message.error(`不支持的文件类型: ${ext}，仅支持 ${ALLOWED_EXTENSIONS.join(', ')}`)
    return false
  }
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
      splitter_strategy: uploadForm.value.splitter_strategy,
      chunk_size: uploadForm.value.chunk_size,
      chunk_overlap: uploadForm.value.chunk_overlap,
      splitter_min_chars: uploadForm.value.splitter_min_chars,
      splitter_max_chars: uploadForm.value.splitter_max_chars,
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

// Inherit
async function handleInheritClick() {
  inheritSourceProjectId.value = ''
  inheritVisible.value = true
  projectsLoading.value = true
  try {
    const res = await getProjectList()
    projectList.value = (res || []).filter((p: any) => p.id !== projectId.value)
  } catch {
    message.error('获取项目列表失败')
  } finally {
    projectsLoading.value = false
  }
}

async function handleInheritSubmit() {
  if (!inheritSourceProjectId.value) {
    message.warning('请选择源项目')
    return
  }
  inheritLoading.value = true
  try {
    const res = await inheritDocuments(projectId.value, inheritSourceProjectId.value)
    const { inherited_count, skipped_count } = res
    if (inherited_count === 0 && skipped_count === 0) {
      message.info('源项目无文档可继承')
    } else {
      message.success(`继承完成：成功 ${inherited_count} 个，跳过 ${skipped_count} 个`)
    }
    inheritVisible.value = false
    await fetchList()
  } catch {
    message.error('继承文档失败')
  } finally {
    inheritLoading.value = false
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
  sourceError.value = ''
  try {
    const res = await getSourceContent(projectId.value, documentId)
    sourceContent.value = res.content || ''
  } catch (err: any) {
    const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || ''
    if (detail.includes('PDF')) {
      sourceError.value = 'PDF 文件不支持源文件预览'
    } else if (detail.includes('源文件不存在')) {
      sourceError.value = '源文件不存在，可能已被清理'
    } else {
      sourceError.value = detail || '加载源文件失败'
    }
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
@import '@/styles/common-table.css';

.filter-select {
  width: 160px;
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
  color: var(--ant-color-primary);
  flex-shrink: 0;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态标签 */
.status-tag {
  margin: 0;
  padding: 2px 8px;
  font-size: var(--ant-font-size-sm);
  border-radius: var(--ant-border-radius-sm);
}

/* 上传弹窗 */
.upload-icon {
  font-size: 36px;
  color: var(--ant-color-primary);
  margin-bottom: 8px;
}
.upload-text {
  font-size: 14px;
  color: var(--ant-color-text);
}
.upload-hint {
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
  margin-top: 4px;
}
.selected-file {
  margin-top: 8px;
  font-size: 13px;
  color: var(--ant-color-primary);
}

/* 源文档内容 */
.source-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
}

/* 分块列表 */
.chunk-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 黄金记录列表 */
.golden-record-item {
  padding: 10px 12px;
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
  margin-bottom: 8px;
}
.golden-record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.golden-record-query {
  font-weight: 500;
  font-size: 13px;
  color: var(--ant-color-text);
}
.golden-record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.golden-record-score {
  font-size: 11px;
  color: var(--ant-color-text-tertiary);
}
.golden-record-answer {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 分块详情弹窗 */
.chunk-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
}
.chunk-detail-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
  padding: 0 12px;
}
.chunk-detail-tabs :deep(.ant-tabs-content-holder) {
  padding: 12px;
}
</style>
