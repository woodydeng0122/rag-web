<template>
  <div class="project-list">
    <div class="page-header">
      <span class="page-title">项目列表</span>
      <a-button type="primary" @click="handleCreate">
        <template #icon><plus-outlined /></template>
        新建项目
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <a-col v-for="project in projectList" :key="project.id" :xs="24" :sm="12" :md="8" :lg="6">
          <a-card
            hoverable
            class="project-card"
            :class="{ 'project-card--active': isActive(project.id) }"
            @click="handleView(project)"
          >
            <template #actions>
              <bar-chart-outlined @click.stop="handleEvaluation(project)" title="评估统计" />
              <edit-outlined @click.stop="handleEdit(project)" />
              <delete-outlined @click.stop="handleDelete(project)" />
              <a-tag v-if="isActive(project.id)" color="blue" class="active-tag">当前项目</a-tag>
              <thunderbolt-outlined v-else @click.stop="handleActivate(project)" title="激活项目" />
            </template>
            <a-card-meta :title="project.name" :description="project.description || '暂无描述'" />
            <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between">
              <a-tag color="default">{{ project.embed_model_name || '未知模型' }}</a-tag>
              <span style="font-size: 12px; color: #999">{{ formatTime(project.created_at) }}</span>
            </div>
          </a-card>
        </a-col>

        <a-col v-if="!loading && projectList.length === 0" :span="24">
          <a-empty description="暂无项目, 点击右上角新建" />
        </a-col>
      </a-row>
    </a-spin>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑项目' : '新建项目'"
      :confirm-loading="submitLoading"
      :width="560"
      ok-text="确认"
      cancel-text="取消"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
    >
      <a-form :model="formState" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="padding-top: 16px">
        <a-form-item label="项目名称" required>
          <a-input v-model:value="formState.name" placeholder="请输入项目名称" :maxlength="255" show-count />
        </a-form-item>
        <a-form-item label="嵌入模型" required>
          <a-select
            v-model:value="formState.embed_model_id"
            placeholder="请选择嵌入模型"
            :loading="embedModelStore.loading"
            :disabled="isEdit"
          >
            <a-select-option v-for="m in embedModelStore.onlineModels" :key="m.id" :value="m.id">
              {{ m.name }} ({{ m.dimension }}维)
            </a-select-option>
          </a-select>
          <span v-if="isEdit" class="form-hint">创建后不可修改</span>
        </a-form-item>
        <a-form-item label="项目描述">
          <a-textarea
            v-model:value="formState.description"
            placeholder="请输入项目描述（选填）"
            :rows="4"
            :maxlength="1000"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 评估统计 Drawer -->
    <a-drawer
      v-model:open="evalDrawerVisible"
      :title="`评估统计 - ${evalProject?.name || ''}`"
      :width="480"
    >
      <div v-if="!evalResult" style="margin-bottom: 24px">
        <a-form layout="inline">
          <a-form-item label="top_k">
            <a-input-number v-model:value="evalTopK" :min="1" :max="100" style="width: 120px" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="evalLoading" @click="handleTriggerEvaluation">
              开始评估
            </a-button>
          </a-form-item>
        </a-form>
        <p style="margin-top: 8px; font-size: 12px; color: #999">
          基于 top_k 截断已有检索结果，计算 recall@{top_k} 和 MRR
        </p>
      </div>

      <a-spin :spinning="evalLoading">
        <template v-if="evalResult">
          <a-row :gutter="[16, 16]" style="margin-bottom: 24px">
            <a-col :span="8">
              <a-statistic title="黄金记录" :value="evalResult.golden_total" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="已检索" :value="evalResult.golden_retrieved" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="命中率" :value="evalResult.hit_rate" :precision="4" suffix="" />
            </a-col>
          </a-row>

          <a-row :gutter="[16, 16]" style="margin-bottom: 24px">
            <a-col :span="8">
              <a-statistic title="完全命中" :value="evalResult.full_hit_count" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="零命中" :value="evalResult.zero_hit_count" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="嵌入模型" :value="evalResult.embed_model_name || '-'" />
            </a-col>
          </a-row>

          <a-divider>核心指标</a-divider>

          <a-row :gutter="[16, 16]" style="margin-bottom: 24px">
            <a-col :span="12">
              <a-statistic
                :title="`Recall@${evalResult.top_k}`"
                :value="evalResult.recall_at_k"
                :precision="4"
              />
            </a-col>
            <a-col :span="12">
              <a-statistic title="MRR" :value="evalResult.mrr" :precision="4" />
            </a-col>
          </a-row>

          <a-divider>延迟分布</a-divider>

          <div class="latency-bars">
            <div class="latency-row">
              <span class="latency-label">总延迟</span>
              <div class="latency-bar-bg">
                <div class="latency-bar" :style="{ width: latencyBarWidth(evalResult.avg_latency_ms) }" />
              </div>
              <span class="latency-value">{{ evalResult.avg_latency_ms.toFixed(0) }} ms</span>
            </div>
            <div class="latency-row">
              <span class="latency-label">嵌入</span>
              <div class="latency-bar-bg">
                <div class="latency-bar latency-bar--embed" :style="{ width: latencyBarWidth(evalResult.avg_embed_latency_ms) }" />
              </div>
              <span class="latency-value">{{ evalResult.avg_embed_latency_ms.toFixed(0) }} ms</span>
            </div>
            <div class="latency-row">
              <span class="latency-label">检索</span>
              <div class="latency-bar-bg">
                <div class="latency-bar latency-bar--search" :style="{ width: latencyBarWidth(evalResult.avg_search_latency_ms) }" />
              </div>
              <span class="latency-value">{{ evalResult.avg_search_latency_ms.toFixed(0) }} ms</span>
            </div>
          </div>

          <a-divider />

          <a-button type="link" @click="goToEvaluationHistory">
            查看评估历史
          </a-button>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import { formatTime } from '@/utils/time'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { useEmbedModelStore } from '@/store/embedModel'
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, BarChartOutlined } from '@ant-design/icons-vue'
import { getProjectList, createProject, updateProject, deleteProject, triggerEvaluation } from '@/api/project'
import type { ProjectItem, EvaluationStatsResult } from '@/api/model/projectModel'

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const embedModelStore = useEmbedModelStore()

