<template>
  <div class="dashboard">
    <template v-if="activeProjectStore.hasActiveProject">
      <!-- 概览 -->
      <a-card title="概览" :bordered="false">
        <a-row :gutter="[20, 20]">
          <a-col :span="6">
            <a-statistic title="文档总数" :value="docCount" suffix="篇" :loading="loading">
              <template #prefix><file-outlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic title="黄金数据集" :value="goldenCount" suffix="条" :loading="goldenLoading">
              <template #prefix><star-outlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic title="评估历史" :value="evalCount" suffix="次" :loading="evalLoading">
              <template #prefix><history-outlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic title="今日查询" value="--" suffix="次">
              <template #prefix><search-outlined /></template>
            </a-statistic>
          </a-col>
        </a-row>
      </a-card>

      <!-- 指标 -->
      <a-card title="指标" :bordered="false" style="margin-top: 20px">
        <a-spin :spinning="evalLoading" size="small">
          <template v-if="latestEval">
            <a-row :gutter="[16, 16]">
              <a-col :span="6">
                <a-card :bordered="false" size="small">
                  <template #title>
                    <a-space :size="8">
                      <span>Recall@k</span>
                      <a-tag :color="recallDiff > 0 ? 'blue' : recallDiff < 0 ? 'red' : 'default'">Recall</a-tag>
                    </a-space>
                  </template>
                  <a-statistic :value="formatPercent(latestEval.recall_at_k)" :value-style="{ fontSize: '24px', fontWeight: 600 }" />
                  <div v-if="evalHistory.length >= 2">
                    <a-space :size="4" v-if="recallDiff !== 0">
                      <arrow-up-outlined v-if="recallDiff > 0" style="color: var(--ant-color-success)" />
                      <arrow-down-outlined v-else style="color: var(--ant-color-error)" />
                      <span :style="{ color: recallDiff > 0 ? 'var(--ant-color-success)' : 'var(--ant-color-error)', fontSize: '12px' }">
                        {{ formatPercent(Math.abs(recallDiff)) }}
                      </span>
                      <span style="color: var(--ant-color-text-quaternary); font-size: 12px">较上次</span>
                    </a-space>
                    <span v-else style="color: var(--ant-color-text-quaternary); font-size: 12px">- 较上次</span>
                  </div>
                </a-card>
              </a-col>
              <a-col :span="6">
                <a-card :bordered="false" size="small">
                  <template #title>
                    <a-space :size="8">
                      <span>MRR</span>
                      <a-tag color="green">MRR</a-tag>
                    </a-space>
                  </template>
                  <a-statistic :value="formatPercent(latestEval.mrr)" :value-style="{ fontSize: '24px', fontWeight: 600 }" />
                  <div v-if="evalHistory.length >= 2">
                    <a-space :size="4" v-if="mrrDiff !== 0">
                      <arrow-up-outlined v-if="mrrDiff > 0" style="color: var(--ant-color-success)" />
                      <arrow-down-outlined v-else style="color: var(--ant-color-error)" />
                      <span :style="{ color: mrrDiff > 0 ? 'var(--ant-color-success)' : 'var(--ant-color-error)', fontSize: '12px' }">
                        {{ formatPercent(Math.abs(mrrDiff)) }}
                      </span>
                      <span style="color: var(--ant-color-text-quaternary); font-size: 12px">较上次</span>
                    </a-space>
                    <span v-else style="color: var(--ant-color-text-quaternary); font-size: 12px">- 较上次</span>
                  </div>
                </a-card>
              </a-col>
              <a-col :span="6">
                <a-card :bordered="false" size="small">
                  <template #title>
                    <a-space :size="8">
                      <span>命中率</span>
                      <a-tag color="orange">Hit</a-tag>
                    </a-space>
                  </template>
                  <a-statistic :value="formatPercent(latestEval.hit_rate)" :value-style="{ fontSize: '24px', fontWeight: 600 }" />
                  <div style="color: var(--ant-color-text-tertiary); font-size: 12px; margin-top: 4px">
                    完全命中 {{ latestEval.full_hit_count }} / 非完全命中 {{ nonFullHitCount }} / 零命中 {{ latestEval.zero_hit_count }}
                  </div>
                </a-card>
              </a-col>
              <a-col :span="6">
                <a-card :bordered="false" size="small">
                  <template #title>
                    <a-space :size="8">
                      <span>平均延迟</span>
                      <a-tag color="purple">Latency</a-tag>
                    </a-space>
                  </template>
                  <a-statistic :value="latestEval.avg_latency_ms.toFixed(0)" suffix="ms" :value-style="{ fontSize: '24px', fontWeight: 600 }" />
                  <div style="color: var(--ant-color-text-tertiary); font-size: 12px; margin-top: 4px">
                    top_k = {{ latestEval.top_k }}
                  </div>
                </a-card>
              </a-col>
            </a-row>
          </template>
          <a-empty v-else-if="!evalLoading" description="暂无评估数据">
            <a-button type="primary" size="small" @click="goEvaluation">前往评估</a-button>
          </a-empty>
        </a-spin>

        <!-- 趋势折线图 -->
        <div v-if="sortedEvalHistory.length >= 2" style="margin-top: 24px">
          <a-divider />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
            <span style="font-size: 14px; font-weight: 500; color: var(--ant-color-text)">指标趋势</span>
            <a-space :size="16">
              <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ant-color-text-tertiary)">
                <span style="width: 16px; height: 3px; border-radius: 2px; background: var(--ant-color-primary); display: inline-block" /> Recall@k
              </span>
              <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ant-color-text-tertiary)">
                <span style="width: 16px; height: 3px; border-radius: 2px; background: var(--ant-color-success); display: inline-block" /> MRR
              </span>
            </a-space>
          </div>
          <div style="max-width: 680px; margin: 0 auto">
            <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" style="width: 100%; height: auto">
              <defs>
                <linearGradient id="recallGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" :stop-color="getCssVar('--ant-color-primary')" stop-opacity="0.15" />
                  <stop offset="100%" :stop-color="getCssVar('--ant-color-primary')" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" :stop-color="getCssVar('--ant-color-success')" stop-opacity="0.12" />
                  <stop offset="100%" :stop-color="getCssVar('--ant-color-success')" stop-opacity="0" />
                </linearGradient>
              </defs>

              <line
                v-for="i in 5"
                :key="`grid-${i}`"
                :x1="chartPadding"
                :y1="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
                :x2="chartWidth - chartPadding"
                :y2="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
                :stroke="getCssVar('--ant-color-border-secondary')"
                stroke-width="1"
              />

              <text
                v-for="i in 5"
                :key="`ylabel-${i}`"
                :x="chartPadding - 10"
                :y="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4 + 4"
                text-anchor="end"
                font-size="11"
                :fill="getCssVar('--ant-color-text-quaternary')"
                font-family="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                {{ (1 - (i - 1) / 4).toFixed(2) }}
              </text>

              <polygon :points="recallAreaPoints" fill="url(#recallGradient)" />
              <polygon :points="mrrAreaPoints" fill="url(#mrrGradient)" />

              <polyline :points="recallPoints" fill="none" :stroke="getCssVar('--ant-color-primary')" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle v-for="(p, i) in recallPointList" :key="`recall-${i}`" :cx="p.x" :cy="p.y" r="4.5" fill="var(--ant-color-bg-container)" :stroke="getCssVar('--ant-color-primary')" stroke-width="2.5" />

              <polyline :points="mrrPoints" fill="none" :stroke="getCssVar('--ant-color-success')" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle v-for="(p, i) in mrrPointList" :key="`mrr-${i}`" :cx="p.x" :cy="p.y" r="4.5" fill="var(--ant-color-bg-container)" :stroke="getCssVar('--ant-color-success')" stroke-width="2.5" />

              <text
                v-for="(item, i) in sortedEvalHistory"
                :key="`xlabel-${i}`"
                :x="chartPadding + i * xStep"
                :y="chartHeight - 6"
                text-anchor="middle"
                font-size="11"
                :fill="getCssVar('--ant-color-text-quaternary')"
                font-family="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                {{ formatShortDate(item.created_at) }}
              </text>
            </svg>
          </div>

          <!-- 延迟趋势图 -->
          <div style="margin-top: 24px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
              <span style="font-size: 14px; font-weight: 500; color: var(--ant-color-text)">延迟趋势</span>
              <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ant-color-text-tertiary)">
                <span style="width: 16px; height: 3px; border-radius: 2px; background: #722ed1; display: inline-block" /> Avg Latency
              </span>
            </div>
            <div style="max-width: 680px; margin: 0 auto">
              <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" style="width: 100%; height: auto">
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#722ed1" stop-opacity="0.12" />
                    <stop offset="100%" stop-color="#722ed1" stop-opacity="0" />
                  </linearGradient>
                </defs>

                <line
                  v-for="i in 5"
                  :key="`lgrid-${i}`"
                  :x1="chartPadding"
                  :y1="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
                  :x2="chartWidth - chartPadding"
                  :y2="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4"
                  :stroke="getCssVar('--ant-color-border-secondary')"
                  stroke-width="1"
                />

                <text
                  v-for="i in 5"
                  :key="`lylabel-${i}`"
                  :x="chartPadding - 10"
                  :y="chartPadding + (chartHeight - 2 * chartPadding) * (i - 1) / 4 + 4"
                  text-anchor="end"
                  font-size="11"
                  :fill="getCssVar('--ant-color-text-quaternary')"
                  font-family="-apple-system, BlinkMacSystemFont, sans-serif"
                >
                  {{ (maxLatency * (1 - (i - 1) / 4)).toFixed(0) }}
                </text>

                <polygon :points="latencyAreaPoints" fill="url(#latencyGradient)" />
                <polyline :points="latencyPoints" fill="none" stroke="#722ed1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                <circle v-for="(p, i) in latencyPointList" :key="`latency-${i}`" :cx="p.x" :cy="p.y" r="4.5" fill="var(--ant-color-bg-container)" stroke="#722ed1" stroke-width="2.5" />

                <text
                  v-for="(item, i) in sortedEvalHistory"
                  :key="`lxlabel-${i}`"
                  :x="chartPadding + i * xStep"
                  :y="chartHeight - 6"
                  text-anchor="middle"
                  font-size="11"
                  :fill="getCssVar('--ant-color-text-quaternary')"
                  font-family="-apple-system, BlinkMacSystemFont, sans-serif"
                >
                  {{ formatShortDate(item.created_at) }}
                </text>
              </svg>
            </div>
          </div>
        </div>
      </a-card>
    </template>

    <a-empty v-else description="请先选择一个项目" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FileOutlined, SearchOutlined, StarOutlined, HistoryOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons-vue'
