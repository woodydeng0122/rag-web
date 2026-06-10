<template>
  <div class="golden">
    <!-- 未选择项目 -->
    <NoProjectPrompt v-if="!activeProjectStore.hasActiveProject" description="请先选择一个项目" button-text="前往项目列表" />

    <!-- 已选择项目 -->
<template v-else>
  <!-- 工具栏 -->
  <PageToolbar>
    <template #left>
      <a-select v-model:value="retrievalFilter" placeholder="检索情况" class="status-filter" allow-clear @change="fetchList()">
        <a-select-option value="">全部</a-select-option>
        <a-select-option value="hit">命中</a-select-option>
        <a-select-option value="miss">未命中</a-select-option>
        <a-select-option value="unretrieved">未检索</a-select-option>
      </a-select>
      <a-input-search v-model:value="searchQuery" placeholder="搜索查询文本..." class="search-input" allow-clear @search="onSearch" />
    </template>
    <template #actions>
      <a-button danger :disabled="selectedRowKeys.length === 0" @click="handleBatchDelete">
        <template #icon><delete-outlined /></template>
        批量删除 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button :disabled="selectedRowKeys.length === 0" :loading="batchRetrieving" @click="handleBatchRetrieve">
        <template #icon><search-outlined /></template>
        批量检索 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button @click="importModalVisible = true">
        <template #icon><upload-outlined /></template>
        上传
      </a-button>
      <a-button type="primary" @click="handleCreate">
        <template #icon><plus-outlined /></template>
        新增
      </a-button>
    </template>
  </PageToolbar>

  <!-- 数据表格 -->
  <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
    <a-spin :spinning="loading">
      <a-table
        :columns="columns"
        :data-source="filteredList"
        row-key="id"
        :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
        :pagination="paginationConfig"
        size="middle"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <!-- 查询文本 -->
          <template v-if="column.key === 'query'">
            <span class="query-cell" :title="record.query">{{ record.query }}</span>
          </template>

          <!-- 关联分块 -->
          <template v-if="column.key === 'chunk_count'">
            <a-tag color="blue">{{ record.ground_truth_chunks?.length || 0 }} 个分块</a-tag>
          </template>

          <!-- 参考答案 -->
          <template v-if="column.key === 'reference_answer'">
            <span class="answer-cell" :title="record.reference_answer">
              {{ record.reference_answer ? (record.reference_answer.length > 40 ? record.reference_answer.slice(0, 40) + '...' : record.reference_answer) : '--' }}
            </span>
          </template>

          <!-- 创建时间 -->
          <template v-if="column.key === 'created_at'">
            <span class="time-cell">{{ formatTime(record.created_at) }}</span>
          </template>

          <!-- 检索 -->
          <template v-if="column.key === 'retrieval'">
            <template v-if="record.retrieval_summary">
              <a-tag
                v-if="record.retrieval_summary.hit_count > 0"
                color="success"
                style="cursor: pointer"
                @click="openRetrievalDrawer(record)"
              >
                命中({{ record.retrieval_summary.hit_count }}/{{ record.retrieval_summary.gt_total }})
              </a-tag>
              <a-tag
                v-else
                color="error"
                style="cursor: pointer"
                @click="openRetrievalDrawer(record)"
              >
                未命中
              </a-tag>
            </template>
            <a-button v-else size="small" type="link" @click="openRetrievalDrawer(record)">检索</a-button>
          </template>

          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <div class="action-cell">
              <a-button size="small" @click="openDetailDrawer(record)">详情</a-button>
              <a-button size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm title="确定删除此记录？" @confirm="handleDelete(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </a-spin>
  </a-card>
</template>

<!-- 新增/编辑弹窗 -->
<a-modal
  v-model:open="modalVisible"
  :title="isEdit ? '编辑黄金记录' : '新增黄金记录'"
  :confirm-loading="submitLoading"
  width="50%"
  ok-text="确认"
  cancel-text="取消"
  @ok="handleFormSubmit"
  @cancel="modalVisible = false"
