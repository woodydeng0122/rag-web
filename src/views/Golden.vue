<template>
  <div class="golden">
    <!-- 未选择项目 -->
    <a-result v-if="!activeProjectStore.hasActiveProject" status="warning" title="请先选择一个项目" sub-title="在顶部点击项目名称可切换">
      <template #extra>
        <a-button type="primary" @click="router.push('/projects')">前往项目列表</a-button>
      </template>
    </a-result>

    <!-- 已选择项目 -->
<template v-else>
  <!-- 工具栏 -->
  <div class="toolbar">
    <div class="toolbar-left">
      <a-select
        v-model:value="statusFilter"
        placeholder="状态筛选"
        class="status-filter"
        allow-clear
        @change="fetchList()"
      >
        <a-select-option value="">全部</a-select-option>
        <a-select-option value="pending_review">待审核</a-select-option>
        <a-select-option value="approved">已审批</a-select-option>
        <a-select-option value="rejected">已拒绝</a-select-option>
      </a-select>
      <a-input-search
        v-model:value="searchQuery"
        placeholder="搜索查询文本..."
        class="search-input"
        allow-clear
        @search="onSearch"
      />
    </div>
    <div class="toolbar-right">
      <a-button
        :disabled="selectedRowKeys.length === 0"
        @click="handleBatchApprove"
      >
        <template #icon><check-circle-outlined /></template>
        批量审批 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button
        danger
        :disabled="selectedRowKeys.length === 0"
        @click="handleBatchReject"
      >
        <template #icon><close-circle-outlined /></template>
        批量拒绝 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button
        danger
        :disabled="selectedRowKeys.length === 0"
        @click="handleBatchDelete"
      >
        <template #icon><delete-outlined /></template>
        批量删除 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button
        :disabled="selectedRowKeys.length === 0"
        :loading="batchRetrieving"
        @click="handleBatchRetrieve"
      >
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
    </div>
  </div>

  <!-- 数据表格 -->
  <a-card :bordered="false" class="table-card">
    <a-spin :spinning="loading">
      <a-table
        :columns="columns"
        :data-source="filteredList"
        row-key="id"
        :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
        :pagination="paginationConfig"
        size="middle"
        :scroll="{ x: 900 }"
        :row-class-name="(record: GoldenItem) => record.status === 'rejected' ? 'row-rejected' : ''"
      >
        <template #bodyCell="{ column, record }">
          <!-- 状态 -->
          <template v-if="column.key === 'status'">
            <a-tag v-if="record.status === 'pending_review'" color="warning">待审核</a-tag>
            <a-tag v-else-if="record.status === 'approved'" color="success">已通过</a-tag>
            <a-tag v-else-if="record.status === 'rejected'" color="error">已拒绝</a-tag>
            <a-tag v-else>{{ record.status }}</a-tag>
          </template>

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
            <a-button v-if="record.has_retrieval" size="small" type="link" style="color: #52c41a" @click="openRetrievalModal(record)">查看结果</a-button>
            <a-button v-else size="small" type="link" @click="openRetrievalModal(record)">检索</a-button>
          </template>

          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <div class="action-cell">
              <a-button size="small" @click="openDetailDrawer(record)">详情</a-button>
              <a-button
                v-if="record.status === 'pending_review'"
                size="small"
                type="primary"
                @click="handleApprove(record)"
              >
                <template #icon><check-circle-outlined /></template>
              </a-button>
              <a-button
                v-if="record.status === 'pending_review'"
                size="small"
                danger
                @click="handleReject(record)"
              >
                <template #icon><close-circle-outlined /></template>
              </a-button>
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
  @ok="handleSubmit"
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
      <p class="ant-upload-drag-icon"><upload-outlined style="font-size: 36px; color: #1677ff" /></p>
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
      <a-descriptions-item label="状态">
        <a-tag v-if="detailRecord.status === 'pending_review'" color="warning">待审核</a-tag>
        <a-tag v-else-if="detailRecord.status === 'approved'" color="success">已通过</a-tag>
        <a-tag v-else-if="detailRecord.status === 'rejected'" color="error">已拒绝</a-tag>
        <a-tag v-else>{{ detailRecord.status }}</a-tag>
      </a-descriptions-item>
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
      <a-button v-if="detailRecord.status === 'pending_review'" type="primary" @click="handleApprove(detailRecord); detailDrawerVisible = false">审批通过</a-button>
      <a-button v-if="detailRecord.status === 'pending_review'" danger @click="handleReject(detailRecord); detailDrawerVisible = false">拒绝</a-button>
      <a-button @click="handleEdit(detailRecord); detailDrawerVisible = false">编辑</a-button>
    </div>
  </template>
