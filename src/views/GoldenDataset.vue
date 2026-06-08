<template>
  <div class="golden-dataset">
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
      <a-button @click="openGenerateModal">
        <template #icon><thunderbolt-outlined /></template>
        LLM 生成
      </a-button>
      <a-button
        type="primary"
        :disabled="selectedRowKeys.length === 0"
        :loading="evaluating"
        @click="handleBatchEvaluate"
      >
        <template #icon><thunderbolt-outlined /></template>
        批量评测 ({{ selectedRowKeys.length }})
      </a-button>
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
        :row-class-name="(record: GoldenDatasetItem) => record.status === 'rejected' ? 'row-rejected' : ''"
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

          <!-- 评测状态 -->
          <template v-if="column.key === 'eval_status'">
            <span v-if="record.evaluation?.is_hit === true" class="eval-hit">
              <check-circle-outlined /> 命中 <span v-if="record.evaluation.hit_rank" class="eval-rank">(rank={{ record.evaluation.hit_rank }})</span>
            </span>
            <span v-else-if="record.evaluation?.is_hit === false" class="eval-miss">
              <close-circle-outlined /> 未命中
            </span>
            <span v-else class="eval-none">-- 未评测</span>
          </template>

          <!-- 创建时间 -->
          <template v-if="column.key === 'created_at'">
            <span class="time-cell">{{ formatTime(record.created_at) }}</span>
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
              <a-button size="small" type="primary" :loading="evaluatingIds.includes(record.id)" @click="handleEvaluate(record)">评测</a-button>
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

<!-- LLM 生成弹窗 -->
<a-modal
  v-model:open="generateModalVisible"
  title="LLM 生成黄金数据集"
  :confirm-loading="generateSubmitting"
  width="50%"
  ok-text="开始生成"
  cancel-text="取消"
  @ok="handleGenerate"
  @cancel="generateModalVisible = false"
