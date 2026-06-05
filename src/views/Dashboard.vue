<template>
  <div class="dashboard">
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
import { ProjectOutlined, FileOutlined, SearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { usePageStore } from '@/store/page'
import { getProjectList } from '@/api/project'
import { getDocumentList } from '@/api/document'
import type { ProjectItem } from '@/api/model/projectModel'
import type { DocumentItem } from '@/api/model/documentModel'

dayjs.locale('zh-cn')

const pageStore = usePageStore()
const loading = ref(false)
const projects = ref<ProjectItem[]>([])
const allDocs = ref<DocumentItem[]>([])

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

async function fetchDashboardData() {
  loading.value = true
  try {
    const projectList = await getProjectList()
    projects.value = projectList || []

    const docPromises = projects.value.map(p => getDocumentList(p.id))
    const docResults = await Promise.all(docPromises)
    allDocs.value = docResults.flat()
  } catch {
    // 静默处理，仪表盘数据加载失败不阻断
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

watch(() => pageStore.refreshTrigger, fetchDashboardData)
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
</style>