const loading = ref(false)
const projectList = ref<ProjectItem[]>([])

const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formState = ref({ name: '', description: '', embed_model_id: '' })

// 评估统计
const evalDrawerVisible = ref(false)
const evalLoading = ref(false)
const evalProject = ref<ProjectItem | null>(null)
const evalTopK = ref(10)
const evalResult = ref<EvaluationStatsResult | null>(null)

function isActive(projectId: string) {
  return activeProjectStore.activeProjectId === projectId
}

function latencyBarWidth(ms: number) {
  if (!evalResult.value) return '0%'
  const maxMs = evalResult.value.avg_latency_ms || 1
  return `${Math.max((ms / maxMs) * 100, 1)}%`
}

watch(() => pageStore.refreshTrigger, fetchList)

async function fetchList() {
  loading.value = true
  try {
    const res = await getProjectList()
    projectList.value = res || []
  } catch {
    message.error('获取项目列表失败')
  } finally {
    loading.value = false
  }
}

function handleCreate() {
  isEdit.value = false
  editingId.value = ''
  formState.value = { name: '', description: '', embed_model_id: '' }
  modalVisible.value = true
  embedModelStore.fetchModels()
}

function handleEdit(project: ProjectItem) {
  isEdit.value = true
  editingId.value = project.id
  formState.value = { name: project.name, description: project.description, embed_model_id: project.embed_model_id }
  modalVisible.value = true
}

function handleView(project: ProjectItem) {
  goToDocuments(project)
}

async function handleActivate(project: ProjectItem) {
  await activeProjectStore.setActiveProject(project.id)
  message.success(`已激活项目「${project.name}」`)
}

function handleDelete(project: ProjectItem) {
  AModal.confirm({
    title: '确认删除',
    content: `确定要删除项目「${project.name}」吗? 此操作不可恢复。`,
    okType: 'danger',
    onOk() {
      void (async () => {
        try {
          await deleteProject(project.id)
          if (isActive(project.id)) {
            activeProjectStore.clearActiveProject()
          }
          message.success('删除成功')
          await fetchList()
        } catch {
          message.error('删除失败')
        }
      })()
    },
  })
}

function handleEvaluation(project: ProjectItem) {
  evalProject.value = project
  evalTopK.value = 10
  evalResult.value = null
  evalDrawerVisible.value = true
}

async function handleTriggerEvaluation() {
  if (!evalProject.value) return
  evalLoading.value = true
  try {
    const result = await triggerEvaluation(evalProject.value.id, evalTopK.value)
    evalResult.value = result
    message.success('评估完成')
  } catch (e: any) {
    const detail = e?.response?.data?.detail || e?.message || '评估失败'
    message.error(detail)
  } finally {
    evalLoading.value = false
  }
}

function goToDocuments(project: ProjectItem) {
  router.push({ path: `/documents` })
}

function goToEvaluationHistory() {
  if (!evalProject.value) return
  router.push({ path: `/projects/${evalProject.value.id}/evaluation` })
}

async function handleSubmit() {
  if (!formState.value.name.trim()) {
    message.warning('请输入项目名称')
    return
  }
  if (!isEdit.value && !formState.value.embed_model_id) {
    message.warning('请选择嵌入模型')
    return
  }

  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateProject(editingId.value, { name: formState.value.name, description: formState.value.description })
      message.success('更新成功')
    } else {
      await createProject(formState.value)
      message.success('创建成功')
    }
    modalVisible.value = false
    await fetchList()
  } catch {
    message.error(isEdit.value ? '编辑失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
@import '@/styles/common-table.css';

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

/* 激活项目卡片样式 */
.project-card {
  position: relative;
  overflow: hidden;
  transition: background 0.2s;
}
.project-card--active {
  background: #f0f7ff;
  border-left: 3px solid #1677ff;
}
.project-card--active :deep(.ant-card-body) {
  padding-left: 13px;
}
.active-tag {
  margin: 0;
  cursor: default;
}

/* 延迟条形图 */
.latency-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.latency-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.latency-label {
  width: 48px;
  font-size: 13px;
  color: #666;
  text-align: right;
  flex-shrink: 0;
}
.latency-bar-bg {
  flex: 1;
  height: 20px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}
.latency-bar {
  height: 100%;
  background: #1677ff;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.latency-bar--embed {
  background: #52c41a;
}
.latency-bar--search {
  background: #faad14;
}
.latency-value {
  width: 80px;
  font-size: 13px;
  color: #333;
  text-align: right;
  flex-shrink: 0;
}
</style>
