<template>
  <div class="ragas-evaluation">
    <!-- 工具栏 -->
    <PageToolbar title="RAGAS 评估">
      <template #actions>
        <a-button type="primary" :loading="evalLoading" @click="showEvalModal">
          <template #icon><plus-outlined /></template>
          新增评估
        </a-button>
      </template>
    </PageToolbar>

    <!-- 最新指标卡片 -->
    <div v-if="latestEvaluation" class="metrics-row">
      <MetricCard
        title="上下文召回率"
        tag="Context Recall"
        tag-color="blue"
        :value="formatPercent(latestEvaluation.context_recall)"
        :diff="latestEvaluation.context_recall - prevEvaluation?.context_recall!"
        :show-diff="!!prevEvaluation"
        :format-diff="formatPercentDiff"
      />
      <MetricCard
        title="上下文精确率"
        tag="Context Precision"
        tag-color="cyan"
        :value="formatPercent(latestEvaluation.context_precision)"
        :diff="latestEvaluation.context_precision - prevEvaluation?.context_precision!"
        :show-diff="!!prevEvaluation"
        :format-diff="formatPercentDiff"
      />
      <MetricCard
        title="忠实度"
        tag="Faithfulness"
        tag-color="green"
        :value="formatPercent(latestEvaluation.faithfulness)"
        :diff="latestEvaluation.faithfulness - prevEvaluation?.faithfulness!"
        :show-diff="!!prevEvaluation"
        :format-diff="formatPercentDiff"
      />
      <MetricCard
        title="答案相关性"
        tag="Answer Relevancy"
        tag-color="purple"
        :value="formatPercent(latestEvaluation.answer_relevancy)"
        :diff="latestEvaluation.answer_relevancy - prevEvaluation?.answer_relevancy!"
        :show-diff="!!prevEvaluation"
        :format-diff="formatPercentDiff"
      />
    </div>

    <!-- 历史记录表格 -->
    <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
      <a-spin :spinning="loading">
        <a-table
          :columns="columns"
          :data-source="history"
          :pagination="false"
          row-key="id"
          size="middle"
          :locale="{ emptyText: '暂无 RAGAS 评估记录，运行评估后历史记录将显示在此处' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'created_at'">
              <span class="cell-time">{{ formatDateTime(record.created_at) }}</span>
            </template>
            <template v-else-if="column.key === 'strategy'">
              <a-tag :color="strategyTagColor(record.strategy)">{{ strategyLabel(record.strategy) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'context_recall'">
              <span class="cell-metric" :class="getMetricClass(record.context_recall)">
                {{ formatPercent(record.context_recall) }}
              </span>
            </template>
            <template v-else-if="column.key === 'context_precision'">
              <span class="cell-metric" :class="getMetricClass(record.context_precision)">
                {{ formatPercent(record.context_precision) }}
              </span>
            </template>
            <template v-else-if="column.key === 'faithfulness'">
              <span class="cell-metric" :class="getMetricClass(record.faithfulness)">
                {{ formatPercent(record.faithfulness) }}
              </span>
            </template>
            <template v-else-if="column.key === 'answer_relevancy'">
              <span class="cell-metric" :class="getMetricClass(record.answer_relevancy)">
                {{ formatPercent(record.answer_relevancy) }}
              </span>
            </template>
            <template v-else-if="column.key === 'avg_latency_ms'">
              <span :class="record.avg_latency_ms > 3000 ? 'cell-negative' : ''">
                {{ record.avg_latency_ms.toFixed(0) }}
              </span>
            </template>
            <template v-else-if="column.key === 'ttfb_ms'">
              <span :class="record.ttfb_ms > 2000 ? 'cell-negative' : ''">
                {{ record.ttfb_ms.toFixed(0) }}
              </span>
            </template>
            <template v-else-if="column.key === 'remark'">
              <span>{{ record.remark || '--' }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-popconfirm title="确定删除此评估记录？" ok-text="确定" cancel-text="取消" @confirm="handleDelete(record)">
                <a-button size="small" danger type="link">删除</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <!-- 新增评估弹窗 -->
    <a-modal
      v-model:open="evalModalVisible"
      title="新增 RAGAS 评估"
      :confirm-loading="evalLoading"
      ok-text="开始评估"
      cancel-text="取消"
      @ok="handleEval"
    >
      <a-alert
        type="info"
        show-icon
        message="RAGAS 评估使用 LLM-as-Judge，每条黄金记录都会调用 LLM 评测，可能需要较长时间。"
        style="margin-bottom: 16px"
      />
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="检索策略" required>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { dayjs } from '@/utils/time'
import { getRagasEvaluationHistory, triggerRagasEvaluation, deleteRagasEvaluation } from '@/api/ragasEvaluation'
import type { RagasEvaluationResult } from '@/api/model/ragasEvaluationModel'
import PageToolbar from '@/components/PageToolbar.vue'
import MetricCard from '@/components/MetricCard.vue'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'

const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const projectId = computed(() => activeProjectStore.activeProjectId)

const loading = ref(false)
const history = ref<RagasEvaluationResult[]>([])

const latestEvaluation = computed(() => history.value[0] ?? null)
const prevEvaluation = computed(() => history.value[1] ?? null)

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150 },
  { title: '策略', dataIndex: 'strategy', key: 'strategy', width: 100 },
  { title: 'top_k', dataIndex: 'top_k', key: 'top_k', width: 70, align: 'center' as const },
  { title: 'Context Recall', dataIndex: 'context_recall', key: 'context_recall', width: 130, align: 'right' as const },
  { title: 'Context Precision', dataIndex: 'context_precision', key: 'context_precision', width: 140, align: 'right' as const },
  { title: 'Faithfulness', dataIndex: 'faithfulness', key: 'faithfulness', width: 120, align: 'right' as const },
  { title: 'Answer Relevancy', dataIndex: 'answer_relevancy', key: 'answer_relevancy', width: 140, align: 'right' as const },
  { title: '黄金记录', dataIndex: 'golden_total', key: 'golden_total', width: 80, align: 'center' as const },
  { title: '延迟(ms)', dataIndex: 'avg_latency_ms', key: 'avg_latency_ms', width: 90, align: 'right' as const },
  { title: 'TTFB(ms)', dataIndex: 'ttfb_ms', key: 'ttfb_ms', width: 90, align: 'right' as const },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 160 },
  { title: '操作', key: 'action', width: 80 },
]

function formatDateTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatPercentDiff(value: number) {
  return `${(value * 100).toFixed(1)}%`
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
    const res = await getRagasEvaluationHistory(pid)
    history.value = res || []
  } catch {
    message.error('获取 RAGAS 评估历史失败')
  } finally {
    loading.value = false
  }
}

// ---- 新增评估 ----
const evalModalVisible = ref(false)
const evalTopK = ref(3)
const evalStrategy = ref('hybrid')
const evalRemark = ref('')
const evalLoading = ref(false)

function showEvalModal() {
  evalStrategy.value = 'hybrid'
  evalTopK.value = 3
  evalRemark.value = ''
  evalModalVisible.value = true
}

async function handleEval() {
  const pid = projectId.value
  if (!pid) {
    message.warning('请先选择项目')
    return
  }
  evalLoading.value = true
  try {
    await triggerRagasEvaluation(pid, {
      top_k: evalTopK.value,
      strategy: evalStrategy.value,
      remark: evalRemark.value,
    })
    message.success('RAGAS 评估已完成')
    evalModalVisible.value = false
    await fetchHistory()
  } catch {
    message.error('RAGAS 评估失败')
  } finally {
    evalLoading.value = false
  }
}

async function handleDelete(record: RagasEvaluationResult) {
  try {
    await deleteRagasEvaluation(projectId.value, record.id)
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

.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 1200px) {
  .metrics-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .metrics-row {
    grid-template-columns: 1fr;
  }
}

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
.cell-negative {
  color: var(--ant-color-error);
  font-weight: 500;
}
.form-hint {
  display: block;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
  line-height: 1.4;
}
</style>
