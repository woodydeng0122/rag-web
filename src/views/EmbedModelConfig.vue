<template>
  <div class="embed-model-config">
    <PageToolbar title="嵌入模型配置">
      <template #actions>
        <a-button type="primary" @click="handleCreate">
          <template #icon><plus-outlined /></template>
          新增模型
        </a-button>
      </template>
    </PageToolbar>

    <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
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
            <template v-if="column.key === 'model_type'">
              <a-tag :color="record.model_type === 'reranker' ? 'green' : 'blue'">
                {{ record.model_type === 'reranker' ? '重排' : '嵌入' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'dimension'">
              <a-tag v-if="record.model_type === 'embed'" :color="dimensionColor(record.dimension)">{{ record.dimension }}</a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusInfo(EMBED_MODEL_STATUS_MAP, record.status).color">
                {{ getStatusInfo(EMBED_MODEL_STATUS_MAP, record.status).text }}
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
      @ok="handleFormSubmit"
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
          <a-descriptions-item label="模型类型">
            <a-tag :color="detailModel.model_type === 'reranker' ? 'green' : 'blue'">
              {{ detailModel.model_type === 'reranker' ? '重排' : '嵌入' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="向量维度">
            <a-tag v-if="detailModel.model_type === 'embed'" :color="dimensionColor(detailModel.dimension)">{{ detailModel.dimension }}</a-tag>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="getStatusInfo(EMBED_MODEL_STATUS_MAP, detailModel.status).color">
              {{ getStatusInfo(EMBED_MODEL_STATUS_MAP, detailModel.status).text }}
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
import { useCrudModal } from '@/composables/useCrudModal'
import { useEmbedModelStore } from '@/store/embedModel'
import { usePageStore } from '@/store/page'
import type { EmbedModelItem } from '@/api/model/embedModelModel'
import PageToolbar from '@/components/PageToolbar.vue'
import { getStatusInfo, EMBED_MODEL_STATUS_MAP } from '@/utils/status'

const store = useEmbedModelStore()
const pageStore = usePageStore()

const { modalVisible, submitLoading, isEdit, editingId, formState, openCreate, openEdit, handleSubmit } = useCrudModal({
  defaultForm: () => ({ name: '', description: '', dimension: undefined as number | undefined }),
  createApi: async (form) => {
    const params: any = { name: form.name, description: form.description }
    if (form.dimension) params.dimension = form.dimension
    return createEmbedModel(params)
  },
  updateApi: (id, form) => updateEmbedModel(id, { name: (form as any).name, description: (form as any).description }),
  successMessage: { create: '新增成功' },
  errorMessage: { create: '新增失败', update: '更新失败' },
  afterSubmit: async () => {
    store.invalidateCache()
    await store.fetchModels(true)
  },
})

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

const DIMENSION_COLORS: Record<string, string> = {
  '768': 'blue',
  '1024': 'purple',
  '1536': 'cyan',
  '2048': 'green',
  '3072': 'orange',
  '4096': 'magenta',
}

function dimensionColor(dim?: number): string {
  return DIMENSION_COLORS[String(dim)] || 'default'
}

const columns = [
  { title: '模型名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'model_type', key: 'model_type', width: 80 },
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
  openCreate()
  store.fetchModels(true)
}

function handleEdit(record: EmbedModelItem) {
  openEdit(record.id, { name: record.name, description: record.description })
}

function handleDetail(record: EmbedModelItem) {
  detailModel.value = record
  detailVisible.value = true
}

async function handleFormSubmit() {
  await handleSubmit((form) => {
    if (!form.name.trim()) return '请输入模型名称'
    return null
  })
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
@import '@/styles/common-table.css';

.model-name {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font-size: var(--ant-font-size);
}
</style>
