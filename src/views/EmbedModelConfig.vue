<template>
  <div class="embed-model-config">
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">嵌入模型配置</h2>
      </div>
      <div class="toolbar-right">
        <a-button type="primary" @click="handleCreate">
          <template #icon><plus-outlined /></template>
          新增模型
        </a-button>
      </div>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-spin :spinning="store.loading">
        <a-empty v-if="!store.loading && store.models.length === 0" description="暂无模型，请新增或刷新状态" />

        <a-table
          v-else
          :columns="columns"
          :data-source="store.models"
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
            <template v-if="column.key === 'action'">
              <a-button type="link" size="small" @click="handleDetail(record)">详情</a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确定删除该模型？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑模型' : '新增模型'"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
    >
      <a-form :model="formState" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="padding-top: 16px">
        <a-form-item label="模型名称" required>
          <a-input
            v-model:value="formState.name"
            placeholder="如 BAAI/bge-small-zh-v1.5"
            :maxlength="255"
            show-count
            :disabled="isEdit"
          />
          <span v-if="isEdit" class="form-hint">创建后不可修改</span>
        </a-form-item>
        <a-form-item v-if="!isEdit" label="向量维度">
          <a-input-number
            v-model:value="formState.dimension"
            :min="0"
            placeholder="本地无模型时需手动指定"
            style="width: 100%"
          />
          <span class="form-hint">本地有模型文件时自动读取，无需填写</span>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="formState.description" placeholder="模型备注（选填）" :rows="3" :maxlength="500" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情 Drawer -->
    <a-drawer
      v-model:open="detailVisible"
      :title="detailModel?.name"
      width="50%"
    >
      <template v-if="detailModel">
        <a-descriptions :column="1" bordered size="small" style="margin-bottom: 24px">
          <a-descriptions-item label="模型名称">
            <span class="model-name">{{ detailModel.name }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="向量维度">
            <a-tag color="blue">{{ detailModel.dimension }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="detailModel.status === 'online' ? 'success' : 'default'">
              {{ detailModel.status === 'online' ? '在线' : '离线' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="备注">{{ detailModel.description || '--' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ detailModel.created_at || '--' }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ detailModel.updated_at || '--' }}</a-descriptions-item>
        </a-descriptions>

        <h4 style="margin-bottom: 12px">模型配置 (config.json)</h4>
        <a-table
          v-if="metadataEntries.length > 0"
          :columns="metaColumns"
          :data-source="metadataEntries"
          :pagination="false"
          size="small"
          bordered
        />
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { createEmbedModel, updateEmbedModel, deleteEmbedModel } from '@/api/embedModel'
import { useEmbedModelStore } from '@/store/embedModel'
import { usePageStore } from '@/store/page'
import type { EmbedModelItem } from '@/api/model/embedModelModel'

const store = useEmbedModelStore()
const pageStore = usePageStore()

const submitLoading = ref(false)

const modalVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formState = ref({ name: '', description: '', dimension: undefined as number | undefined })

const detailVisible = ref(false)
const detailModel = ref<EmbedModelItem | null>(null)

// config.json 字段中文解释
const META_LABELS: Record<string, string> = {
  '_name_or_path': '模型加载路径',
  'architectures': '模型架构',
  'model_type': '模型类型',
  'hidden_size': '隐藏层维度（即向量维度）',
  'num_hidden_layers': 'Transformer 层数',
  'num_attention_heads': '注意力头数',
  'intermediate_size': '前馈网络中间层维度',
  'hidden_act': '隐藏层激活函数',
  'hidden_dropout_prob': '隐藏层 Dropout 概率',
  'attention_probs_dropout_prob': '注意力 Dropout 概率',
  'max_position_embeddings': '最大序列长度',
  'initializer_range': '参数初始化范围',
  'layer_norm_eps': 'LayerNorm epsilon',
  'vocab_size': '词表大小',
  'type_vocab_size': 'Token 类型数',
  'pad_token_id': 'Padding Token ID',
  'position_embedding_type': '位置编码类型',
  'use_cache': '是否启用 KV Cache',
  'torch_dtype': '权重数据类型',
  'transformers_version': 'Transformers 版本',
  'classifier_dropout': '分类器 Dropout',
  'id2label': 'ID 到标签映射',
  'label2id': '标签到 ID 映射',
}

const columns = [
  { title: '模型名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '维度', dataIndex: 'dimension', key: 'dimension', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '备注', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 180 },
]

const metaColumns = [
  { title: '字段', dataIndex: 'key', key: 'key', width: 200 },
  { title: '说明', dataIndex: 'label', key: 'label', width: 180 },
  { title: '值', dataIndex: 'value', key: 'value', ellipsis: true },
]

const metadataEntries = computed(() => {
  if (!detailModel.value?.config) return []
  return Object.entries(detailModel.value.config).map(([key, value]) => ({
    key,
    label: META_LABELS[key] || '--',
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }))
})

function handleCreate() {
  isEdit.value = false
  editingId.value = ''
  formState.value = { name: '', description: '', dimension: undefined }
  modalVisible.value = true
  store.fetchModels(true)
}

function handleEdit(record: EmbedModelItem) {
  isEdit.value = true
  editingId.value = record.id
  formState.value = { name: record.name, description: record.description, dimension: undefined }
  modalVisible.value = true
}

function handleDetail(record: EmbedModelItem) {
  detailModel.value = record
  detailVisible.value = true
}

async function handleSubmit() {
  if (!formState.value.name.trim()) {
    message.warning('请输入模型名称')
    return
  }

  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateEmbedModel(editingId.value, { name: formState.value.name, description: formState.value.description })
      message.success('更新成功')
    } else {
      const params: any = { name: formState.value.name, description: formState.value.description }
      if (formState.value.dimension) params.dimension = formState.value.dimension
      await createEmbedModel(params)
      message.success('新增成功')
    }
    modalVisible.value = false
    store.invalidateCache()
    await store.fetchModels(true)
  } catch {
    message.error(isEdit.value ? '更新失败' : '新增失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(record: EmbedModelItem) {
  try {
    await deleteEmbedModel(record.id)
    message.success('删除成功')
    store.invalidateCache()
    await store.fetchModels(true)
  } catch {
    message.error('删除失败')
  }
}

onMounted(() => store.fetchModels())

watch(() => pageStore.refreshTrigger, () => store.fetchModels(true))
</script>

<style scoped>
/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-left {
  display: flex;
  align-items: center;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

/* 表格卡片 */
.table-card {
  border-radius: 10px;
}
.table-card :deep(.ant-card-body) {
  padding: 0;
}
.table-card :deep(.ant-table-thead > tr > th) {
  font-weight: 500;
  color: #666;
  font-size: 13px;
}
.table-card :deep(.ant-table-tbody > tr > td) {
  padding: 12px 16px;
}
.table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: #f5f7fa;
}

.model-name {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font-size: 13px;
}
.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
</style>
