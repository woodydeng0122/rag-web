<template>
  <div class="evaluation-history">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">评估历史</h1>
      </div>
      <a-button type="primary" @click="fetchHistory" :loading="loading">
        <template #icon><reload-outlined /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <!-- 空状态 -->
      <div v-if="!loading && history.length === 0" class="empty-state">
        <div class="empty-state__icon">
          <bar-chart-outlined />
        </div>
        <p class="empty-state__title">暂无评估记录</p>
        <p class="empty-state__desc">运行评估后，历史记录将显示在此处</p>
      </div>

      <!-- 评估记录表格 -->
      <div v-else class="table-section">
        <div class="section-header">
          <h2 class="section-title">评估记录</h2>
          <span class="section-count">{{ history.length }} 条记录</span>
        </div>
        <a-table
          :columns="columns"
          :data-source="history"
          :pagination="false"
          row-key="id"
          size="middle"
          class="eval-table"
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
              <span class="cell-model">{{ record.embed_model_name }}</span>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { getEvaluationHistory } from '@/api/project'
import type { EvaluationStatsResult } from '@/api/model/projectModel'

dayjs.locale('zh-cn')

const route = useRoute()
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

onMounted(fetchHistory)
</script>

<style scoped>
.evaluation-history {
  max-width: 1200px;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}
.page-header__title {
  font-size: 22px;
  font-weight: 700;
  color: #111;
  margin: 0;
  letter-spacing: -0.02em;
}
.page-header__info {
  display: flex;
  flex-direction: column;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  text-align: center;
}
.empty-state__icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #ccc;
  margin-bottom: 16px;
}
.empty-state__title {
  font-size: 15px;
  font-weight: 600;
  color: #666;
  margin: 0 0 4px;
}
.empty-state__desc {
  font-size: 13px;
  color: #bbb;
  margin: 0;
}

/* 区块标题 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}
.section-count {
  font-size: 12px;
  color: #bbb;
}

/* 表格区块 */
.table-section {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 24px;
}
.eval-table :deep(.ant-table) {
  border-radius: 8px;
}
.eval-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  font-size: 13px;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}
.eval-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
  border-bottom: 1px solid #f8f8f8;
}
.eval-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #fafbff;
}

/* 表格单元格样式 */
.cell-time {
  color: #666;
  font-variant-numeric: tabular-nums;
}
.cell-metric {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.metric-good {
  color: #52c41a;
}
.metric-mid {
  color: #faad14;
}
.metric-low {
  color: #ff4d4f;
}
.cell-positive {
  color: #52c41a;
  font-weight: 500;
}
.cell-negative {
  color: #ff4d4f;
  font-weight: 500;
}
.cell-model {
  font-size: 12px;
  color: #888;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