>
  <a-form :model="formState" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="padding-top: 16px">
    <a-form-item label="查询文本" required>
      <a-textarea v-model:value="formState.query" placeholder="请输入查询文本" :rows="2" :maxlength="1000" show-count />
    </a-form-item>
    <a-form-item label="关联分块" required>
      <div class="chunk-selector">
        <a-input-search
          v-model:value="chunkSearchQuery"
          placeholder="搜索分块内容..."
          size="small"
          allow-clear
          @search="onChunkSearch"
          style="margin-bottom: 8px"
        />
        <a-spin :spinning="chunksLoading">
          <div class="chunk-list">
            <a-checkbox-group v-model:value="formState.ground_truth_chunks" style="width: 100%">
              <div v-for="chunk in chunkOptions" :key="chunk.id" class="chunk-option">
                <a-checkbox :value="chunk.id">
                  <span class="chunk-heading" v-if="chunk.heading">{{ chunk.heading }} — </span>
                  <span class="chunk-content">{{ chunk.content }}</span>
                </a-checkbox>
              </div>
            </a-checkbox-group>
            <div v-if="hasMoreChunks" class="load-more" @click="loadMoreChunks">加载更多...</div>
            <a-empty v-if="!chunksLoading && chunkOptions.length === 0" description="暂无分块" :image="null" />
          </div>
        </a-spin>
      </div>
      <div v-if="formState.ground_truth_chunks.length > 0" class="selected-info">已选 {{ formState.ground_truth_chunks.length }} 个分块</div>
    </a-form-item>
    <a-form-item label="参考答案">
      <a-textarea v-model:value="formState.reference_answer" placeholder="请输入参考答案（选填）" :rows="3" :maxlength="2000" show-count />
    </a-form-item>
  </a-form>
</a-modal>

<!-- 上传弹窗 -->
<a-modal
  v-model:open="importModalVisible"
  title="导入黄金数据集"
  :footer="null"
  :width="520"
  @cancel="importModalVisible = false"
>
  <div class="import-modal-content">
    <a-upload-dragger
      :before-upload="beforeUpload"
      :show-upload-list="false"
      accept=".jsonl,.csv"
      :disabled="importing"
      multiple
    >
      <p class="ant-upload-drag-icon"><upload-outlined style="font-size: 36px; color: var(--ant-color-primary)" /></p>
      <p class="ant-upload-text">拖拽或点击上传文件</p>
      <p class="ant-upload-hint">支持 .jsonl / .csv 格式，可多选文件，单文件最多 1000 条</p>
    </a-upload-dragger>

    <div v-if="importFiles.length > 0" class="import-file-list">
      <div v-for="(file, index) in importFiles" :key="index" class="import-file-item">
        <a-tag color="blue">{{ file.name }}</a-tag>
        <a-button type="link" size="small" :disabled="importing" @click="removeImportFile(index)">移除</a-button>
      </div>
    </div>

    <div class="import-templates">
      <span class="template-label">下载模板：</span>
      <a @click="downloadTemplate('jsonl')">JSONL 模板</a>
      <a-divider type="vertical" />
      <a @click="downloadTemplate('csv')">CSV 模板</a>
    </div>

    <div class="import-actions">
      <a-button :disabled="importFiles.length === 0" :loading="importing" type="primary" @click="handleImport">
        确认导入 ({{ importFiles.length }} 个文件)
      </a-button>
    </div>

    <!-- 导入进度 -->
    <div v-if="importing" class="import-progress">
      <a-spin size="small" />
      <span style="margin-left: 8px">正在导入第 {{ importCurrentIndex + 1 }} / {{ importFiles.length }} 个文件...</span>
    </div>

    <!-- 导入结果 -->
    <div v-if="importResults.length > 0" class="import-result">
      <div v-for="result in importResults" :key="result.filename" class="import-result-item">
        <a-alert
          :type="result.success_count > 0 ? (result.skipped_count > 0 ? 'warning' : 'success') : 'error'"
          show-icon
          :message="`${result.filename}：成功 ${result.success_count} 条${result.skipped_count > 0 ? '，跳过 ' + result.skipped_count + ' 条' : ''}`"
        />
        <div v-if="result.skipped.length > 0" class="skipped-list">
          <div v-for="s in result.skipped" :key="s.row" class="skipped-item">
            第 {{ s.row }} 行：{{ s.reason }}
          </div>
        </div>
      </div>
    </div>
  </div>
</a-modal>

<!-- 详情 Drawer -->
<a-drawer
  v-model:open="detailDrawerVisible"
  :title="detailRecord?.query || '详情'"
  width="50%"
  placement="right"
