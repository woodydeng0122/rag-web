<template>
  <div class="project-list">
    <PageToolbar title="项目列表">
      <template #actions>
        <a-button type="primary" @click="handleCreate">
          <template #icon><plus-outlined /></template>
          新建项目
        </a-button>
      </template>
    </PageToolbar>

    <a-spin :spinning="loading">
      <a-row ref="projectRowRef" :gutter="[16, 16]">
        <a-col v-for="project in projectStore.projectList" :key="project.id" :xs="24" :sm="12" :md="8" :lg="6">
          <a-card
            hoverable
            class="project-card"
            :class="{ 'project-card--active': isActive(project.id) }"
            @click="handleView(project)"
          >
            <template #actions>
              <thunderbolt-outlined @click.stop="handleActivate(project)" title="激活项目" />
              <edit-outlined @click.stop="handleEdit(project)" />
              <delete-outlined @click.stop="handleDelete(project)" />
            </template>
            <a-card-meta>
              <template #title>
                <span>{{ project.name }}</span>
                <a-tag color="default" style="margin-left: 8px; font-size: 12px">{{ formatTime(project.created_at) }}</a-tag>
                <a-tag v-if="isActive(project.id)" color="blue" style="margin-left: 4px">激活</a-tag>
              </template>
              <template #description>{{ project.description || '暂无描述' }}</template>
            </a-card-meta>
            <div style="margin-top: 12px">
              <a-tooltip :title="project.embed_model_name || ''">
                <a-tag color="blue">Embedding</a-tag>
              </a-tooltip>
              <a-tooltip v-if="project.rerank_model_name" :title="project.rerank_model_name">
                <a-tag color="green">Rerank</a-tag>
              </a-tooltip>
              <a-tooltip :title="strategyLabel(project.default_splitter_config?.strategy)">
                <a-tag color="purple">分块: {{ strategyLabel(project.default_splitter_config?.strategy) }}</a-tag>
              </a-tooltip>
            </div>
          </a-card>
        </a-col>

        <a-col v-if="!loading && projectStore.projectList.length === 0" :span="24">
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
      @ok="handleFormSubmit"
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
            <a-select-option v-for="m in embedModelStore.onlineEmbedModels" :key="m.id" :value="m.id">
              {{ m.name }} ({{ m.dimension }}维)
            </a-select-option>
          </a-select>
          <span v-if="isEdit" class="form-hint">创建后不可修改</span>
        </a-form-item>
        <a-form-item label="重排模型">
          <a-select
            v-model:value="formState.rerank_model_id"
            placeholder="可选，不选则不走重排"
            :loading="embedModelStore.loading"
            :disabled="isEdit"
            allow-clear
          >
            <a-select-option v-for="m in embedModelStore.onlineRerankerModels" :key="m.id" :value="m.id">
              {{ m.name }}
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
        <SplitterConfigForm :form-state="splitterForm" />
      </a-form>
    </a-modal>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { message, Modal as AModal } from 'ant-design-vue'
import Sortable from 'sortablejs'
import { formatTime } from '@/utils/time'
import { useCrudModal } from '@/composables/useCrudModal'
import { useSplitterConfig, getSplitterDefaults, strategyLabel as splitterStrategyLabel, splitterConfigToForm } from '@/composables/useSplitterConfig'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import { useProjectStore } from '@/store/project'
import { useEmbedModelStore } from '@/store/embedModel'
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import PageToolbar from '@/components/PageToolbar.vue'
import SplitterConfigForm from '@/components/SplitterConfigForm.vue'
import { createProject, updateProject, deleteProject, reorderProjects } from '@/api/project'
import type { ProjectItem } from '@/api/model/projectModel'

const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()
const projectStore = useProjectStore()
const embedModelStore = useEmbedModelStore()

const loading = ref(false)
const projectRowRef = ref<InstanceType<typeof import('ant-design-vue/es/row/Row')>>()
let sortableInstance: Sortable | null = null

const { formState: splitterForm, reset: resetSplitterForm, toConfig: toSplitterConfig } = useSplitterConfig()

