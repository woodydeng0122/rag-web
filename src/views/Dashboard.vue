<template>
  <div class="dashboard">
    <!-- 概览统计 -->
    <a-row :gutter="[20, 20]">
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false" loading>
          <a-statistic title="项目总数" :value="projectCount" suffix="个">
            <template #prefix>
              <project-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false" loading>
          <a-statistic title="文档总数" :value="docCount" suffix="篇">
            <template #prefix>
              <file-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false">
          <a-statistic title="今日查询" value="--" suffix="次">
            <template #prefix>
              <search-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 评估指标卡片 -->
    <div v-if="activeProjectStore.hasActiveProject" class="metrics-row">
      <a-spin :spinning="evalLoading" size="small">
        <template v-if="latestEval">
          <div class="metrics-row__inner">
            <div class="metric-card">
              <div class="metric-card__header">
                <span class="metric-card__label">Recall@k</span>
                <span class="metric-card__badge" :class="recallTrend">Recall</span>
              </div>
              <div class="metric-card__value">{{ formatPercent(latestEval.recall_at_k) }}</div>
              <div v-if="evalHistory.length >= 2" class="metric-card__trend">
                <arrow-up-outlined v-if="recallDiff > 0" class="trend-icon trend-up" />
                <arrow-down-outlined v-else-if="recallDiff < 0" class="trend-icon trend-down" />
                <span :class="recallDiff > 0 ? 'trend-up' : recallDiff < 0 ? 'trend-down' : ''">
                  {{ recallDiff === 0 ? '-' : formatPercent(Math.abs(recallDiff)) }}
                </span>
                <span class="trend-label">较上次</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-card__header">
                <span class="metric-card__label">MRR</span>
                <span class="metric-card__badge badge-green">MRR</span>
              </div>
              <div class="metric-card__value">{{ formatPercent(latestEval.mrr) }}</div>
              <div v-if="evalHistory.length >= 2" class="metric-card__trend">
                <arrow-up-outlined v-if="mrrDiff > 0" class="trend-icon trend-up" />
                <arrow-down-outlined v-else-if="mrrDiff < 0" class="trend-icon trend-down" />
                <span :class="mrrDiff > 0 ? 'trend-up' : mrrDiff < 0 ? 'trend-down' : ''">
                  {{ mrrDiff === 0 ? '-' : formatPercent(Math.abs(mrrDiff)) }}
                </span>
                <span class="trend-label">较上次</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-card__header">
                <span class="metric-card__label">命中率</span>
                <span class="metric-card__badge badge-orange">Hit</span>
              </div>
              <div class="metric-card__value">{{ formatPercent(latestEval.hit_rate) }}</div>
              <div class="metric-card__sub">
                完全命中 {{ latestEval.full_hit_count }} / 非完全命中 {{ nonFullHitCount }} / 零命中 {{ latestEval.zero_hit_count }}
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-card__header">
                <span class="metric-card__label">平均延迟</span>
                <span class="metric-card__badge badge-purple">Latency</span>
              </div>
              <div class="metric-card__value">{{ latestEval.avg_latency_ms.toFixed(0) }}<span class="metric-card__unit">ms</span></div>
              <div class="metric-card__sub">
                top_k = {{ latestEval.top_k }}
              </div>
            </div>
          </div>
        </template>
        <div v-else-if="!evalLoading" class="metrics-row__empty">
          <span class="metrics-row__empty-text">暂无评估数据</span>
          <a-button type="link" size="small" @click="goEvaluation">前往评估</a-button>
        </div>
      </a-spin>
    </div>

    <!-- 趋势折线图 -->
    <div v-if="activeProjectStore.hasActiveProject && sortedEvalHistory.length >= 2" class="chart-section">
      <div class="section-header">
        <h2 class="section-title">指标趋势</h2>
        <div class="chart-legend">
          <span class="legend-item">
            <span class="legend-line" style="background: #1677ff" /> Recall@k
          </span>
          <span class="legend-item">
            <span class="legend-line" style="background: #52c41a" /> MRR
          </span>
        </div>
      </div>
      <div class="chart-container">
        <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="trend-chart">
          <defs>
            <linearGradient id="recallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1677ff" stop-opacity="0.15" />
              <stop offset="100%" stop-color="#1677ff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#52c41a" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#52c41a" stop-opacity="0" />
            </linearGradient>
          </defs>

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
            :x="chartPadding - 10"
            :y="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4 + 4"
            text-anchor="end"
            font-size="11"
            fill="#bbb"
            font-family="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            {{ (1 - (i - 1) / 4).toFixed(2) }}
          </text>

          <!-- Recall 面积填充 -->
          <polygon
            :points="recallAreaPoints"
            fill="url(#recallGradient)"
          />

          <!-- MRR 面积填充 -->
          <polygon
            :points="mrrAreaPoints"
            fill="url(#mrrGradient)"
          />

          <!-- recall 折线 -->
          <polyline
            :points="recallPoints"
            fill="none"
            stroke="#1677ff"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- recall 数据点 -->
          <circle
            v-for="(p, i) in recallPointList"
            :key="`recall-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="4.5"
            fill="#fff"
            stroke="#1677ff"
            stroke-width="2.5"
          />

          <!-- MRR 折线 -->
          <polyline
            :points="mrrPoints"
            fill="none"
            stroke="#52c41a"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- MRR 数据点 -->
          <circle
            v-for="(p, i) in mrrPointList"
            :key="`mrr-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="4.5"
            fill="#fff"
            stroke="#52c41a"
            stroke-width="2.5"
          />

          <!-- X轴标签 -->
          <text
            v-for="(item, i) in sortedEvalHistory"
            :key="`xlabel-${i}`"
            :x="chartPadding + i * xStep"
            :y="chartHeight - 6"
            text-anchor="middle"
            font-size="11"
            fill="#bbb"
            font-family="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            {{ formatShortDate(item.created_at) }}
          </text>
        </svg>
      </div>
    </div>

    <a-row :gutter="20" style="margin-top: 20px">
      <a-col :span="14">
        <a-card title="最近项目" :bordered="false">
          <a-table :columns="columns" :data-source="recentProjects" :pagination="false" size="middle" :loading="loading">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'updated_at'">
                {{ formatTime(record.updated_at) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card title="文档处理状态" :bordered="false">
          <div class="progress-wrap">
            <a-progress type="circle" :percent="readyPercent" :stroke-width="10" />
            <p class="progress-label">已处理 ({{ readyCount }}/{{ docCount }})</p>
          </div>
          <div class="progress-wrap">
            <a-progress type="circle" :percent="processingPercent" status="active" :stroke-width="10" />
            <p class="progress-label">处理中 ({{ processingCount }})</p>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProjectOutlined, FileOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { getProjectList, getEvaluationHistory } from '@/api/project'
import { getDocumentList } from '@/api/document'
import type { ProjectItem, EvaluationStatsResult } from '@/api/model/projectModel'
import type { DocumentItem } from '@/api/model/documentModel'

dayjs.locale('zh-cn')

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const loading = ref(false)
const projects = ref<ProjectItem[]>([])
const allDocs = ref<DocumentItem[]>([])

// 评估指标数据
const evalLoading = ref(false)
const evalHistory = ref<EvaluationStatsResult[]>([])

const sortedEvalHistory = computed(() =>
  [...evalHistory.value].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf())
)

const latestEval = computed(() =>
  sortedEvalHistory.value.length > 0 ? sortedEvalHistory.value[sortedEvalHistory.value.length - 1] : null
)

const previousEval = computed(() =>
  sortedEvalHistory.value.length >= 2 ? sortedEvalHistory.value[sortedEvalHistory.value.length - 2] : null
)

const nonFullHitCount = computed(() => {
  if (!latestEval.value) return 0
  return latestEval.value.golden_total - latestEval.value.full_hit_count - latestEval.value.zero_hit_count
})

const recallDiff = computed(() => {
  if (!latestEval.value || !previousEval.value) return 0
  return latestEval.value.recall_at_k - previousEval.value.recall_at_k
})

const mrrDiff = computed(() => {
  if (!latestEval.value || !previousEval.value) return 0
  return latestEval.value.mrr - previousEval.value.mrr
})

const recallTrend = computed(() => {
  if (recallDiff.value > 0) return 'badge-blue'
  if (recallDiff.value < 0) return 'badge-red'
  return 'badge-gray'
})

// 折线图参数
const chartWidth = 700
const chartHeight = 280
const chartPadding = 50

const xStep = computed(() => {
  const n = sortedEvalHistory.value.length
  return n > 1 ? (chartWidth - 2 * chartPadding) / (n - 1) : 0
})

const recallPointList = computed(() => {
  const points: { x: number; y: number }[] = []
  const h = chartHeight - 2 * chartPadding
  sortedEvalHistory.value.forEach((item, i) => {
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
  sortedEvalHistory.value.forEach((item, i) => {
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

const recallAreaPoints = computed(() => {
  const pts = recallPointList.value
  if (pts.length === 0) return ''
  const h = chartHeight - chartPadding
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${first.x},${h} ${pts.map(p => `${p.x},${p.y}`).join(' ')} ${last.x},${h}`
})

const mrrAreaPoints = computed(() => {
  const pts = mrrPointList.value
  if (pts.length === 0) return ''
  const h = chartHeight - chartPadding
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${first.x},${h} ${pts.map(p => `${p.x},${p.y}`).join(' ')} ${last.x},${h}`
})

function formatPercent(value: number) {
  return (value * 100).toFixed(2) + '%'
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return ''
  return dayjs(dateStr).format('MM-DD HH:mm')
}

function goEvaluation() {
  const pid = activeProjectStore.activeProjectId
  if (pid) {
    router.push(`/projects/${pid}/evaluation`)
  }
}

// 概览统计
const projectCount = computed(() => projects.value.length)
const docCount = computed(() => allDocs.value.length)

const readyCount = computed(() => allDocs.value.filter(d => d.status === 'ready').length)
const processingCount = computed(() => allDocs.value.filter(d => ['chunking', 'embedding', 'processing'].includes(d.status)).length)
const readyPercent = computed(() => {
  if (docCount.value === 0) return 0
  return Math.round((readyCount.value / docCount.value) * 100)
})
const processingPercent = computed(() => {
  if (docCount.value === 0) return 0
  return Math.round((processingCount.value / docCount.value) * 100)
})

const recentProjects = computed(() =>
  [...projects.value]
    .sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf())
    .slice(0, 5)
)

const columns = [
  { title: '项目名称', dataIndex: 'name', key: 'name' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
]

function formatTime(dateStr: string) {
  if (!dateStr) return '--'
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffMs = now.diff(d, 'millisecond')
  if (diffMs < 60 * 1000) return '刚刚'
  if (diffMs < 3600 * 1000) return `${Math.floor(diffMs / 60000)} 分钟前`
  if (diffMs < 24 * 3600 * 1000) return `${Math.floor(diffMs / 3600000)} 小时前`
  if (diffMs < 7 * 24 * 3600 * 1000) return `${Math.floor(diffMs / 86400000)} 天前`
  return d.format('YYYY-MM-DD HH:mm')
}

async function fetchEvalData() {
  const pid = activeProjectStore.activeProjectId
  if (!pid) return
  evalLoading.value = true
  try {
    const res = await getEvaluationHistory(pid)
    evalHistory.value = res || []
  } catch {
    evalHistory.value = []
  } finally {
    evalLoading.value = false
  }
}

async function fetchDashboardData() {
  loading.value = true
  try {
    const projectList = await getProjectList()
    projects.value = projectList || []

    const docPromises = projects.value.map(p => getDocumentList(p.id))
    const docResults = await Promise.all(docPromises)
    allDocs.value = docResults.flat()
  } catch {
    // 静默处理
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
  fetchEvalData()
})

watch(() => pageStore.refreshTrigger, () => {
  fetchDashboardData()
  fetchEvalData()
})

watch(() => activeProjectStore.activeProjectId, (newId) => {
  if (newId) fetchEvalData()
  else evalHistory.value = []
})
</script>

<style scoped>
.stat-card {
  border-radius: 10px;
}
.stat-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
}
.stat-card :deep(.ant-statistic-title) {
  font-size: 13px;
  color: #666;
}
.stat-card :deep(.ant-statistic-content) {
  font-size: 24px;
  font-weight: 600;
}
.stat-card :deep(.ant-statistic-content-prefix) {
  margin-right: 12px;
  font-size: 20px;
  color: #1677ff;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}
.progress-label {
  margin-top: 12px;
  font-size: 13px;
  color: #666;
}

/* 评估指标卡片 */
.metrics-row {
  margin-top: 20px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 20px;
}
.metrics-row__inner {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.metrics-row__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
}
.metrics-row__empty-text {
  font-size: 13px;
  color: #bbb;
}

.metric-card {
  padding: 4px 0;
}
.metric-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.metric-card__label {
  font-size: 13px;
  color: #888;
  font-weight: 500;
}
.metric-card__badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: 0.02em;
}
.badge-blue {
  background: rgba(22, 119, 255, 0.08);
  color: #1677ff;
}
.badge-green {
  background: rgba(82, 196, 26, 0.08);
  color: #52c41a;
}
.badge-orange {
  background: rgba(250, 173, 20, 0.08);
  color: #faad14;
}
.badge-purple {
  background: rgba(114, 46, 209, 0.08);
  color: #722ed1;
}
.badge-red {
  background: rgba(255, 77, 79, 0.08);
  color: #ff4d4f;
}
.badge-gray {
  background: rgba(0, 0, 0, 0.04);
  color: #999;
}
.metric-card__value {
  font-size: 28px;
  font-weight: 700;
  color: #111;
  letter-spacing: -0.03em;
  line-height: 1.2;
}
.metric-card__unit {
  font-size: 14px;
  font-weight: 500;
  color: #999;
  margin-left: 2px;
}
.metric-card__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
}
.trend-icon {
  font-size: 11px;
}
.trend-up {
  color: #52c41a;
}
.trend-down {
  color: #ff4d4f;
}
.trend-label {
  color: #bbb;
  margin-left: 2px;
}
.metric-card__sub {
  font-size: 12px;
  color: #bbb;
  margin-top: 6px;
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

/* 趋势图 */
.chart-section {
  margin-top: 20px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 24px;
}
.chart-container {
  max-width: 680px;
  margin: 0 auto;
}
.trend-chart {
  width: 100%;
  height: auto;
}
.chart-legend {
  display: flex;
  gap: 20px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #999;
}
.legend-line {
  width: 16px;
  height: 3px;
  border-radius: 2px;
  display: inline-block;
}

@media (max-width: 768px) {
  .metrics-row__inner {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
