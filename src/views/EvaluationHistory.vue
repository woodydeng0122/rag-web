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
            <template v-else-if="column.key === 'recall_at_k'">
              <span class="cell-metric" :class="getMetricClass(record.recall_at_k)">
                {{ record.recall_at_k.toFixed(4) }}
              </span>
            </template>
            <template v-else-if="column.key === 'mrr'">
              <span class="cell-metric" :class="getMetricClass(record.mrr)">
                {{ record.mrr.toFixed(4) }}
              </span>
            </template>
            <template v-else-if="column.key === 'hit_rate'">
              <span class="cell-metric" :class="getMetricClass(record.hit_rate)">
                {{ record.hit_rate.toFixed(4) }}
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
              <template v-if="editingId === record.id">
                <a-input
                  v-model:value="editingRemark"
                  size="small"
                  style="width: 100%"
                  @pressEnter="saveRemark(record)"
                />
              </template>
              <span v-else>{{ record.remark || '--' }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="4">
                <template v-if="editingId === record.id">
                  <a-button size="small" type="link" @click="saveRemark(record)">确定</a-button>
                  <a-button size="small" type="link" @click="cancelEdit">取消</a-button>
                </template>
                <template v-else>
                  <a-button size="small" type="link" @click="startEdit(record)">编辑</a-button>
                  <a-popconfirm title="确定删除此评估记录？" ok-text="确定" cancel-text="取消" @confirm="handleDelete(record)">
                    <a-button size="small" danger type="link">删除</a-button>
                  </a-popconfirm>
                </template>
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
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
} from '@ant-design/icons-vue'
import { dayjs } from '@/utils/time'
import { getEvaluationHistory, triggerEvaluation, deleteEvaluation, updateEvaluationRemark } from '@/api/project'
import type { EvaluationStatsResult } from '@/api/model/projectModel'
import PageToolbar from '@/components/PageToolbar.vue'
import { usePageStore } from '@/store/page'

const route = useRoute()
const pageStore = usePageStore()
const projectId = route.params.id as string

const loading = ref(false)
const history = ref<EvaluationStatsResult[]>([])

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150 },
  { title: 'top_k', dataIndex: 'top_k', key: 'top_k', width: 70, align: 'center' as const },
  { title: 'Recall@k', dataIndex: 'recall_at_k', key: 'recall_at_k', width: 100, align: 'right' as const },
  { title: 'MRR', dataIndex: 'mrr', key: 'mrr', width: 90, align: 'right' as const },
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

async function fetchHistory() {
  loading.value = true
  try {
    const res = await getEvaluationHistory(projectId)
    history.value = res || []
  } catch {
    message.error('获取评估历史失败')
  } finally {
    loading.value = false
  }
}

const evalModalVisible = ref(false)
const evalLoading = ref(false)
const evalTopK = ref(10)
const evalRemark = ref('')

function showEvalModal() {
  evalTopK.value = 10
  evalRemark.value = ''
  evalModalVisible.value = true
}

async function handleEval() {
  evalLoading.value = true
  try {
    await triggerEvaluation(projectId, evalTopK.value, evalRemark.value)
    message.success('评估已触发')
    evalModalVisible.value = false
    await fetchHistory()
  } catch {
    message.error('触发评估失败')
  } finally {
    evalLoading.value = false
  }
}

// 备注编辑
const editingId = ref('')
const editingRemark = ref('')

function startEdit(record: EvaluationStatsResult) {
  editingId.value = record.id
  editingRemark.value = record.remark
}

function cancelEdit() {
  editingId.value = ''
  editingRemark.value = ''
}

async function saveRemark(record: EvaluationStatsResult) {
  try {
    await updateEvaluationRemark(projectId, record.id, editingRemark.value)
    record.remark = editingRemark.value
    editingId.value = ''
  } catch {
    message.error('更新备注失败')
  }
}

async function handleDelete(record: EvaluationStatsResult) {
  try {
    await deleteEvaluation(projectId, record.id)
    message.success('删除成功')
    await fetchHistory()
  } catch {
    message.error('删除失败')
  }
}

onMounted(fetchHistory)

watch(() => pageStore.refreshTrigger, fetchHistory)
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