import { dayjs } from '@/utils/time'
import { computePointList, pointsToString, areaPointsToString } from '@/utils/chart'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { getEvaluationHistory } from '@/api/project'
import { getDocumentList } from '@/api/document'
import { getGoldenList } from '@/api/golden'
import type { EvaluationStatsResult } from '@/api/model/projectModel'
import type { DocumentItem } from '@/api/model/documentModel'

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const loading = ref(false)
const docs = ref<DocumentItem[]>([])
const goldenLoading = ref(false)
const goldenCount = ref(0)

// 评估指标数据
const evalLoading = ref(false)
const evalHistory = ref<EvaluationStatsResult[]>([])
const evalCount = computed(() => evalHistory.value.length)

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

// 折线图参数
const chartWidth = 700
const chartHeight = 280
const chartPadding = 50

const xStep = computed(() => {
  const n = sortedEvalHistory.value.length
  return n > 1 ? (chartWidth - 2 * chartPadding) / (n - 1) : 0
})

const recallPointList = computed(() =>
  computePointList(sortedEvalHistory.value, item => item.recall_at_k, chartWidth, chartHeight, chartPadding, xStep.value)
)

const mrrPointList = computed(() =>
  computePointList(sortedEvalHistory.value, item => item.mrr, chartWidth, chartHeight, chartPadding, xStep.value)
)