>
  <template v-if="detailRecord">
    <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item label="查询文本">{{ detailRecord.query }}</a-descriptions-item>
      <a-descriptions-item label="关联分块">
        <div v-if="detailRecord.ground_truth_chunks?.length">
          <a-tag v-for="chunkId in detailRecord.ground_truth_chunks" :key="chunkId" style="margin-bottom: 4px">{{ chunkId }}</a-tag>
        </div>
        <span v-else>--</span>
      </a-descriptions-item>
      <a-descriptions-item label="参考答案">
        <div class="detail-answer">{{ detailRecord.reference_answer || '--' }}</div>
      </a-descriptions-item>
      <a-descriptions-item label="创建时间">{{ detailRecord.created_at }}</a-descriptions-item>
      <a-descriptions-item v-if="detailRecord.metadata && Object.keys(detailRecord.metadata).length" label="元数据">
        <pre class="detail-metadata">{{ JSON.stringify(detailRecord.metadata, null, 2) }}</pre>
      </a-descriptions-item>
    </a-descriptions>

    <div class="detail-actions">
      <a-button @click="handleEdit(detailRecord); detailDrawerVisible = false">编辑</a-button>
    </div>
  </template>
</a-drawer>

<!-- 检索 Drawer -->
<a-drawer
  v-model:open="retrievalDrawerVisible"
  title="检索验证"
  width="80%"
  placement="right"
>
  <template v-if="retrievalRecord">
    <SplitPanelLayout left-title="查询 & Ground Truth" right-title="检索结果">
      <template #left>
        <div class="retrieval-query-section">
          <div class="retrieval-query-label">查询文本</div>
          <div class="retrieval-query-text">{{ retrievalRecord.query }}</div>
        </div>
        <div class="retrieval-gt-section">
          <div class="retrieval-gt-label">Ground Truth ({{ retrievalRecord.ground_truth_chunks?.length || 0 }} 个分块)</div>
          <a-spin :spinning="gtChunksLoading">
            <div class="retrieval-gt-list">
              <div v-for="(chunk, idx) in gtChunks" :key="chunk.id" class="retrieval-gt-item" :class="idx % 2 === 0 ? 'retrieval-gt-item--even' : 'retrieval-gt-item--odd'">
                <div class="retrieval-gt-item-header">
                  <span class="retrieval-gt-index">#{{ chunk.index + 1 }}</span>
                  <span v-if="chunk.heading" class="retrieval-gt-item-heading">{{ chunk.heading }}</span>
                </div>
                <MarkdownRenderer :content="chunk.content" :file-type="chunk.file_type" />
              </div>
              <a-empty v-if="!gtChunksLoading && gtChunks.length === 0" description="无关联分块" :image="null" />
            </div>
          </a-spin>
        </div>
      </template>
      <template #right>
        <div v-if="!retrievalResult" class="retrieval-params">
          <div class="retrieval-param-row">
            <span class="retrieval-param-label">max_k</span>
            <a-input-number v-model:value="retrievalMaxK" :min="1" :max="100" style="width: 120px" />
          </div>
          <a-button type="primary" :loading="retrievalLoading" @click="handleRetrieve">确认检索</a-button>
        </div>
        <div v-if="retrievalLoading" class="retrieval-loading">
          <a-spin />
          <span>正在检索...</span>
        </div>
        <template v-if="retrievalResult">
          <div class="retrieval-metrics">
            <a-tag>模型: {{ retrievalResult.embed_model_name || '--' }}</a-tag>
            <a-tag>总耗时: {{ retrievalResult.latency_ms }}ms</a-tag>
            <a-tag>嵌入: {{ retrievalResult.embed_latency_ms }}ms</a-tag>
            <a-tag>检索: {{ retrievalResult.search_latency_ms }}ms</a-tag>
            <a-tag>max_k: {{ retrievalResult.max_k }}</a-tag>
            <a-tag color="green">命中GT: {{ retrievalResult.items.filter(i => i.is_ground_truth).length }}/{{ retrievalRecord.ground_truth_chunks?.length || 0 }}</a-tag>
          </div>
          <div class="retrieval-items">
            <div v-for="(item, idx) in retrievalResult.items" :key="item.chunk_id" class="retrieval-item" :class="[idx % 2 === 0 ? 'retrieval-item--even' : 'retrieval-item--odd', { 'retrieval-item-hit': item.is_ground_truth }]">
              <div class="retrieval-item-header">
                <span class="retrieval-item-rank">#{{ item.rank }}</span>
                <span class="retrieval-item-score">score: {{ item.score.toFixed(4) }}</span>
                <a-tag v-if="item.is_ground_truth" color="success" size="small">GT命中</a-tag>
                <a-tag v-else color="default" size="small">未命中</a-tag>
              </div>
              <div v-if="item.heading" class="retrieval-item-heading">{{ item.heading }}</div>
              <MarkdownRenderer :content="item.content" :file-type="item.file_type" />
              <div v-if="item.source_file" class="retrieval-item-source">{{ item.source_file }}</div>
            </div>
          </div>
        </template>
      </template>
    </SplitPanelLayout>
  </template>