</a-drawer>

<!-- 检索 Modal -->
<a-modal
  v-model:open="retrievalModalVisible"
  :title="'检索验证'"
  :footer="null"
  width="680px"
  @cancel="retrievalModalVisible = false"
>
  <template v-if="retrievalRecord">
    <!-- 查询信息 -->
    <div class="retrieval-query-section">
      <div class="retrieval-query-label">查询文本</div>
      <div class="retrieval-query-text">{{ retrievalRecord.query }}</div>
    </div>

    <!-- 检索参数 -->
    <div v-if="!retrievalResult" class="retrieval-params">
      <div class="retrieval-param-row">
        <span class="retrieval-param-label">max_k</span>
        <a-input-number v-model:value="retrievalMaxK" :min="1" :max="100" style="width: 120px" />
      </div>
      <a-button type="primary" :loading="retrievalLoading" @click="handleRetrieve">确认检索</a-button>
    </div>

    <!-- 检索中 -->
    <div v-if="retrievalLoading" class="retrieval-loading">
      <a-spin />
      <span>正在检索...</span>
    </div>

    <!-- 检索结果 -->
    <template v-if="retrievalResult">
      <div class="retrieval-metrics">
        <a-tag>模型: {{ retrievalResult.embed_model_name || '--' }}</a-tag>
        <a-tag>耗时: {{ retrievalResult.latency_ms }}ms</a-tag>
        <a-tag>max_k: {{ retrievalResult.max_k }}</a-tag>
        <a-tag color="green">命中GT: {{ retrievalResult.items.filter(i => i.is_ground_truth).length }}/{{ retrievalRecord.ground_truth_chunks?.length || 0 }}</a-tag>
      </div>

      <div class="retrieval-items">
        <div v-for="item in retrievalResult.items" :key="item.chunk_id" class="retrieval-item" :class="{ 'retrieval-item-hit': item.is_ground_truth }">
          <div class="retrieval-item-header">
            <span class="retrieval-item-rank">#{{ item.rank }}</span>
            <span class="retrieval-item-score">score: {{ item.score.toFixed(4) }}</span>
            <a-tag v-if="item.is_ground_truth" color="success" size="small">GT命中</a-tag>
            <a-tag v-else color="default" size="small">未命中</a-tag>
          </div>
          <div v-if="item.heading" class="retrieval-item-heading">{{ item.heading }}</div>
          <div class="retrieval-item-content">{{ item.content.length > 200 ? item.content.slice(0, 200) + '...' : item.content }}</div>
          <div v-if="item.source_file" class="retrieval-item-source">{{ item.source_file }}</div>
        </div>
      </div>

      <div class="retrieval-actions">
        <a-button type="primary" @click="handleReRetrieve">重新检索</a-button>
      </div>
    </template>
  </template>
</a-modal>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  UploadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import {
  getGoldenList,
  createGolden,
  updateGolden,
  deleteGolden,
  importGolden,
  batchApprove,
  batchReject,
  createRetrieval,
  getRetrieval,
} from '@/api/golden'
import { searchProjectChunks } from '@/api/chunk'
import type { GoldenItem, CreateGoldenParams, ImportResult, RetrievalResponse } from '@/api/model/goldenModel'
import type { ChunkItem } from '@/api/model/documentModel'

dayjs.locale('zh-cn')

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const loading = ref(false)
const dataList = ref<GoldenItem[]>([])
const searchQuery = ref('')
const statusFilter = ref('')

const selectedRowKeys = ref<string[]>([])

const columns = [
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '查询文本', dataIndex: 'query', key: 'query', ellipsis: true, width: 220 },
  { title: '关联分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 100 },
  { title: '参考答案', dataIndex: 'reference_answer', key: 'reference_answer', ellipsis: true, width: 180 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120 },
  { title: '检索', key: 'retrieval', width: 90 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 180 },
]

const paginationConfig = {
  pageSize: 10,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50'],
}

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(d => d.query.toLowerCase().includes(q))
})

