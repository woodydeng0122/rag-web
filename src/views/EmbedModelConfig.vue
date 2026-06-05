<template>
  <div class="embed-model-config">
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">嵌入模型配置</h2>
      </div>
      <div class="toolbar-right">
        <a-button type="primary" :loading="checkingStatus" @click="handleCheckStatus">
          <template #icon><reload-outlined /></template>
          刷新状态
        </a-button>
      </div>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-spin :spinning="loading">
        <a-table
          :columns="columns"
          :data-source="models"
          row-key="id"
          :pagination="false"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="model-name">{{ record.name }}</span>
            </template>
            <template v-if="column.key === 'dimension'">
              <a-tag color="blue">{{ record.dimension }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'online' ? 'success' : 'default'">
                {{ record.status === 'online' ? '在线' : '离线' }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <a-empty v-if="!loading && models.length === 0" description="暂无模型，请将模型文件放入 models/ 目录后刷新状态" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { getEmbedModelList, refreshEmbedModelStatus } from '@/api/embedModel'
import type { EmbedModelItem } from '@/api/model/embedModelModel'

const loading = ref(false)
const checkingStatus = ref(false)
const models = ref<EmbedModelItem[]>([])

const columns = [
  { title: '模型名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '维度', dataIndex: 'dimension', key: 'dimension', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180 },
]

async function fetchModels() {
  loading.value = true
  try {
    const res = await getEmbedModelList()
    models.value = res.models || []
  } catch {
    message.error('获取模型列表失败')
  } finally {
    loading.value = false
  }
}

async function handleCheckStatus() {
  checkingStatus.value = true
  try {
    const res = await refreshEmbedModelStatus()
    models.value = res.models || []
    message.success('状态已刷新')
  } catch {
    message.error('刷新状态失败')
  } finally {
    checkingStatus.value = false
  }
}

onMounted(fetchModels)
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.table-card {
  border-radius: 10px;
}
.model-name {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font-size: 13px;
}
</style>