</a-drawer>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { formatTime } from '@/utils/time'
import { useCrudModal } from '@/composables/useCrudModal'
import { usePagination } from '@/composables/usePagination'
import { useBatchProcess } from '@/composables/useBatchProcess'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import {
  getGoldenList,
  createGolden,
  updateGolden,
  deleteGolden,
  importGolden,
  createRetrieval,
  getRetrieval,
} from '@/api/golden'
import { searchProjectChunks, getChunksByIds } from '@/api/chunk'
import type { GoldenItem, CreateGoldenParams, ImportResult, RetrievalResponse } from '@/api/model/goldenModel'
import type { ChunkItem } from '@/api/model/documentModel'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import NoProjectPrompt from '@/components/NoProjectPrompt.vue'
import PageToolbar from '@/components/PageToolbar.vue'
import SplitPanelLayout from '@/components/SplitPanelLayout.vue'

const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const loading = ref(false)
const dataList = ref<GoldenItem[]>([])
const searchQuery = ref('')
const retrievalFilter = ref('')

const selectedRowKeys = ref<string[]>([])

const columns = [
  { title: '查询文本', dataIndex: 'query', key: 'query', ellipsis: true, width: 220 },
  { title: '关联分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 100 },
  { title: '参考答案', dataIndex: 'reference_answer', key: 'reference_answer', ellipsis: true, width: 180 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120 },
  { title: '检索', key: 'retrieval', width: 90 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 180 },
]

const paginationConfig = usePagination({ pageSizeOptions: ['10', '20', '50', '100'] })


const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(d => d.query.toLowerCase().includes(q))
})

// 弹窗
const { modalVisible, submitLoading, isEdit, editingId, formState, openCreate, openEdit, handleSubmit } = useCrudModal({
  defaultForm: () => ({ query: '', ground_truth_chunks: [] as string[], reference_answer: '' }),
  createApi: (form) => createGolden(activeProjectStore.activeProjectId!, form as any),
  updateApi: (id, form) => updateGolden(activeProjectStore.activeProjectId!, id, form as any),
  afterSubmit: fetchList,
})

// 分块选择器
const chunkSearchQuery = ref('')
const chunkOptions = ref<ChunkItem[]>([])
const chunksLoading = ref(false)
const chunkOffset = ref(0)
const hasMoreChunks = ref(false)

// 上传相关
const importModalVisible = ref(false)
const importFiles = ref<File[]>([])
const importing = ref(false)
const importResults = ref<(ImportResult & { filename: string })[]>([])
const importCurrentIndex = ref(0)

// 详情 Drawer
const detailDrawerVisible = ref(false)
const detailRecord = ref<GoldenItem | null>(null)

// 检索 Drawer
const retrievalDrawerVisible = ref(false)
const retrievalRecord = ref<GoldenItem | null>(null)
const retrievalResult = ref<RetrievalResponse | null>(null)
const retrievalLoading = ref(false)
const retrievalMaxK = ref(10)

// 批量检索
const { batchProcessing: batchRetrieving, handleBatchProcess: _handleBatchRetrieve } = useBatchProcess({
  selectedRowKeys: () => selectedRowKeys.value,
  setSelectedRowKeys: (keys) => { selectedRowKeys.value = keys },
  canProcess: () => true,
  action: (id) => createRetrieval(activeProjectStore.activeProjectId!, id, { max_k: 10 }),
  label: '批量检索',
  onBatchComplete: (results) => {
    for (const r of results) {
      const item = dataList.value.find(d => d.id === r.golden_id)
      if (item) {
        item.has_retrieval = true
        const hitCount = r.items.filter(i => i.is_ground_truth).length
        item.retrieval_summary = { hit_count: hitCount, gt_total: item.ground_truth_chunks.length }
      }
    }
  },
})