>
  <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="padding-top: 16px">
    <a-form-item label="选择文档" required>
      <a-select
        v-model:value="generateDocumentIds"
        mode="multiple"
        placeholder="请选择文档"
        :loading="documentsLoading"
        :options="documentOptions.map(d => ({ value: d.id, label: d.filename }))"
        allow-clear
      />
    </a-form-item>
    <a-form-item label="每分块生成数">
      <a-input-number v-model:value="generatePerChunk" :min="1" :max="10" style="width: 100%" />
    </a-form-item>
    <a-form-item label="用户画像">
      <a-input v-model:value="generatePersona" placeholder="请输入用户画像" />
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
      <a-descriptions-item label="评测状态">
        <span v-if="detailRecord.evaluation?.is_hit === true" class="eval-hit">
          <check-circle-outlined /> 命中 <span v-if="detailRecord.evaluation.hit_rank" class="eval-rank">(rank={{ detailRecord.evaluation.hit_rank }})</span>
        </span>
        <span v-else-if="detailRecord.evaluation?.is_hit === false" class="eval-miss">
          <close-circle-outlined /> 未命中
        </span>
        <span v-else class="eval-none">未评测</span>
      </a-descriptions-item>
      <a-descriptions-item v-if="detailRecord.evaluation?.retrieved_chunk_ids?.length" label="检索命中的分块">
        <a-tag v-for="cid in detailRecord.evaluation.retrieved_chunk_ids" :key="cid" style="margin-bottom: 4px">{{ cid }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item v-if="detailRecord.evaluation?.evaluated_at" label="评测时间">{{ detailRecord.evaluation.evaluated_at }}</a-descriptions-item>
      <a-descriptions-item label="创建时间">{{ detailRecord.created_at }}</a-descriptions-item>
      <a-descriptions-item v-if="detailRecord.metadata && Object.keys(detailRecord.metadata).length" label="元数据">
        <pre class="detail-metadata">{{ JSON.stringify(detailRecord.metadata, null, 2) }}</pre>
      </a-descriptions-item>
    </a-descriptions>

    <div class="detail-actions">
      <a-button v-if="detailRecord.status === 'pending_review'" type="primary" @click="handleApprove(detailRecord); detailDrawerVisible = false">审批通过</a-button>
      <a-button v-if="detailRecord.status === 'pending_review'" danger @click="handleReject(detailRecord); detailDrawerVisible = false">拒绝</a-button>
      <a-button @click="handleEdit(detailRecord); detailDrawerVisible = false">编辑</a-button>
      <a-button type="primary" :loading="evaluatingIds.includes(detailRecord.id)" @click="handleEvaluate(detailRecord)">评测</a-button>
    </div>
  </template>
</a-drawer>

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
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import {
  getGoldenDatasetList,
  createGoldenDataset,
  updateGoldenDataset,
  deleteGoldenDataset,
  evaluateByProject,
  importGoldenDataset,
  batchApprove,
  batchReject,
} from '@/api/goldenDataset'
import { generateGolden } from '@/api/generationTask'
import { getDocumentList } from '@/api/document'
import { searchProjectChunks } from '@/api/chunk'
import type { GoldenDatasetItem, CreateGoldenDatasetParams, ImportResult } from '@/api/model/goldenDatasetModel'
import type { ChunkItem } from '@/api/model/documentModel'

dayjs.locale('zh-cn')

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const loading = ref(false)
const dataList = ref<GoldenDatasetItem[]>([])
const searchQuery = ref('')
const statusFilter = ref('')
const evaluating = ref(false)
const evaluatingIds = ref<string[]>([])

const selectedRowKeys = ref<string[]>([])

// 生成弹窗
const generateModalVisible = ref(false)
const generateSubmitting = ref(false)
const generateDocumentIds = ref<string[]>([])
const generatePerChunk = ref(2)
const generatePersona = ref('开发者')
const documentOptions = ref<{ id: string; filename: string }[]>([])
const documentsLoading = ref(false)

const columns = [
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '查询文本', dataIndex: 'query', key: 'query', ellipsis: true, width: 220 },
  { title: '关联分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 100 },
  { title: '参考答案', dataIndex: 'reference_answer', key: 'reference_answer', ellipsis: true, width: 180 },
  { title: '评测状态', key: 'eval_status', width: 140 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120 },
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
const detailRecord = ref<GoldenDatasetItem | null>(null)

function openDetailDrawer(record: GoldenDatasetItem) {
  detailRecord.value = record
  detailDrawerVisible.value = true
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
    const res = await getGoldenDatasetList(activeProjectStore.activeProjectId, statusFilter.value || undefined)
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
function handleEdit(record: GoldenDatasetItem) {
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
    const params: CreateGoldenDatasetParams = {
      query: formState.value.query,
      ground_truth_chunks: formState.value.ground_truth_chunks,
      reference_answer: formState.value.reference_answer,
    }
    if (isEdit.value) {
      await updateGoldenDataset(activeProjectStore.activeProjectId!, editingId.value, params)
      message.success('更新成功')
    } else {
      await createGoldenDataset(activeProjectStore.activeProjectId!, params)
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
    await deleteGoldenDataset(activeProjectStore.activeProjectId!, id)
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
          batch.map(id => deleteGoldenDataset(activeProjectStore.activeProjectId!, id))
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
async function handleApprove(record: GoldenDatasetItem) {
  try {
    await updateGoldenDataset(activeProjectStore.activeProjectId!, record.id, { status: 'approved' })
    message.success('审批通过')
    await fetchList()
  } catch {
    message.error('审批失败')
  }
}

// 单条拒绝
async function handleReject(record: GoldenDatasetItem) {
  try {
    await updateGoldenDataset(activeProjectStore.activeProjectId!, record.id, { status: 'rejected' })
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

// LLM 生成弹窗
async function openGenerateModal() {
  generateModalVisible.value = true
  generateDocumentIds.value = []
  generatePerChunk.value = 2
  generatePersona.value = '开发者'
  if (documentOptions.value.length === 0) {
    documentsLoading.value = true
    try {
      const res = await getDocumentList(activeProjectStore.activeProjectId!)
      documentOptions.value = (res.documents || []).map(d => ({ id: d.id, filename: d.filename }))
    } catch {
      message.error('获取文档列表失败')
    } finally {
      documentsLoading.value = false
    }
  }
}

// LLM 生成提交
async function handleGenerate() {
  if (generateDocumentIds.value.length === 0) {
    message.warning('请选择至少一个文档')
    return
  }
  generateSubmitting.value = true
  try {
    await generateGolden(activeProjectStore.activeProjectId!, {
      document_ids: generateDocumentIds.value,
      config: {
        per_chunk: generatePerChunk.value,
        user_persona: generatePersona.value,
      },
    })
    message.success('生成任务已提交')
    generateModalVisible.value = false
    await fetchList()
  } catch {
    message.error('生成任务提交失败')
  } finally {
    generateSubmitting.value = false
  }
}

// 单条评测
async function handleEvaluate(record: GoldenDatasetItem) {
  evaluatingIds.value.push(record.id)
  try {
    await evaluateByProject(activeProjectStore.activeProjectId!, { golden_ids: [record.id] })
    message.success('评测完成，项目评测数据已更新')
    await fetchList()
  } catch {
    message.error('评测失败')
  } finally {
    evaluatingIds.value = evaluatingIds.value.filter(id => id !== record.id)
  }
}

// 批量评测
function handleBatchEvaluate() {
  const ids = [...selectedRowKeys.value]
  AModal.confirm({
    title: '批量评测',
    content: `确定要对选中的 ${ids.length} 条记录进行评测吗？`,
    async onOk() {
      evaluating.value = true
      let successCount = 0
      let failCount = 0
      const remaining = [...ids]

      while (remaining.length > 0) {
        const batch = remaining.splice(0, 2)
        try {
          await evaluateByProject(activeProjectStore.activeProjectId!, {
            golden_ids: batch,
          })
          successCount += batch.length
          selectedRowKeys.value = selectedRowKeys.value.filter(k => !batch.includes(k))
        } catch {
          failCount += batch.length
        }
      }

      if (failCount > 0) {
        message.warning(`批量评测完成：${successCount} 条成功，${failCount} 条失败`)
      } else {
        message.success(`批量评测完成：${successCount} 条成功`)
      }
      evaluating.value = false
      await fetchList()
    },
  })
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
      const result = await importGoldenDataset(activeProjectStore.activeProjectId, importFiles.value[i])
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
    filename = 'golden_dataset_template.jsonl'
    mimeType = 'application/jsonl'
  } else {
    content = 'query,ground_truth_chunks,reference_answer,metadata\n'
    content += '什么是 RAG？,chunk_id_1;chunk_id_2,RAG 是检索增强生成技术。,"{""type"":""factual"",""difficulty"":""easy""}"\n'
    content += '如何评估检索系统的质量？,chunk_id_3,可以使用 Recall@K、MRR 等指标评估检索质量。,"{""type"":""procedural"",""difficulty"":""medium""}"\n'
    filename = 'golden_dataset_template.csv'
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

.eval-hit {
  color: #52c41a;
  font-size: 13px;
}
.eval-rank {
  color: #999;
  font-size: 12px;
}
.eval-miss {
  color: #ff4d4f;
  font-size: 13px;
}
.eval-none {
  color: #bbb;
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
</style>
