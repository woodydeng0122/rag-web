<template>
  <div class="evaluation-history">
    <!-- 工具栏 -->
    <PageToolbar title="评估历史">
      <template #actions>
        <a-button type="primary" @click="showEvalModal">
          <template #icon><plus-outlined /></template>
          新增评估
        </a-button>
      </template>
    </PageToolbar>

    <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
      <a-spin :spinning="loading">
        <a-table
          :columns="columns"
          :data-source="history"
          :pagination="false"
          row-key="id"
          size="middle"
          :locale="{ emptyText: '暂无评估记录，运行评估后历史记录将显示在此处' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'created_at'">
              <span class="cell-time">{{ formatDateTime(record.created_at) }}</span>
            </template>
            <template v-else-if="column.key === 'category'">
              <a-tag :color="record.category === 'rerank' ? 'purple' : 'blue'">
                {{ record.category === 'rerank' ? '重排' : '粗排' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'strategy'">
              <a-tag :color="strategyTagColor(record.strategy)">{{ strategyLabel(record.strategy) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'recall_at_k'">
              <span class="cell-metric" :class="getMetricClass(record.recall_at_k)">
                {{ (record.recall_at_k * 100).toFixed(2) }}%
              </span>
            </template>
            <template v-else-if="column.key === 'mrr'">
              <span class="cell-metric" :class="getMetricClass(record.mrr)">
                {{ record.mrr.toFixed(4) }}
              </span>
            </template>
            <template v-else-if="column.key === 'ndcg'">
              <span class="cell-metric" :class="getMetricClass(record.ndcg)">
                {{ record.ndcg.toFixed(4) }}
              </span>
            </template>
            <template v-else-if="column.key === 'hit_rate'">
              <span class="cell-metric" :class="getMetricClass(record.hit_rate)">
                {{ (record.hit_rate * 100).toFixed(2) }}%
              </span>
            </template>
            <template v-else-if="column.key === 'full_hit_count'">
              <span class="cell-positive">{{ record.full_hit_count }}</span>
            </template>
            <template v-else-if="column.key === 'zero_hit_count'">
              <span :class="record.zero_hit_count > 0 ? 'cell-negative' : 'cell-positive'">
                {{ record.zero_hit_count }}
              </span>
            </template>
            <template v-else-if="column.key === 'avg_latency_ms'">
              <span :class="record.avg_latency_ms > 500 ? 'cell-negative' : ''">
                {{ record.avg_latency_ms.toFixed(0) }}
              </span>
            </template>
            <template v-else-if="column.key === 'embed_model_name'">
              <a-tag>{{ record.embed_model_name }}</a-tag>
            </template>
            <template v-else-if="column.key === 'remark'">
              <span>{{ record.remark || '--' }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="4">
                <a-button size="small" type="link" @click="showEditModal(record)">编辑</a-button>
                <a-popconfirm title="确定删除此评估记录？" ok-text="确定" cancel-text="取消" @confirm="handleDelete(record)">
                  <a-button size="small" danger type="link">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <!-- 新增评估弹窗 -->
    <a-modal
      v-model:open="evalModalVisible"
      title="新增评估"
      :confirm-loading="evalLoading"
      ok-text="开始评估"
      cancel-text="取消"
      @ok="handleEval"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top: 16px">
        <a-form-item label="评估类别" required>
          <a-select v-model:value="evalCategory" style="width: 100%">
            <a-select-option value="recall">粗排 (Recall)</a-select-option>
            <a-select-option value="rerank">重排 (Rerank)</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="evalCategory === 'recall'" label="检索策略" required>
          <a-select v-model:value="evalStrategy" style="width: 100%">
            <a-select-option v-for="s in strategyOptions" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="top_k" required>
          <a-input-number v-model:value="evalTopK" :min="1" :max="100" style="width: 100%" />
          <span class="form-hint">检索返回的最大文档数</span>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="evalRemark" :rows="2" :maxlength="500" placeholder="可选，记录本次评估的背景信息" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑评估弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑评估"
      :confirm-loading="editLoading"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleEdit"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top: 16px">
        <a-form-item label="检索策略" required>
          <a-select v-model:value="editStrategy" style="width: 100%">
            <a-select-option v-for="s in strategyOptions" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="editRemark" :rows="2" :maxlength="500" placeholder="可选，记录本次评估的背景信息" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
} from '@ant-design/icons-vue'
import { dayjs } from '@/utils/time'
import { getEvaluationHistory, triggerEvaluation, deleteEvaluation, updateEvaluation } from '@/api/project'
import type { EvaluationStatsResult, RetrievalStrategy, EvaluationCategory } from '@/api/model/projectModel'
import PageToolbar from '@/components/PageToolbar.vue'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'

const route = useRoute()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const projectId = computed(() => (route.params.id as string) || activeProjectStore.activeProjectId)

const loading = ref(false)
const history = ref<EvaluationStatsResult[]>([])

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150 },
  { title: '类别', dataIndex: 'category', key: 'category', width: 80 },
  { title: '策略', dataIndex: 'strategy', key: 'strategy', width: 100 },
  { title: 'top_k', dataIndex: 'top_k', key: 'top_k', width: 70, align: 'center' as const },
  { title: 'Recall@k', dataIndex: 'recall_at_k', key: 'recall_at_k', width: 100, align: 'right' as const },
  { title: 'MRR', dataIndex: 'mrr', key: 'mrr', width: 90, align: 'right' as const },
  { title: 'NDCG', dataIndex: 'ndcg', key: 'ndcg', width: 90, align: 'right' as const },
  { title: '命中率', dataIndex: 'hit_rate', key: 'hit_rate', width: 90, align: 'right' as const },
  { title: '完全命中', dataIndex: 'full_hit_count', key: 'full_hit_count', width: 80, align: 'center' as const },
  { title: '零命中', dataIndex: 'zero_hit_count', key: 'zero_hit_count', width: 70, align: 'center' as const },
  { title: '黄金记录', dataIndex: 'golden_total', key: 'golden_total', width: 80, align: 'center' as const },
  { title: '已检索', dataIndex: 'golden_retrieved', key: 'golden_retrieved', width: 70, align: 'center' as const },
  { title: '延迟(ms)', dataIndex: 'avg_latency_ms', key: 'avg_latency_ms', width: 90, align: 'right' as const },
  { title: '嵌入模型', dataIndex: 'embed_model_name', key: 'embed_model_name', width: 180 },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 160 },
  { title: '操作', key: 'action', width: 120 },
]

function formatDateTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function getMetricClass(value: number) {
  if (value >= 0.8) return 'metric-good'
  if (value >= 0.5) return 'metric-mid'
  return 'metric-low'
}

const STRATEGY_LABELS: Record<string, string> = {
  hybrid: 'Hybrid',
  vector: 'Vector',
  cosine: 'Cosine',
  bm25: 'BM25',
}

const STRATEGY_COLORS: Record<string, string> = {
  hybrid: 'purple',
  vector: 'blue',
  cosine: 'cyan',
  bm25: 'orange',
}

const strategyOptions = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'vector', label: 'Vector' },
  { value: 'cosine', label: 'Cosine' },
  { value: 'bm25', label: 'BM25' },
]