function handleBatchRetrieve() {
  _handleBatchRetrieve()
}

// GT 分块内容
const gtChunks = ref<ChunkItem[]>([])
const gtChunksLoading = ref(false)

function openDetailDrawer(record: GoldenItem) {
  detailRecord.value = record
  detailDrawerVisible.value = true
}

// 检索相关
async function openRetrievalDrawer(record: GoldenItem) {
  retrievalRecord.value = record
  retrievalResult.value = null
  retrievalMaxK.value = 10
  retrievalLoading.value = false
  retrievalDrawerVisible.value = true

  // 拉取 GT 分块内容
  gtChunks.value = []
  if (record.ground_truth_chunks?.length && activeProjectStore.activeProjectId) {
    gtChunksLoading.value = true
    try {
      const res = await getChunksByIds(activeProjectStore.activeProjectId, record.ground_truth_chunks)
      gtChunks.value = res?.chunks || []
    } catch {
      gtChunks.value = []
    } finally {
      gtChunksLoading.value = false
    }
  }

  // 如果已有检索结果，自动加载
  if (record.retrieval_summary) {
    retrievalLoading.value = true
    try {
      const res = await getRetrieval(activeProjectStore.activeProjectId!, record.id)
      retrievalResult.value = res
    } catch {
      retrievalResult.value = null
    } finally {
      retrievalLoading.value = false
    }
  }
}

async function handleRetrieve() {
  if (!retrievalRecord.value || !activeProjectStore.activeProjectId) return
  retrievalLoading.value = true
  try {
    const res = await createRetrieval(activeProjectStore.activeProjectId, retrievalRecord.value.id, {
      max_k: retrievalMaxK.value,
    })
    retrievalResult.value = res
    // 更新列表中的检索状态
    const item = dataList.value.find(d => d.id === retrievalRecord.value!.id)
    if (item) {
      item.has_retrieval = true
      const hitCount = res.items.filter(i => i.is_ground_truth).length
      item.retrieval_summary = { hit_count: hitCount, gt_total: item.ground_truth_chunks.length }
    }
    message.success('检索完成')
  } catch {
    message.error('检索失败')
  } finally {
    retrievalLoading.value = false
  }
}

function handleReRetrieve() {
  retrievalResult.value = null
}

function onSearch() {}

async function fetchList() {
  if (!activeProjectStore.activeProjectId) return
  loading.value = true
  try {
    const params: { retrieval_status?: string } = {}
    if (retrievalFilter.value) {
      params.retrieval_status = retrievalFilter.value
    }
    const res = await getGoldenList(activeProjectStore.activeProjectId, params)
    dataList.value = res || []
  } catch {
    message.error('获取黄金数据集失败')
  } finally {
    loading.value = false
  }
}

function onSelectChange(keys: any[]) {
  selectedRowKeys.value = keys as string[]
}

// 新增
function handleCreate() {
  openCreate()
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  fetchChunks(true)
}

// 编辑
function handleEdit(record: GoldenItem) {
  openEdit(record.id, {
    query: record.query,
    ground_truth_chunks: [...record.ground_truth_chunks],
    reference_answer: record.reference_answer,
  })
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  fetchChunks(true)
}

// 提交
async function handleFormSubmit() {
  await handleSubmit((form) => {
    if (!form.query.trim()) return '请输入查询文本'
    if (form.ground_truth_chunks.length === 0) return '请选择至少一个关联分块'
    return null
  })
}

// 删除
async function handleDelete(id: string) {
  try {
    await deleteGolden(activeProjectStore.activeProjectId!, id)
    message.success('删除成功')
    await fetchList()
  } catch {
    message.error('删除失败')
  }
}

// 批量删除
const { batchProcessing: batchDeleting, handleBatchProcess: _handleBatchDelete } = useBatchProcess({
  selectedRowKeys: () => selectedRowKeys.value,
  setSelectedRowKeys: (keys) => { selectedRowKeys.value = keys },
  canProcess: () => true,
  action: (id) => deleteGolden(activeProjectStore.activeProjectId!, id),
  label: '批量删除',
  onBatchComplete: (_results, batchSucceededIds) => {
    dataList.value = dataList.value.filter(d => !batchSucceededIds.includes(d.id))
  },
})