// 弹窗
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formState = ref<{ query: string; ground_truth_chunks: string[]; reference_answer: string }>({
  query: '',
  ground_truth_chunks: [],
  reference_answer: '',
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

// 检索 Modal
const retrievalModalVisible = ref(false)
const retrievalRecord = ref<GoldenItem | null>(null)
const retrievalResult = ref<RetrievalResponse | null>(null)
const retrievalLoading = ref(false)
const retrievalMaxK = ref(10)

// 批量检索
const batchRetrieving = ref(false)

function openDetailDrawer(record: GoldenItem) {
  detailRecord.value = record
  detailDrawerVisible.value = true
}

// 检索相关
async function openRetrievalModal(record: GoldenItem) {
  retrievalRecord.value = record
  retrievalResult.value = null
  retrievalMaxK.value = 10
  retrievalLoading.value = false
  retrievalModalVisible.value = true

  // 如果已有检索结果，自动加载
  if (record.has_retrieval) {
    retrievalLoading.value = true
    try {
      const res = await getRetrieval(activeProjectStore.activeProjectId!, record.id)
      retrievalResult.value = res
    } catch {
      // 无检索结果或加载失败，显示检索参数界面
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
    // 更新列表中的 has_retrieval 状态
    const item = dataList.value.find(d => d.id === retrievalRecord.value!.id)
    if (item) item.has_retrieval = true
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

// 批量检索
function handleBatchRetrieve() {
  const ids = [...selectedRowKeys.value]
  if (ids.length === 0) return

  AModal.confirm({
    title: '批量检索',
    content: `确定要对选中的 ${ids.length} 条记录执行检索吗？（max_k = 10，已有结果将被覆盖）`,
    async onOk() {
      batchRetrieving.value = true
      let successCount = 0
      let failCount = 0
      const remaining = [...ids]

      while (remaining.length > 0) {
        const batch = remaining.splice(0, 2)
        const results = await Promise.allSettled(
          batch.map(id => createRetrieval(activeProjectStore.activeProjectId!, id, { max_k: 10 }))
        )
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'fulfilled') {
            successCount++
            selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== batch[i])
          } else {
            failCount++
          }
        }
      }

      if (failCount > 0) {
        message.warning(`批量检索完成：${successCount} 条成功，${failCount} 条失败`)
      } else {
        message.success(`批量检索完成：${successCount} 条成功`)
      }
      batchRetrieving.value = false
      await fetchList()
    },
  })
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

function onSearch() {}

async function fetchList() {
  if (!activeProjectStore.activeProjectId) return
  loading.value = true
  try {
    const res = await getGoldenList(activeProjectStore.activeProjectId, statusFilter.value || undefined)
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
  isEdit.value = false
  editingId.value = ''
  formState.value = { query: '', ground_truth_chunks: [], reference_answer: '' }
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  modalVisible.value = true
  fetchChunks(true)
}

// 编辑
function handleEdit(record: GoldenItem) {
  isEdit.value = true
  editingId.value = record.id
  formState.value = {
    query: record.query,
    ground_truth_chunks: [...record.ground_truth_chunks],
    reference_answer: record.reference_answer,
  }
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  modalVisible.value = true
  fetchChunks(true)
}

// 提交
async function handleSubmit() {
  if (!formState.value.query.trim()) {
    message.warning('请输入查询文本')
    return
  }
  if (formState.value.ground_truth_chunks.length === 0) {
    message.warning('请选择至少一个关联分块')
    return
  }

  submitLoading.value = true
  try {
    const params: CreateGoldenParams = {
      query: formState.value.query,
      ground_truth_chunks: formState.value.ground_truth_chunks,
      reference_answer: formState.value.reference_answer,
    }
    if (isEdit.value) {
      await updateGolden(activeProjectStore.activeProjectId!, editingId.value, params)
      message.success('更新成功')
    } else {
      await createGolden(activeProjectStore.activeProjectId!, params)
      message.success('创建成功')
    }
    modalVisible.value = false
    await fetchList()
  } catch {
    message.error(isEdit.value ? '编辑失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
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
function handleBatchDelete() {
  const ids = [...selectedRowKeys.value]
  AModal.confirm({
    title: '批量删除',
    content: `确定要删除选中的 ${ids.length} 条记录吗？此操作不可恢复。`,
    okType: 'danger',
    async onOk() {
      let successCount = 0
      let failCount = 0
      const remaining = [...ids]

      while (remaining.length > 0) {
        const batch = remaining.splice(0, 2)
        const results = await Promise.allSettled(
          batch.map(id => deleteGolden(activeProjectStore.activeProjectId!, id))
        )
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'fulfilled') {
            successCount++
            selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== batch[i])
          } else {
            failCount++
          }
        }
      }

      if (failCount > 0) {
        message.warning(`批量删除完成：${successCount} 条成功，${failCount} 条失败`)
      } else {
        message.success(`批量删除完成：${successCount} 条成功`)
      }
      await fetchList()
    },
  })
}

// 单条审批
async function handleApprove(record: GoldenItem) {
  try {
    await updateGolden(activeProjectStore.activeProjectId!, record.id, { status: 'approved' })
    message.success('审批通过')
    await fetchList()
  } catch {
    message.error('审批失败')
  }
}

// 单条拒绝
async function handleReject(record: GoldenItem) {
  try {
    await updateGolden(activeProjectStore.activeProjectId!, record.id, { status: 'rejected' })
    message.success('已拒绝')
    await fetchList()
  } catch {
    message.error('操作失败')
  }
}

// 批量审批
async function handleBatchApprove() {
  const ids = [...selectedRowKeys.value]
  if (ids.length === 0) return
  try {
    const res = await batchApprove(activeProjectStore.activeProjectId!, { record_ids: ids })
    message.success(`批量审批完成：${res.updated_count} 条已通过`)
    selectedRowKeys.value = []
    await fetchList()
  } catch {
    message.error('批量审批失败')
  }
}

// 批量拒绝
async function handleBatchReject() {
  const ids = [...selectedRowKeys.value]
  if (ids.length === 0) return
  try {
    const res = await batchReject(activeProjectStore.activeProjectId!, { record_ids: ids })
    message.success(`批量拒绝完成：${res.updated_count} 条已拒绝`)
    selectedRowKeys.value = []
    await fetchList()
  } catch {
    message.error('批量拒绝失败')
  }
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
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-filter {
  width: 120px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 220px;
}

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
.table-card :deep(.ant-table-tbody > tr.row-rejected > td) {
  opacity: 0.6;
}

.query-cell {
  font-weight: 500;
}
.answer-cell {
  color: #888;
  font-size: 13px;
}
.time-cell {
  color: #888;
  font-size: 13px;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chunk-selector {
  border: 1px solid #d9d9d9;
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
  border-bottom: 1px solid #f5f5f5;
}
.chunk-option:last-child {
  border-bottom: none;
}
.chunk-heading {
  font-weight: 500;
  color: #1677ff;
  font-size: 12px;
}
.chunk-content {
  font-size: 12px;
  color: #666;
}
.load-more {
  text-align: center;
  padding: 8px;
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
}
.load-more:hover {
  opacity: 0.8;
}
.selected-info {
  margin-top: 4px;
  font-size: 12px;
  color: #1677ff;
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
  background: #fafafa;
  border-radius: 6px;
  font-size: 13px;
}
.template-label {
  color: #888;
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
  color: #1677ff;
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
  color: #666;
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
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
}

/* 检索 Modal */
.retrieval-query-section {
  margin-bottom: 16px;
}
.retrieval-query-label {
  font-size: 13px;
  color: #888;
  margin-bottom: 4px;
}
.retrieval-query-text {
  font-weight: 500;
  font-size: 14px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
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
  color: #666;
}
.retrieval-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  justify-content: center;
  color: #1677ff;
}
.retrieval-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.retrieval-items {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.retrieval-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.2s;
}
.retrieval-item-hit {
  border-color: #b7eb8f;
  background: #f6ffed;
}
.retrieval-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.retrieval-item-rank {
  font-weight: 600;
  color: #1677ff;
  font-size: 13px;
}
.retrieval-item-score {
  font-size: 12px;
  color: #888;
}
.retrieval-item-heading {
  font-weight: 500;
  font-size: 12px;
  color: #1677ff;
  margin-bottom: 4px;
}
.retrieval-item-content {
  font-size: 12px;
  color: #666;
  line-height: 1.6;
}
.retrieval-item-source {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
}
.retrieval-actions {
  margin-top: 16px;
  text-align: right;
}
</style>