const { modalVisible, submitLoading, isEdit, editingId, formState, openCreate, openEdit, handleSubmit } = useCrudModal({
  defaultForm: () => ({
    name: '',
    description: '',
    embed_model_id: '',
    rerank_model_id: '',
    inherit_from_project_id: '',
  }),
  createApi: (form: any) => createProject({
    name: form.name,
    description: form.description,
    embed_model_id: form.embed_model_id,
    rerank_model_id: form.rerank_model_id || undefined,
    default_splitter_config: toSplitterConfig(),
  }),
  updateApi: (id: string, form: any) => updateProject(id, {
    name: form.name,
    description: form.description,
    default_splitter_config: toSplitterConfig(),
  }),
  afterSubmit: fetchList,
})

/** 新建时选中嵌入模型，自动更新分块参数 */
watch(() => formState.value.embed_model_id, (newId) => {
  if (isEdit.value || !newId) return
  const model = embedModelStore.onlineEmbedModels.find(m => m.id === newId)
  if (!model) return
  const maxPos = model.config?.max_position_embeddings as number | undefined
  const defaults = getSplitterDefaults(maxPos)
  Object.assign(splitterForm.value, defaults)
})

function isActive(projectId: string) {
  return activeProjectStore.activeProjectId === projectId
}

function strategyLabel(strategy?: string): string {
  return splitterStrategyLabel(strategy)
}

watch(() => pageStore.refreshTrigger, fetchList)

async function fetchList() {
  loading.value = true
  try {
    await projectStore.fetchProjectList()
  } catch {
    message.error('获取项目列表失败')
  } finally {
    loading.value = false
  }
}

function handleCreate() {
  openCreate()
  resetSplitterForm()
  embedModelStore.fetchModels()
}

function handleEdit(project: ProjectItem) {
  embedModelStore.fetchModels()
  openEdit(project.id, {
    name: project.name,
    description: project.description,
    embed_model_id: project.embed_model_id,
    rerank_model_id: project.rerank_model_id || '',
  })
  resetSplitterForm(project.default_splitter_config)
}

function handleView(project: ProjectItem) {
  if (isActive(project.id)) return
  AModal.confirm({
    title: '激活项目',
    content: `确定要激活项目「${project.name}」吗？`,
    onOk() {
      return handleActivate(project)
    },
  })
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

async function handleFormSubmit() {
  await handleSubmit((form) => {
    if (!form.name.trim()) return '请输入项目名称'
    if (!isEdit.value && !form.embed_model_id) return '请选择嵌入模型'
    return null
  })
}

function initSortable() {
  const el = projectRowRef.value?.$el as HTMLElement | undefined
  if (!el || sortableInstance) return
  sortableInstance = Sortable.create(el, {
    animation: 200,
    handle: '.project-card',
    ghostClass: 'project-card--ghost',
    onEnd: handleDragEnd,
  })
}

async function handleDragEnd(evt: Sortable.SortableEvent) {
  const { oldIndex, newIndex } = evt
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

  const list = [...projectStore.projectList]
  const [moved] = list.splice(oldIndex, 1)
  list.splice(newIndex, 0, moved)

  // 先乐观更新本地顺序
  const oldList = [...projectStore.projectList]
  projectStore.projectList = list

  // 构建排序数据
  const items = list.map((p, index) => ({ id: p.id, sort_order: index }))
  try {
    await reorderProjects(items)
  } catch {
    // 失败回滚
    projectStore.projectList = oldList
    message.error('排序保存失败')
  }
}

onMounted(async () => {
  await fetchList()
  nextTick(initSortable)
})
</script>

<style scoped>
@import '@/styles/common-table.css';

/* 激活项目卡片样式 */
.project-card {
  position: relative;
  overflow: hidden;
  transition: background 0.2s;
}
.project-card--active {
  background: var(--ant-color-primary-bg);
}
.project-card--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--ant-color-primary);
  z-index: 1;
}
.active-tag {
  margin: 0;
  cursor: default;
}
.project-card--ghost {
  opacity: 0.4;
}
.project-card {
  cursor: grab;
}
.project-card:active {
  cursor: grabbing;
}
</style>