function handleBatchDelete() {
  _handleBatchDelete()
}

// 分块搜索
async function fetchChunks(reset: boolean = false) {
  if (!activeProjectStore.activeProjectId) return
  chunksLoading.value = true
  if (reset) {
    chunkOffset.value = 0
    chunkOptions.value = []
  }
  try {
    const res = await searchProjectChunks(
      activeProjectStore.activeProjectId,
      chunkSearchQuery.value,
      20,
      chunkOffset.value,
    )
    const chunks = res.chunks || []
    if (reset) {
      chunkOptions.value = chunks
    } else {
      chunkOptions.value = [...chunkOptions.value, ...chunks]
    }
    hasMoreChunks.value = chunks.length === 20
    chunkOffset.value += chunks.length
  } catch {
    // 静默处理
  } finally {
    chunksLoading.value = false
  }
}

function onChunkSearch() {
  fetchChunks(true)
}

function loadMoreChunks() {
  fetchChunks(false)
}

// 上传相关
function beforeUpload(file: File) {
  // 避免重复添加同名文件
  if (!importFiles.value.some(f => f.name === file.name && f.size === file.size)) {
    importFiles.value = [...importFiles.value, file]
  }
  importResults.value = []
  return false // 阻止自动上传
}

function removeImportFile(index: number) {
  importFiles.value = importFiles.value.filter((_, i) => i !== index)
}

async function handleImport() {
  if (importFiles.value.length === 0 || !activeProjectStore.activeProjectId) return
  importing.value = true
  importResults.value = []
  importCurrentIndex.value = 0

  let hasSuccess = false
  for (let i = 0; i < importFiles.value.length; i++) {
    importCurrentIndex.value = i
    try {
      const result = await importGolden(activeProjectStore.activeProjectId, importFiles.value[i])
      importResults.value = [...importResults.value, { ...result, filename: importFiles.value[i].name }]
      if (result.success_count > 0) hasSuccess = true
    } catch {
      importResults.value = [...importResults.value, {
        success_count: 0,
        skipped_count: 0,
        skipped: [],
        filename: importFiles.value[i].name,
      }]
    }
  }

  if (hasSuccess) await fetchList()
  importing.value = false
}

// 模板下载
function downloadTemplate(format: 'jsonl' | 'csv') {
  let content: string
  let filename: string
  let mimeType: string

  if (format === 'jsonl') {
    const example1 = {
      query: '什么是 RAG？',
      ground_truth_chunks: ['chunk_id_1', 'chunk_id_2'],
      reference_answer: 'RAG 是检索增强生成技术，结合了信息检索和文本生成。',
      metadata: { type: 'factual', difficulty: 'easy' },
    }
    const example2 = {
      query: '如何评估检索系统的质量？',
      ground_truth_chunks: ['chunk_id_3'],
      reference_answer: '可以使用 Recall@K、MRR 等指标评估检索质量。',
      metadata: { type: 'procedural', difficulty: 'medium' },
    }
    content = [example1, example2].map(r => JSON.stringify(r)).join('\n')
    filename = 'golden_template.jsonl'
    mimeType = 'application/jsonl'
  } else {
    content = 'query,ground_truth_chunks,reference_answer,metadata\n'
    content += '什么是 RAG？,chunk_id_1;chunk_id_2,RAG 是检索增强生成技术。,"{""type"":""factual"",""difficulty"":""easy""}"\n'
    content += '如何评估检索系统的质量？,chunk_id_3,可以使用 Recall@K、MRR 等指标评估检索质量。,"{""type"":""procedural"",""difficulty"":""medium""}"\n'
    filename = 'golden_template.csv'
    mimeType = 'text/csv'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

watch(() => activeProjectStore.activeProjectId, () => {
  fetchList()
}, { immediate: true })

watch(() => pageStore.refreshTrigger, fetchList)

// 打开上传弹窗时重置状态
watch(importModalVisible, (val) => {
  if (val) {
    importFiles.value = []
    importResults.value = []
  }
})
</script>

<style scoped>
@import '@/styles/common-table.css';

.status-filter {
  width: 120px;
}
.search-input {
  width: 220px;
}

.query-cell {
  font-weight: 500;
}
.answer-cell {
  color: var(--ant-color-text-tertiary);
  font-size: 13px;
}

.chunk-selector {
  border: 1px solid var(--ant-color-border);
  border-radius: 6px;
  padding: 8px 12px;
  max-height: 280px;
  overflow-y: auto;
}
.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chunk-option {
  padding: 4px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary);
}
.chunk-option:last-child {
  border-bottom: none;
}
.chunk-heading {
  font-weight: 500;
  color: var(--ant-color-primary);
  font-size: 12px;
}
.chunk-content {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
}
.load-more {
  text-align: center;
  padding: 8px;
  color: var(--ant-color-primary);
  cursor: pointer;
  font-size: 13px;
}
.load-more:hover {
  opacity: 0.8;
}
.selected-info {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ant-color-primary);
}