const recallPoints = computed(() => pointsToString(recallPointList.value))

const mrrPoints = computed(() => pointsToString(mrrPointList.value))

const recallAreaPoints = computed(() => areaPointsToString(recallPointList.value, chartHeight, chartPadding))

const mrrAreaPoints = computed(() => areaPointsToString(mrrPointList.value, chartHeight, chartPadding))

// 延迟图参数
const maxLatency = computed(() => {
  const vals = sortedEvalHistory.value.map(e => e.avg_latency_ms)
  const max = Math.max(...vals)
  return max > 0 ? max : 1
})

const latencyPointList = computed(() =>
  computePointList(sortedEvalHistory.value, item => item.avg_latency_ms / maxLatency.value, chartWidth, chartHeight, chartPadding, xStep.value)
)

const latencyPoints = computed(() => pointsToString(latencyPointList.value))

const latencyAreaPoints = computed(() => areaPointsToString(latencyPointList.value, chartHeight, chartPadding))

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function formatPercent(value: number) {
  return (value * 100).toFixed(2) + '%'
}

// 项目级统计
const docCount = computed(() => docs.value.length)

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

async function fetchGoldenData() {
  const pid = activeProjectStore.activeProjectId
  if (!pid) return
  goldenLoading.value = true
  try {
    const res = await getGoldenList(pid)
    goldenCount.value = res?.length ?? 0
  } catch {
    goldenCount.value = 0
  } finally {
    goldenLoading.value = false
  }
}

async function fetchProjectData() {
  const pid = activeProjectStore.activeProjectId
  if (!pid) return
  loading.value = true
  try {
    const res = await getDocumentList(pid)
    docs.value = res?.documents ?? []
  } catch {
    docs.value = []
  } finally {
    loading.value = false
  }
}

function fetchAllData() {
  fetchProjectData()
  fetchGoldenData()
  fetchEvalData()
}

onMounted(() => {
  if (activeProjectStore.hasActiveProject) fetchAllData()
})

watch(() => pageStore.refreshTrigger, () => {
  if (activeProjectStore.hasActiveProject) fetchAllData()
})

watch(() => activeProjectStore.activeProjectId, (newId) => {
  if (newId) fetchAllData()
  else {
    docs.value = []
    goldenCount.value = 0
    evalHistory.value = []
  }
})
</script>

<style scoped>
</style>
