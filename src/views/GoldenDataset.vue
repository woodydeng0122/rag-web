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
            type="primary"
            :disabled="selectedRowKeys.length === 0"
            :loading="evaluating"
            @click="handleBatchEvaluate"
          >
            <template #icon><thunderbolt-outlined /></template>
            批量评测 ({{ selectedRowKeys.length }})
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

              <!-- 评测状态 -->
              <template v-if="column.key === 'eval_status'">
                <span v-if="record.is_hit === true" class="eval-hit">
                  <check-circle-outlined /> 命中 <span v-if="record.hit_rank" class="eval-rank">(rank={{ record.hit_rank }})</span>
                </span>
                <span v-else-if="record.is_hit === false" class="eval-miss">
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
      :width="640"
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
        >
          <p class="ant-upload-drag-icon"><upload-outlined style="font-size: 36px; color: #1677ff" /></p>
          <p class="ant-upload-text">拖拽或点击上传文件</p>
          <p class="ant-upload-hint">支持 .jsonl / .csv 格式，单次最多 1000 条</p>
        </a-upload-dragger>

        <div v-if="importFile" class="import-file-info">
          <a-tag color="blue">{{ importFile.name }}</a-tag>
          <a-button type="link" size="small" @click="importFile = null">移除</a-button>
        </div>

        <div class="import-templates">
          <span class="template-label">下载模板：</span>
          <a @click="downloadTemplate('jsonl')">JSONL 模板</a>
          <a-divider type="vertical" />
          <a @click="downloadTemplate('csv')">CSV 模板</a>
        </div>

        <div class="import-actions">
          <a-button :disabled="!importFile" :loading="importing" type="primary" @click="handleImport">
            确认导入
          </a-button>
        </div>

        <!-- 导入结果 -->
        <div v-if="importResult" class="import-result">
          <a-alert
            :type="importResult.skipped_count > 0 ? 'warning' : 'success'"
            show-icon
            :message="`成功导入 ${importResult.success_count} 条${importResult.skipped_count > 0 ? '，跳过 ' + importResult.skipped_count + ' 条' : ''}`"
          />
          <div v-if="importResult.skipped.length > 0" class="skipped-list">
            <div class="skipped-title">跳过原因：</div>
            <div v-for="s in importResult.skipped" :key="s.row" class="skipped-item">
              第 {{ s.row }} 行：{{ s.reason }}
            </div>
          </div>
        </div>
      </div>
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
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import {
  getGoldenDatasetList,
  createGoldenDataset,
  updateGoldenDataset,
  deleteGoldenDataset,
  evaluateByProject,
  importGoldenDataset,
} from '@/api/goldenDataset'
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
const evaluating = ref(false)
const evaluatingIds = ref<string[]>([])

const selectedRowKeys = ref<string[]>([])

const columns = [
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
const importFile = ref<File | null>(null)
const importing = ref(false)
const importResult = ref<ImportResult | null>(null)

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
    const res = await getGoldenDatasetList(activeProjectStore.activeProjectId)
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
  importFile.value = file
  importResult.value = null
  return false // 阻止自动上传
}

async function handleImport() {
  if (!importFile.value || !activeProjectStore.activeProjectId) return
  importing.value = true
  importResult.value = null
  try {
    const result = await importGoldenDataset(activeProjectStore.activeProjectId, importFile.value)
    importResult.value = result
    if (result.success_count > 0) {
      await fetchList()
    }
  } catch {
    message.error('导入失败')
  } finally {
    importing.value = false
  }
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
    importFile.value = null
    importResult.value = null
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
.import-file-info {
  margin-top: 12px;
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
</style>