/* 上传弹窗 */
.import-modal-content {
  padding: 8px 0;
}
.import-file-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.import-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.import-templates {
  margin-top: 16px;
  padding: 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  font-size: 13px;
}
.template-label {
  color: var(--ant-color-text-tertiary);
  margin-right: 4px;
}
.import-actions {
  margin-top: 16px;
  text-align: right;
}
.import-result {
  margin-top: 16px;
}
.import-result-item {
  margin-bottom: 8px;
}
.import-progress {
  margin-top: 12px;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--ant-color-primary);
}
.skipped-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.skipped-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}
.skipped-item {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  padding: 2px 0;
}

/* 详情 Drawer */
.detail-answer {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}
.detail-metadata {
  margin: 0;
  font-size: var(--ant-font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
}

/* 检索 Drawer - 内容样式 */
.retrieval-query-section {
  flex-shrink: 0;
}
.retrieval-query-label {
  font-size: 13px;
  color: var(--ant-color-text-tertiary);
  margin-bottom: 4px;
}
.retrieval-query-text {
  font-weight: 500;
  font-size: 14px;
  padding: 8px 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
}
.retrieval-gt-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.retrieval-gt-label {
  font-size: 13px;
  color: var(--ant-color-text-tertiary);
  margin-bottom: 8px;
}
.retrieval-gt-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.retrieval-gt-item {
  padding: 10px 12px;
  border-radius: 6px;
  flex-shrink: 0;
}
.retrieval-gt-item--even {
  background: var(--ant-color-error-bg);
  border: 1px solid var(--ant-color-error-border);
}
.retrieval-gt-item--odd {
  background: var(--ant-color-success-bg);
  border: 1px solid var(--ant-color-success-border);
}
.retrieval-gt-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.retrieval-gt-index {
  font-weight: 600;
  color: var(--ant-color-success);
  font-size: 12px;
  flex-shrink: 0;
}
.retrieval-gt-item-heading {
  font-weight: 500;
  font-size: 12px;
  color: var(--ant-color-primary);
}
.retrieval-params {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.retrieval-param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.retrieval-param-label {
  font-size: 13px;
  color: var(--ant-color-text-secondary);
}
.retrieval-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  justify-content: center;
  color: var(--ant-color-primary);
}
.retrieval-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.retrieval-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.retrieval-item {
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.2s;
  flex-shrink: 0;
}
.retrieval-item--even {
  background: var(--ant-color-error-bg);
  border: 1px solid var(--ant-color-error-border);
}
.retrieval-item--odd {
  background: var(--ant-color-success-bg);
  border: 1px solid var(--ant-color-success-border);
}
.retrieval-item-hit {
  border-color: var(--ant-color-success-border);
  background: var(--ant-color-success-bg);
}
.retrieval-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.retrieval-item-rank {
  font-weight: 600;
  color: var(--ant-color-primary);
  font-size: 13px;
}
.retrieval-item-score {
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
}
.retrieval-item-heading {
  font-weight: 500;
  font-size: 12px;
  color: var(--ant-color-primary);
  margin-bottom: 4px;
}
.retrieval-item-source {
  font-size: 11px;
  color: var(--ant-color-text-quaternary);
  margin-top: 4px;
}
.retrieval-actions {
  margin-top: 16px;
  text-align: right;
  flex-shrink: 0;
}
</style>