function strategyLabel(strategy: string) {
  return STRATEGY_LABELS[strategy] || strategy
}

function strategyTagColor(strategy: string) {
  return STRATEGY_COLORS[strategy] || 'default'
}

async function fetchHistory() {
  const pid = projectId.value
  if (!pid) return
  loading.value = true
  try {
    const res = await getEvaluationHistory(pid)
    history.value = res || []
  } catch {
    message.error('获取评估历史失败')
  } finally {
    loading.value = false
  }
}

// ---- 新增评估 ----
const evalModalVisible = ref(false)
const evalTopK = ref(10)
const evalStrategy = ref<RetrievalStrategy>('hybrid')
const evalCategory = ref<EvaluationCategory>('recall')
const evalRemark = ref('')
const evalLoading = ref(false)

function showEvalModal() {
  evalStrategy.value = 'hybrid'
  evalCategory.value = 'recall'
  evalTopK.value = 10
  evalRemark.value = ''
  evalModalVisible.value = true
}

async function handleEval() {
  evalLoading.value = true
  try {
    await triggerEvaluation(projectId.value, {
      top_k: evalTopK.value,
      strategy: evalCategory.value === 'rerank' ? undefined : evalStrategy.value,
      category: evalCategory.value,
      remark: evalRemark.value,
    })
    message.success('评估已触发')
    evalModalVisible.value = false
    await fetchHistory()
  } catch {
    message.error('触发评估失败')
  } finally {
    evalLoading.value = false
  }
}

// ---- 编辑评估 ----
const editModalVisible = ref(false)
const editLoading = ref(false)
const editId = ref('')
const editStrategy = ref<RetrievalStrategy>('hybrid')
const editRemark = ref('')

function showEditModal(record: EvaluationStatsResult) {
  editId.value = record.id
  editStrategy.value = record.strategy as RetrievalStrategy
  editRemark.value = record.remark
  editModalVisible.value = true
}

async function handleEdit() {
  editLoading.value = true
  try {
    await updateEvaluation(projectId.value, editId.value, {
      strategy: editStrategy.value,
      remark: editRemark.value,
    })
    message.success('更新成功')
    editModalVisible.value = false
    await fetchHistory()
  } catch {
    message.error('更新失败')
  } finally {
    editLoading.value = false
  }
}

async function handleDelete(record: EvaluationStatsResult) {
  try {
    await deleteEvaluation(projectId.value, record.id)
    message.success('删除成功')
    await fetchHistory()
  } catch {
    message.error('删除失败')
  }
}

onMounted(fetchHistory)

watch(() => pageStore.refreshTrigger, fetchHistory)
watch(projectId, fetchHistory)
</script>

<style scoped>
@import '@/styles/common-table.css';

/* 表格单元格样式 */
.cell-time {
  color: var(--ant-color-text-tertiary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.cell-metric {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.metric-good {
  color: var(--ant-color-success);
}
.metric-mid {
  color: var(--ant-color-warning);
}
.metric-low {
  color: var(--ant-color-error);
}
.cell-positive {
  color: var(--ant-color-success);
  font-weight: 500;
}
.cell-negative {
  color: var(--ant-color-error);
  font-weight: 500;
}
</style>
