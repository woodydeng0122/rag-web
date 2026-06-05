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
              <edit-outlined @click.stop="handleEdit(project)" />
              <delete-outlined @click.stop="handleDelete(project)" />
              <a-tag v-if="isActive(project.id)" color="blue" class="active-tag">当前项目</a-tag>
              <thunderbolt-outlined v-else @click.stop="handleActivate(project)" title="激活项目" />
            </template>
            <a-card-meta :title="project.name" :description="project.description || '暂无描述'" />
            <div style="margin-top: 12px; font-size: 12px; color: #999">
              创建时间: {{ formatTime(project.created_at) }}
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
            :loading="modelsLoading"
            :disabled="isEdit"
          >
            <a-select-option v-for="m in onlineModels" :key="m.id" :value="m.id">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { getProjectList, createProject, updateProject, deleteProject } from '@/api/project'
import { getEmbedModelList } from '@/api/embedModel'
import type { ProjectItem } from '@/api/model/projectModel'
import type { EmbedModelItem } from '@/api/model/embedModelModel'

dayjs.locale('zh-cn')

const router = useRouter()
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const loading = ref(false)
const projectList = ref<ProjectItem[]>([])

const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formState = ref({ name: '', description: '', embed_model_id: '' })

const modelsLoading = ref(false)
const embedModels = ref<EmbedModelItem[]>([])
const onlineModels = computed(() => embedModels.value.filter(m => m.status === 'online'))

function isActive(projectId: string) {
  return activeProjectStore.activeProjectId === projectId
}

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
  fetchEmbedModels()
}

function handleEdit(project: ProjectItem) {
  isEdit.value = true
  editingId.value = project.id
  formState.value = { name: project.name, description: project.description, embed_model_id: project.embed_model_id }
  modalVisible.value = true
}

function handleView(project: ProjectItem) {
  // 点击卡片进入文档管理
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
    async onOk() {
      try {
        await deleteProject(project.id)
        // 若删除的是激活项目，清空 Store
        if (isActive(project.id)) {
          activeProjectStore.clearActiveProject()
        }
        message.success('删除成功')
        await fetchList()
      } catch {
        message.error('删除失败')
      }
    },
  })
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

async function fetchEmbedModels() {
  modelsLoading.value = true
  try {
    const res = await getEmbedModelList()
    embedModels.value = res.models || []
  } catch {
    // 静默处理
  } finally {
    modelsLoading.value = false
  }
}

function goToDocuments(project: ProjectItem) {
  router.push({ path: `/documents` })
}

onMounted(fetchList)
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
.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
</style>
