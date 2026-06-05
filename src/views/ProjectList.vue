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
            style="cursor: pointer"
            @click="handleView(project)"
          >
            <template #actions>
              <edit-outlined @click.stop="handleEdit(project)" />
              <delete-outlined @click.stop="handleDelete(project)" />
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
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal as AModal } from 'ant-design-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { usePageStore } from '@/store/page'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { getProjectList, createProject, updateProject, deleteProject } from '@/api/project'
import type { ProjectItem } from '@/api/model/projectModel'

dayjs.locale('zh-cn')

const router = useRouter()
const pageStore = usePageStore()

const loading = ref(false)
const projectList = ref<ProjectItem[]>([])

const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formState = ref({ name: '', description: '' })

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
  formState.value = { name: '', description: '' }
  modalVisible.value = true
}

function handleEdit(project: ProjectItem) {
  isEdit.value = true
  editingId.value = project.id
  formState.value = { name: project.name, description: project.description }
  modalVisible.value = true
}

function handleView(project: ProjectItem) {
  // 点击卡片直接进入文档管理
  goToDocuments(project)
}

function handleDelete(project: ProjectItem) {
  AModal.confirm({
    title: '确认删除',
    content: `确定要删除项目「${project.name}」吗? 此操作不可恢复。`,
    okType: 'danger',
    async onOk() {
      try {
        await deleteProject(project.id)
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

  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateProject(editingId.value, formState.value)
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

function goToDocuments(project: ProjectItem) {
  router.push({ path: `/projects/${project.id}/documents`, query: { name: project.name } })
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
</style>
