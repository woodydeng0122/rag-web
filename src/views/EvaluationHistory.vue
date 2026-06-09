<template>
  <div class="evaluation-history">
    <div class="page-header">
      <span class="page-title">评估历史</span>
      <a-button @click="router.push('/projects')">返回项目列表</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-table
        v-if="history.length > 0"
        :columns="columns"
        :data-source="history"
        :pagination="false"
        row-key="id"
        size="middle"
      />

      <a-empty v-else description="暂无评估记录" />

      <!-- 趋势折线图 -->
      <div v-if="history.length >= 2" class="chart-section">
        <a-divider>指标趋势</a-divider>
        <div class="chart-container">
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="trend-chart">
            <!-- 网格线 -->
            <line
              v-for="i in 5"
              :key="`grid-${i}`"
              :x1="chartPadding"
              :y1="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
              :x2="chartWidth - chartPadding"
              :y2="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
              stroke="#f0f0f0"
              stroke-width="1"
            />
            <!-- Y轴标签 -->
            <text
              v-for="i in 5"
              :key="`ylabel-${i}`"
              :x="chartPadding - 8"
              :y="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4 + 4"
              text-anchor="end"
              font-size="11"
              fill="#999"
            >
              {{ (1 - (i - 1) / 4).toFixed(2) }}
            </text>
            <!-- recall 折线 -->
            <polyline
              :points="recallPoints"
              fill="none"
              stroke="#1677ff"
              stroke-width="2"
            />
            <!-- recall 数据点 -->
            <circle
              v-for="(p, i) in recallPointList"
              :key="`recall-${i}`"
              :cx="p.x"
              :cy="p.y"
              r="4"
              fill="#1677ff"
            />
            <!-- MRR 折线 -->
            <polyline
              :points="mrrPoints"
              fill="none"
              stroke="#52c41a"
              stroke-width="2"
            />
            <!-- MRR 数据点 -->
            <circle
              v-for="(p, i) in mrrPointList"
              :key="`mrr-${i}`"
              :cx="p.x"
              :cy="p.y"
              r="4"
              fill="#52c41a"
            />
            <!-- X轴标签 -->
            <text
              v-for="(item, i) in history"
              :key="`xlabel-${i}`"
              :x="chartPadding + i * xStep"
              :y="chartHeight - 4"
              text-anchor="middle"
              font-size="10"
              fill="#999"
            >
              {{ formatShortDate(item.created_at) }}
            </text>
          </svg>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot" style="background: #1677ff" /> Recall@k</span>
            <span class="legend-item"><span class="legend-dot" style="background: #52c41a" /> MRR</span>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { getEvaluationHistory } from '@/api/project'
import type { EvaluationStatsResult } from '@/api/model/projectModel'

dayjs.locale('zh-cn')

const router = useRouter()
const route = useRoute()
const projectId = route.params.id as string

const loading = ref(false)
const history = ref<EvaluationStatsResult[]>([])

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', customRender: ({ text }: any) => formatDateTime(text) },
  { title: 'top_k', dataIndex: 'top_k', key: 'top_k', width: 70 },
  { title: 'Recall@k', dataIndex: 'recall_at_k', key: 'recall_at_k', customRender: ({ text }: any) => text.toFixed(4), width: 100 },
  { title: 'MRR', dataIndex: 'mrr', key: 'mrr', customRender: ({ text }: any) => text.toFixed(4), width: 90 },
  { title: '命中率', dataIndex: 'hit_rate', key: 'hit_rate', customRender: ({ text }: any) => text.toFixed(4), width: 90 },
  { title: '完全命中', dataIndex: 'full_hit_count', key: 'full_hit_count', width: 80 },
  { title: '零命中', dataIndex: 'zero_hit_count', key: 'zero_hit_count', width: 70 },
  { title: '黄金记录', dataIndex: 'golden_total', key: 'golden_total', width: 80 },
  { title: '已检索', dataIndex: 'golden_retrieved', key: 'golden_retrieved', width: 70 },
  { title: '平均延迟(ms)', dataIndex: 'avg_latency_ms', key: 'avg_latency_ms', customRender: ({ text }: any) => text.toFixed(0), width: 100 },
  { title: '嵌入模型', dataIndex: 'embed_model_name', key: 'embed_model_name', width: 160 },
]

// 折线图参数
const chartWidth = 600
const chartHeight = 260
const chartPadding = 50

const xStep = computed(() => {
  const n = history.value.length
  return n > 1 ? (chartWidth - 2 * chartPadding) / (n - 1) : 0
})

const recallPointList = computed(() => {
  const points: { x: number; y: number }[] = []
  const h = chartHeight - 2 * chartPadding
  history.value.forEach((item, i) => {
    points.push({
      x: chartPadding + i * xStep.value,
      y: chartPadding + h * (1 - item.recall_at_k),
    })
  })
  return points
})

const mrrPointList = computed(() => {
  const points: { x: number; y: number }[] = []
  const h = chartHeight - 2 * chartPadding
  history.value.forEach((item, i) => {
    points.push({
      x: chartPadding + i * xStep.value,
      y: chartPadding + h * (1 - item.mrr),
    })
  })
  return points
})

const recallPoints = computed(() =>
  recallPointList.value.map(p => `${p.x},${p.y}`).join(' ')
)

const mrrPoints = computed(() =>
  mrrPointList.value.map(p => `${p.x},${p.y}`).join(' ')
)

function formatDateTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return ''
  return dayjs(dateStr).format('MM-DD HH:mm')
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
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.chart-section {
  margin-top: 24px;
}

.chart-container {
  max-width: 640px;
  margin: 0 auto;
}

.trend-chart {
  width: 100%;
  height: auto;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
</style>
