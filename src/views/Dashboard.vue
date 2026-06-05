<template>
  <div class="dashboard">
    <a-row :gutter="[20, 20]">
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false">
          <a-statistic title="项目总数" :value="12" suffix="个">
            <template #prefix>
              <project-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false">
          <a-statistic title="文档总数" :value="156" suffix="篇">
            <template #prefix>
              <file-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card" :bordered="false">
          <a-statistic title="今日查询" :value="1024" suffix="次">
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
          <a-table :columns="columns" :data-source="recentProjects" :pagination="false" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'updatedAt'">
                {{ formatTime(record.updatedAt) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card title="文档处理状态" :bordered="false">
          <div class="progress-wrap">
            <a-progress type="circle" :percent="85" :stroke-width="10" />
            <p class="progress-label">已处理</p>
          </div>
          <div class="progress-wrap">
            <a-progress type="circle" :percent="15" status="exception" :stroke-width="10" />
            <p class="progress-label">处理中</p>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ProjectOutlined, FileOutlined, SearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

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

const columns = [
  { title: '项目名称', dataIndex: 'name', key: 'name' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt' },
]

const recentProjects = [
  { name: '产品知识库', status: '运行中', updatedAt: '2026-06-05' },
  { name: '技术文档库', status: '运行中', updatedAt: '2026-06-04' },
  { name: '用户手册', status: '处理中', updatedAt: '2026-06-03' },
  { name: 'FAQ 集合', status: '运行中', updatedAt: '2026-06-02' },
]
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
