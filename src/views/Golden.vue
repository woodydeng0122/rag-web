<template>
  <div class="golden">
    <!-- 未选择项目 -->
    <NoProjectPrompt v-if="!activeProjectStore.hasActiveProject" description="请先选择一个项目" button-text="前往项目列表" />

    <!-- 已选择项目 -->
<template v-else>
  <!-- 工具栏 -->
  <PageToolbar>
    <template #left>
      <a-select v-model:value="retrievalFilter" placeholder="检索情况" class="status-filter" allow-clear @change="fetchList()">
        <a-select-option value="">全部</a-select-option>
        <a-select-option value="hit">命中</a-select-option>
        <a-select-option value="miss">未命中</a-select-option>
        <a-select-option value="unretrieved">未检索</a-select-option>
      </a-select>
      <a-input-search v-model:value="searchQuery" placeholder="搜索查询文本..." class="search-input" allow-clear @search="onSearch" />
    </template>
    <template #actions>
      <a-button danger :disabled="selectedRowKeys.length === 0" @click="handleBatchDelete">
        <template #icon><delete-outlined /></template>
        批量删除 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button :disabled="selectedRowKeys.length === 0" :loading="batchRetrieving" @click="batchRetrieveModalVisible = true">
        <template #icon><search-outlined /></template>
        批量检索 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button :disabled="selectedRowKeys.length === 0 || !activeProjectStore.activeProject?.rerank_model_id" :loading="batchReranking" @click="handleOpenBatchRerank">
        <template #icon><sort-ascending-outlined /></template>
        批量重排 ({{ selectedRowKeys.length }})
      </a-button>
      <a-button @click="importModalVisible = true">
        <template #icon><upload-outlined /></template>
        上传
      </a-button>
      <a-button type="primary" @click="handleCreate">
        <template #icon><plus-outlined /></template>
        新增
      </a-button>
    </template>
  </PageToolbar>

  <!-- 数据表格 -->
  <a-card :bordered="false" class="table-card" :body-style="{ padding: 0 }">
    <a-spin :spinning="loading">
      <a-table
        :columns="columns"
        :data-source="filteredList"
        row-key="id"
        :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
        :pagination="paginationConfig"
        size="middle"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <!-- 查询文本 -->
          <template v-if="column.key === 'query'">
            <span class="query-cell" :title="record.query">{{ record.query }}</span>
          </template>

          <!-- 关联分块 -->
          <template v-if="column.key === 'chunk_count'">
            <a-tag color="blue">{{ record.ground_truth_refs?.length || 0 }} 个分块</a-tag>
          </template>

          <!-- 检索 -->
          <template v-if="column.key === 'retrieval'">
            <template v-if="record.retrieval_summary">
              <a-tag
                v-if="record.retrieval_summary.hit_count > 0"
                color="success"
                style="cursor: pointer"
                @click="openRetrievalDrawer(record)"
              >
                命中({{ record.retrieval_summary.hit_count }}/{{ record.retrieval_summary.gt_total }}) #{{ record.retrieval_summary.hit_ranks.join(', #') }}
              </a-tag>
              <a-tag
                v-else
                color="error"
                style="cursor: pointer"
                @click="openRetrievalDrawer(record)"
              >
                未命中
              </a-tag>
            </template>
            <a-button v-else size="small" type="link" @click="openRetrievalDrawer(record)">检索</a-button>
          </template>

          <!-- 重排 -->
          <template v-if="column.key === 'rerank'">
            <template v-if="record.rerank_summary">
              <a-tag
                v-if="record.rerank_summary.hit_count > 0"
                color="success"
                style="cursor: pointer"
                @click="openRerankDrawer(record)"
              >
                命中({{ record.rerank_summary.hit_count }}/{{ record.rerank_summary.gt_total }}) #{{ record.rerank_summary.hit_ranks.join(', #') }}
              </a-tag>
              <a-tag
                v-else
                color="error"
                style="cursor: pointer"
                @click="openRerankDrawer(record)"
              >
                未命中
              </a-tag>
            </template>
            <a-button v-else-if="record.has_retrieval" size="small" type="link" @click="openRerankDrawer(record)">重排</a-button>
            <span v-else>--</span>
          </template>

          <!-- 参考答案 -->
          <template v-if="column.key === 'reference_answer'">
            <span class="answer-cell" :title="record.reference_answer">
              {{ record.reference_answer ? (record.reference_answer.length > 40 ? record.reference_answer.slice(0, 40) + '...' : record.reference_answer) : '--' }}
            </span>
          </template>

          <!-- 创建时间 -->
          <template v-if="column.key === 'created_at'">
            <span class="time-cell">{{ formatTime(record.created_at) }}</span>
          </template>

          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <div class="action-cell">
              <a-button size="small" @click="openDetailDrawer(record)">详情</a-button>
              <a-button size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm title="确定删除此记录？" @confirm="handleDelete(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </a-spin>
  </a-card>
</template>

<!-- 新增/编辑 Drawer -->
<a-drawer
  v-model:open="modalVisible"
  :title="isEdit ? '编辑黄金记录' : '新增黄金记录'"
  width="50%"
  placement="right"
>
  <a-form :model="formState" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" style="padding-top: 16px">
    <a-form-item label="查询文本" required>
      <a-textarea v-model:value="formState.query" placeholder="请输入查询文本" :rows="2" :maxlength="1000" show-count />
    </a-form-item>
    <a-form-item label="关联分块" required>
      <div class="chunk-selector">
        <a-input-search
          v-model:value="chunkSearchQuery"
          placeholder="搜索分块内容..."
          size="small"
          allow-clear
          @search="onChunkSearch"
          style="margin-bottom: 8px"
        />
        <a-spin :spinning="chunksLoading">
          <div class="chunk-list">
            <a-checkbox-group v-model:value="selectedRefKeys" style="width: 100%">
              <div v-for="chunk in chunkOptions" :key="chunk.id" class="chunk-option">
                <a-checkbox :value="`${chunk.source_file}::${chunk.index}`">
                  <span class="chunk-doc" v-if="chunk.source_file">{{ chunk.source_file.split('/').pop() }}#{{ chunk.index }} — </span>
                  <span class="chunk-heading" v-if="chunk.heading">{{ chunk.heading }} — </span>
                  <span class="chunk-content">{{ chunk.content }}</span>
                </a-checkbox>
              </div>
            </a-checkbox-group>
            <div v-if="hasMoreChunks" class="load-more" @click="loadMoreChunks">加载更多...</div>
            <a-empty v-if="!chunksLoading && chunkOptions.length === 0" description="暂无分块" :image="null" />
          </div>
        </a-spin>
      </div>
      <div v-if="selectedRefKeys.length > 0" class="selected-info">已选 {{ selectedRefKeys.length }} 个分块</div>
    </a-form-item>
    <a-form-item label="参考答案">
      <a-textarea v-model:value="formState.reference_answer" placeholder="请输入参考答案（选填）" :rows="3" :maxlength="2000" show-count />
    </a-form-item>
  </a-form>
  <div class="drawer-footer">
    <a-button style="margin-right: 8px" @click="modalVisible = false">取消</a-button>
    <a-button type="primary" :loading="submitLoading" @click="handleFormSubmit">确认</a-button>
  </div>
</a-drawer>

<!-- 上传弹窗 -->
<a-modal
  v-model:open="importModalVisible"
  title="导入黄金数据集"
  :footer="null"
  :width="520"
  @cancel="importModalVisible = false"
>
  <div class="import-modal-content">
    <a-upload-dragger
      :before-upload="beforeUpload"
      :show-upload-list="false"
      accept=".jsonl,.csv"
      :disabled="importing"
      multiple
    >
      <p class="ant-upload-drag-icon"><upload-outlined style="font-size: 36px; color: var(--ant-color-primary)" /></p>
      <p class="ant-upload-text">拖拽或点击上传文件</p>
      <p class="ant-upload-hint">支持 .jsonl / .csv 格式，可多选文件，单文件最多 1000 条</p>
    </a-upload-dragger>

    <div v-if="importFiles.length > 0" class="import-file-list">
      <div v-for="(file, index) in importFiles" :key="index" class="import-file-item">
        <a-tag color="blue">{{ file.name }}</a-tag>
        <a-button type="link" size="small" :disabled="importing" @click="removeImportFile(index)">移除</a-button>
      </div>
    </div>

    <div class="import-templates">
      <span class="template-label">下载模板：</span>
      <a @click="downloadTemplate('jsonl')">JSONL 模板</a>
      <a-divider type="vertical" />
      <a @click="downloadTemplate('csv')">CSV 模板</a>
    </div>

    <div class="import-actions">
      <a-button :disabled="importFiles.length === 0" :loading="importing" type="primary" @click="handleImport">
        确认导入 ({{ importFiles.length }} 个文件)
      </a-button>
    </div>

    <!-- 导入进度 -->
    <div v-if="importing" class="import-progress">
      <a-spin size="small" />
      <span style="margin-left: 8px">正在导入第 {{ importCurrentIndex + 1 }} / {{ importFiles.length }} 个文件...</span>
    </div>

    <!-- 导入结果 -->
    <div v-if="importResults.length > 0" class="import-result">
      <div v-for="result in importResults" :key="result.filename" class="import-result-item">
        <a-alert
          :type="result.success_count > 0 ? (result.skipped_count > 0 ? 'warning' : 'success') : 'error'"
          show-icon
          :message="`${result.filename}：成功 ${result.success_count} 条${result.skipped_count > 0 ? '，跳过 ' + result.skipped_count + ' 条' : ''}`"
        />
        <div v-if="result.skipped.length > 0" class="skipped-list">
          <div v-for="s in result.skipped" :key="s.row" class="skipped-item">
            第 {{ s.row }} 行：{{ s.reason }}
          </div>
        </div>
      </div>
    </div>
  </div>
</a-modal>

<!-- 批量检索弹窗 -->
<a-modal
  v-model:open="batchRetrieveModalVisible"
  title="批量检索"
  ok-text="开始检索"
  cancel-text="取消"
  :confirm-loading="batchRetrieving"
  @ok="handleBatchRetrieve"
>
  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top: 16px">
    <a-form-item label="检索策略" required>
      <a-select v-model:value="batchRetrievalStrategy" placeholder="选择检索策略">
        <a-select-option value="hybrid">Hybrid (向量+BM25)</a-select-option>
        <a-select-option value="vector">Vector (pgvector)</a-select-option>
        <a-select-option value="cosine">Cosine (内存暴力)</a-select-option>
        <a-select-option value="bm25">BM25 (全文检索)</a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="max_k" required>
      <a-input-number v-model:value="batchRetrievalMaxK" :min="1" :max="100" style="width: 100%" />
    </a-form-item>
    <a-form-item label="选中数量">
      <span>{{ selectedRowKeys.length }} 条黄金记录</span>
    </a-form-item>
  </a-form>
</a-modal>

<!-- 批量重排弹窗 -->
<a-modal
  v-model:open="batchRerankModalVisible"
  title="批量重排"
  ok-text="开始重排"
  cancel-text="取消"
  :confirm-loading="batchReranking"
  @ok="handleBatchRerank"
>
  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top: 16px">
    <a-form-item label="top_k" required>
      <a-input-number v-model:value="batchRerankTopK" :min="1" :max="100" style="width: 100%" />
    </a-form-item>
    <a-form-item label="选中数量">
      <span>{{ selectedRowKeys.length }} 条黄金记录</span>
    </a-form-item>
    <a-alert v-if="batchRerankWarning" type="warning" :message="batchRerankWarning" show-icon style="margin-top: 8px" />
  </a-form>
</a-modal>

<!-- 详情 Drawer -->
<a-drawer
  v-model:open="detailDrawerVisible"
  :title="detailRecord?.query || '详情'"
  width="50%"
  placement="right"
>
  <template v-if="detailRecord">
    <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item label="查询文本">{{ detailRecord.query }}</a-descriptions-item>
      <a-descriptions-item label="关联分块">
        <div v-if="detailRecord.ground_truth_refs?.length">
          <a-tag v-for="ref in detailRecord.ground_truth_refs" :key="`${ref.storage_key}::${ref.chunk_index}`" style="margin-bottom: 4px">{{ ref.storage_key.split('/').pop() }}#{{ ref.chunk_index }}</a-tag>
        </div>
        <span v-else>--</span>
      </a-descriptions-item>
      <a-descriptions-item label="参考答案">
        <div class="detail-answer">{{ detailRecord.reference_answer || '--' }}</div>
      </a-descriptions-item>
      <a-descriptions-item label="创建时间">{{ detailRecord.created_at }}</a-descriptions-item>
      <a-descriptions-item v-if="detailRecord.metadata && Object.keys(detailRecord.metadata).length" label="元数据">
        <pre class="detail-metadata">{{ JSON.stringify(detailRecord.metadata, null, 2) }}</pre>
      </a-descriptions-item>
    </a-descriptions>

    <div class="detail-actions">
      <a-button @click="handleEdit(detailRecord); detailDrawerVisible = false">编辑</a-button>
    </div>
  </template>
</a-drawer>

<!-- 检索 Drawer -->
<a-drawer
  v-model:open="retrievalDrawerVisible"
  title="检索验证"
  width="80%"
  placement="right"
>
  <template v-if="retrievalRecord">
    <SplitPanelLayout left-title="查询 & Ground Truth" right-title="检索结果">
      <template #left>
        <div class="retrieval-query-section">
          <div class="retrieval-query-label">数据集 ID</div>
          <div class="retrieval-id-text" @click="copyId(retrievalRecord.id)" title="点击复制">
            <span class="retrieval-id-value">{{ retrievalRecord.id }}</span>
            <copy-outlined class="retrieval-id-copy-icon" />
          </div>
        </div>
        <div class="retrieval-query-section">
          <div class="retrieval-query-label">查询文本</div>
          <div class="retrieval-query-text">{{ retrievalRecord.query }}</div>
        </div>
        <div v-if="retrievalRecord.reference_answer" class="retrieval-query-section">
          <div class="retrieval-query-label">参考答案</div>
          <div class="retrieval-answer-text">{{ retrievalRecord.reference_answer }}</div>
        </div>
        <div v-if="retrievalRecord.metadata && Object.keys(retrievalRecord.metadata).length" class="retrieval-query-section">
          <div class="retrieval-query-label">元数据</div>
          <pre class="retrieval-metadata-text">{{ JSON.stringify(retrievalRecord.metadata, null, 2) }}</pre>
        </div>
        <div class="retrieval-gt-section">
          <div class="retrieval-gt-label">Ground Truth ({{ retrievalRecord.ground_truth_refs?.length || 0 }} 个分块)</div>
          <a-spin :spinning="gtChunksLoading">
            <div class="retrieval-gt-list">
              <ChunkCard
                v-for="(chunk, idx) in gtChunks"
                :key="`${chunk.source_file}::${chunk.index}`"
                :content="chunk.content"
                :file-type="chunk.file_type"
                :heading="chunk.heading"
                :label="`#${chunk.index + 1}`"
                :even="idx % 2 === 0"
              />
              <a-empty v-if="!gtChunksLoading && gtChunks.length === 0" description="无关联分块" :image="null" />
            </div>
          </a-spin>
        </div>
      </template>
      <template #right>
        <div v-if="!retrievalResult" class="retrieval-params">
          <div class="retrieval-param-row">
            <span class="retrieval-param-label">策略</span>
            <a-select v-model:value="retrievalStrategy" style="width: 180px">
              <a-select-option value="hybrid">Hybrid (向量+BM25)</a-select-option>
              <a-select-option value="vector">Vector (pgvector)</a-select-option>
              <a-select-option value="cosine">Cosine (内存暴力)</a-select-option>
              <a-select-option value="bm25">BM25 (全文检索)</a-select-option>
            </a-select>
          </div>
          <div class="retrieval-param-row">
            <span class="retrieval-param-label">max_k</span>
            <a-input-number v-model:value="retrievalMaxK" :min="1" :max="100" style="width: 120px" />
          </div>
          <a-button type="primary" :loading="retrievalLoading" @click="handleRetrieve">确认检索</a-button>
        </div>
        <div v-if="retrievalLoading" class="retrieval-loading">
          <a-spin />
          <span>正在检索...</span>
        </div>
        <template v-if="retrievalResult">
          <div class="retrieval-metrics">
            <a-tag color="purple">策略: {{ strategyLabel(retrievalResult.strategy) }}</a-tag>
            <a-tag>模型: {{ retrievalResult.embed_model_name || '--' }}</a-tag>
            <a-tag>总耗时: {{ retrievalResult.latency_ms }}ms</a-tag>
            <a-tag>加载向量: {{ retrievalResult.load_embeddings_latency_ms }}ms</a-tag>
            <a-tag>加载项目: {{ retrievalResult.load_project_latency_ms }}ms</a-tag>
            <a-tag>加载模型: {{ retrievalResult.load_embed_model_latency_ms }}ms</a-tag>
            <a-tag>获取Embedder: {{ retrievalResult.get_embedder_latency_ms }}ms</a-tag>
            <a-tag>构建矩阵: {{ retrievalResult.build_matrix_latency_ms }}ms</a-tag>
            <a-tag>嵌入: {{ retrievalResult.embed_latency_ms }}ms</a-tag>
            <a-tag>检索: {{ retrievalResult.search_latency_ms }}ms</a-tag>
            <a-tag>max_k: {{ retrievalResult.max_k }}</a-tag>
            <a-tag color="green">命中GT: {{ retrievalResult.items.filter(i => i.is_ground_truth).length }}/{{ retrievalRecord.ground_truth_refs?.length || 0 }}</a-tag>
          </div>
          <div class="retrieval-items">
            <div v-for="(item, idx) in retrievalResult.items" :key="`${item.storage_key}::${item.chunk_index}`" class="retrieval-item-wrap">
              <a-tag v-if="item.is_ground_truth" color="success" size="small" class="retrieval-gt-tag">GT命中</a-tag>
              <a-tag v-else color="default" size="small" class="retrieval-gt-tag">未命中</a-tag>
              <ChunkCard
                :content="item.content"
                :file-type="item.file_type"
                :heading="item.heading"
                :source-file="item.source_file"
                :score="item.score"
                :label="`#${item.rank}`"
                :even="idx % 2 === 0"
              />
            </div>
          </div>
        </template>
      </template>
    </SplitPanelLayout>
  </template>
</a-drawer>

<!-- 重排 Drawer -->
<a-drawer
  v-model:open="rerankDrawerVisible"
  title="重排验证"
  width="80%"
  placement="right"
>
  <template v-if="rerankRecord">
    <SplitPanelLayout left-title="查询 & Ground Truth" right-title="重排结果">
      <template #left>
        <div class="retrieval-query-section">
          <div class="retrieval-query-label">数据集 ID</div>
          <div class="retrieval-id-text" @click="copyId(rerankRecord.id)" title="点击复制">
            <span class="retrieval-id-value">{{ rerankRecord.id }}</span>
            <copy-outlined class="retrieval-id-copy-icon" />
          </div>
        </div>
        <div class="retrieval-query-section">
          <div class="retrieval-query-label">查询文本</div>
          <div class="retrieval-query-text">{{ rerankRecord.query }}</div>
        </div>
        <div v-if="rerankRecord.reference_answer" class="retrieval-query-section">
          <div class="retrieval-query-label">参考答案</div>
          <div class="retrieval-answer-text">{{ rerankRecord.reference_answer }}</div>
        </div>
        <div class="retrieval-gt-section">
          <div class="retrieval-gt-label">Ground Truth ({{ rerankRecord.ground_truth_refs?.length || 0 }} 个分块)</div>
          <a-spin :spinning="rerankGtChunksLoading">
            <div class="retrieval-gt-list">
              <ChunkCard
                v-for="(chunk, idx) in rerankGtChunks"
                :key="`${chunk.source_file}::${chunk.index}`"
                :content="chunk.content"
                :file-type="chunk.file_type"
                :heading="chunk.heading"
                :label="`#${chunk.index + 1}`"
                :even="idx % 2 === 0"
              />
              <a-empty v-if="!rerankGtChunksLoading && rerankGtChunks.length === 0" description="无关联分块" :image="null" />
            </div>
          </a-spin>
        </div>
      </template>
      <template #right>
        <div v-if="!rerankResult" class="retrieval-params">
          <div class="retrieval-param-row">
            <span class="retrieval-param-label">top_k</span>
            <a-input-number v-model:value="rerankTopK" :min="1" :max="100" style="width: 120px" />
          </div>
          <a-button type="primary" :loading="rerankLoading" @click="handleRerank">确认重排</a-button>
        </div>
        <div v-if="rerankLoading" class="retrieval-loading">
          <a-spin />
          <span>正在重排...</span>
        </div>
        <template v-if="rerankResult">
          <div class="retrieval-metrics">
            <a-tag color="purple">模型: {{ rerankResult.model_name || '--' }}</a-tag>
            <a-tag>总耗时: {{ rerankResult.latency_ms }}ms</a-tag>
            <a-tag>加载粗排: {{ rerankResult.load_retrieval_latency_ms }}ms</a-tag>
            <a-tag>加载分块: {{ rerankResult.load_chunks_latency_ms }}ms</a-tag>
            <a-tag>推理: {{ rerankResult.predict_latency_ms }}ms</a-tag>
            <a-tag>top_k: {{ rerankResult.top_k }}</a-tag>
            <a-tag color="green">命中GT: {{ rerankResult.items.filter(i => i.is_ground_truth).length }}/{{ rerankRecord.ground_truth_refs?.length || 0 }}</a-tag>
          </div>
          <div class="retrieval-items">
            <div v-for="(item, idx) in rerankResult.items" :key="`${item.storage_key}::${item.chunk_index}`" class="retrieval-item-wrap">
              <a-tag v-if="item.is_ground_truth" color="success" size="small" class="retrieval-gt-tag">GT命中</a-tag>
              <a-tag v-else color="default" size="small" class="retrieval-gt-tag">未命中</a-tag>
              <ChunkCard
                :content="item.content"
                :file-type="item.file_type"
                :heading="item.heading"
                :source-file="item.source_file"
                :score="item.rerank_score"
                :label="`#${item.rerank_rank}`"
                :even="idx % 2 === 0"
              />
            </div>
          </div>
        </template>
      </template>
    </SplitPanelLayout>
  </template>
</a-drawer>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { formatTime } from '@/utils/time'
import { useCrudModal } from '@/composables/useCrudModal'
import { usePagination } from '@/composables/usePagination'
import { useBatchProcess } from '@/composables/useBatchProcess'
import { batchExecute } from '@/utils/batch'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  CopyOutlined,
} from '@ant-design/icons-vue'
import {
  getGoldenList,
  createGolden,
  updateGolden,
  deleteGolden,
  importGolden,
  createRetrieval,
  getRetrieval,
  createRerank,
  getRerank,
} from '@/api/golden'
import { searchProjectChunks, getChunksByRefs } from '@/api/chunk'
import type { GoldenItem, CreateGoldenParams, ImportResult, RetrievalResponse, RetrievalStrategy, RerankResponse, GroundTruthRef } from '@/api/model/goldenModel'
import type { ChunkItem } from '@/api/model/documentModel'
import ChunkCard from '@/components/ChunkCard.vue'
import NoProjectPrompt from '@/components/NoProjectPrompt.vue'
import PageToolbar from '@/components/PageToolbar.vue'
import SplitPanelLayout from '@/components/SplitPanelLayout.vue'

const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const loading = ref(false)
const dataList = ref<GoldenItem[]>([])
const searchQuery = ref('')
const retrievalFilter = ref('')

const selectedRowKeys = ref<string[]>([])

const columns = [
  { title: '查询文本', dataIndex: 'query', key: 'query', ellipsis: true, width: 220 },
  { title: '关联分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 100 },
  { title: '检索', key: 'retrieval', width: 160 },
  { title: '重排', key: 'rerank', width: 160 },
  { title: '参考答案', dataIndex: 'reference_answer', key: 'reference_answer', ellipsis: true, width: 180 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 180 },
]

const paginationConfig = usePagination()


const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(d => d.query.toLowerCase().includes(q))
})

// 弹窗
const { modalVisible, submitLoading, isEdit, editingId, formState, openCreate, openEdit, handleSubmit } = useCrudModal({
  defaultForm: () => ({ query: '', ground_truth_refs: [] as GroundTruthRef[], reference_answer: '' }),
  createApi: (form) => createGolden(activeProjectStore.activeProjectId!, form as any),
  updateApi: (id, form) => updateGolden(activeProjectStore.activeProjectId!, id, form as any),
  afterSubmit: fetchList,
})

// 分块选择器 — 使用复合键 "storage_key::chunk_index" 作为 checkbox value
const selectedRefKeys = ref<string[]>([])
const chunkSearchQuery = ref('')
const chunkOptions = ref<ChunkItem[]>([])
const chunksLoading = ref(false)
const chunkOffset = ref(0)
const hasMoreChunks = ref(false)

// 上传相关
const importModalVisible = ref(false)
const importFiles = ref<File[]>([])
const importing = ref(false)
const importResults = ref<(ImportResult & { filename: string })[]>([])
const importCurrentIndex = ref(0)

// 详情 Drawer
const detailDrawerVisible = ref(false)
const detailRecord = ref<GoldenItem | null>(null)

// 检索 Drawer
const retrievalDrawerVisible = ref(false)
const retrievalRecord = ref<GoldenItem | null>(null)
const retrievalResult = ref<RetrievalResponse | null>(null)
const retrievalLoading = ref(false)
const retrievalMaxK = ref(10)
const retrievalStrategy = ref<RetrievalStrategy>('hybrid')
const batchRetrievalStrategy = ref<RetrievalStrategy>('hybrid')
const batchRetrievalMaxK = ref(10)
const batchRetrieveModalVisible = ref(false)

// 批量检索
const batchRetrieving = ref(false)

// 重排 Drawer
const rerankDrawerVisible = ref(false)
const rerankRecord = ref<GoldenItem | null>(null)
const rerankResult = ref<RerankResponse | null>(null)
const rerankLoading = ref(false)
const rerankTopK = ref(10)
const rerankGtChunks = ref<ChunkItem[]>([])
const rerankGtChunksLoading = ref(false)

// 批量重排
const batchReranking = ref(false)
const batchRerankModalVisible = ref(false)
const batchRerankTopK = ref(10)
const batchRerankWarning = ref('')

async function handleBatchRetrieve() {
  batchRetrieveModalVisible.value = false
  const ids = [...selectedRowKeys.value]
  if (ids.length === 0) return

  batchRetrieving.value = true
  const succeeded = await batchExecute(
    ids,
    (id) => createRetrieval(activeProjectStore.activeProjectId!, id, { max_k: batchRetrievalMaxK.value, strategy: batchRetrievalStrategy.value }),
    {
      label: '批量检索',
      onProgress: (_remaining, batchResults, batchSucceededIds) => {
        for (const r of batchResults) {
          const item = dataList.value.find(d => d.id === r.golden_id)
          if (item) {
            item.has_retrieval = true
            const hitItems = r.items.filter(i => i.is_ground_truth)
            item.retrieval_summary = { hit_count: hitItems.length, gt_total: item.ground_truth_refs.length, hit_ranks: hitItems.map(i => i.rank) }
          }
        }
        selectedRowKeys.value = selectedRowKeys.value.filter(k => !batchSucceededIds.includes(k))
      },
    },
  )
  selectedRowKeys.value = selectedRowKeys.value.filter(k => !succeeded.includes(k))
  batchRetrieving.value = false
}

// GT 分块内容
const gtChunks = ref<ChunkItem[]>([])
const gtChunksLoading = ref(false)

function openDetailDrawer(record: GoldenItem) {
  detailRecord.value = record
  detailDrawerVisible.value = true
}

// 检索相关
async function openRetrievalDrawer(record: GoldenItem) {
  retrievalRecord.value = record
  retrievalResult.value = null
  retrievalMaxK.value = 10
  retrievalStrategy.value = 'hybrid'
  retrievalLoading.value = false
  retrievalDrawerVisible.value = true

  // 拉取 GT 分块内容
  gtChunks.value = []
  if (record.ground_truth_refs?.length && activeProjectStore.activeProjectId) {
    gtChunksLoading.value = true
    try {
      const res = await getChunksByRefs(activeProjectStore.activeProjectId, record.ground_truth_refs)
      gtChunks.value = res?.chunks || []
    } catch {
      gtChunks.value = []
    } finally {
      gtChunksLoading.value = false
    }
  }

  // 如果已有检索结果，自动加载
  if (record.retrieval_summary) {
    retrievalLoading.value = true
    try {
      const res = await getRetrieval(activeProjectStore.activeProjectId!, record.id)
      retrievalResult.value = res
    } catch {
      retrievalResult.value = null
    } finally {
      retrievalLoading.value = false
    }
  }
}

async function handleRetrieve() {
  if (!retrievalRecord.value || !activeProjectStore.activeProjectId) return
  retrievalLoading.value = true
  try {
    const res = await createRetrieval(activeProjectStore.activeProjectId, retrievalRecord.value.id, {
      max_k: retrievalMaxK.value,
      strategy: retrievalStrategy.value,
    })
    retrievalResult.value = res
    // 更新列表中的检索状态
    const item = dataList.value.find(d => d.id === retrievalRecord.value!.id)
    if (item) {
      item.has_retrieval = true
      const hitItems = res.items.filter(i => i.is_ground_truth)
      item.retrieval_summary = { hit_count: hitItems.length, gt_total: item.ground_truth_refs.length, hit_ranks: hitItems.map(i => i.rank) }
    }
    message.success('检索完成')
  } catch {
    message.error('检索失败')
  } finally {
    retrievalLoading.value = false
  }
}

function handleReRetrieve() {
  retrievalResult.value = null
}

// 重排相关
async function openRerankDrawer(record: GoldenItem) {
  rerankRecord.value = record
  rerankResult.value = null
  rerankTopK.value = 10
  rerankLoading.value = false
  rerankDrawerVisible.value = true

  // 拉取 GT 分块内容
  rerankGtChunks.value = []
  if (record.ground_truth_refs?.length && activeProjectStore.activeProjectId) {
    rerankGtChunksLoading.value = true
    try {
      const res = await getChunksByRefs(activeProjectStore.activeProjectId, record.ground_truth_refs)
      rerankGtChunks.value = res?.chunks || []
    } catch {
      rerankGtChunks.value = []
    } finally {
      rerankGtChunksLoading.value = false
    }
  }

  // 如果已有重排结果，自动加载
  if (record.has_rerank) {
    rerankLoading.value = true
    try {
      const res = await getRerank(activeProjectStore.activeProjectId!, record.id)
      rerankResult.value = res
    } catch {
      rerankResult.value = null
    } finally {
      rerankLoading.value = false
    }
  }
}

async function handleRerank() {
  if (!rerankRecord.value || !activeProjectStore.activeProjectId) return
  rerankLoading.value = true
  try {
    const res = await createRerank(activeProjectStore.activeProjectId, rerankRecord.value.id, {
      top_k: rerankTopK.value,
    })
    rerankResult.value = res
    // 更新列表中的重排状态
    const item = dataList.value.find(d => d.id === rerankRecord.value!.id)
    if (item) {
      item.has_rerank = true
      const hitItems = res.items.filter(i => i.is_ground_truth)
      item.rerank_summary = { hit_count: hitItems.length, gt_total: item.ground_truth_refs.length, hit_ranks: hitItems.map(i => i.rerank_rank) }
    }
    message.success('重排完成')
  } catch {
    message.error('重排失败')
  } finally {
    rerankLoading.value = false
  }
}

function handleOpenBatchRerank() {
  // 校验选中记录都有粗排结果
  const noRetrievalIds = selectedRowKeys.value.filter(id => {
    const item = dataList.value.find(d => d.id === id)
    return !item?.has_retrieval
  })
  if (noRetrievalIds.length > 0) {
    batchRerankWarning.value = `${noRetrievalIds.length} 条记录无粗排结果，将被跳过`
  } else {
    batchRerankWarning.value = ''
  }
  batchRerankModalVisible.value = true
}

async function handleBatchRerank() {
  batchRerankModalVisible.value = false
  // 只对有粗排结果的记录执行重排
  const ids = selectedRowKeys.value.filter(id => {
    const item = dataList.value.find(d => d.id === id)
    return item?.has_retrieval
  })
  if (ids.length === 0) {
    message.warning('选中的记录均无粗排结果，无法重排')
    return
  }

  batchReranking.value = true
  const succeeded = await batchExecute(
    ids,
    (id) => createRerank(activeProjectStore.activeProjectId!, id, { top_k: batchRerankTopK.value }),
    {
      label: '批量重排',
      onProgress: (_remaining, batchResults, batchSucceededIds) => {
        for (const r of batchResults) {
          const item = dataList.value.find(d => d.id === r.golden_id)
          if (item) {
            item.has_rerank = true
            const hitItems = r.items.filter(i => i.is_ground_truth)
            item.rerank_summary = { hit_count: hitItems.length, gt_total: item.ground_truth_refs.length, hit_ranks: hitItems.map(i => i.rerank_rank) }
          }
        }
        selectedRowKeys.value = selectedRowKeys.value.filter(k => !batchSucceededIds.includes(k))
      },
    },
  )
  selectedRowKeys.value = selectedRowKeys.value.filter(k => !succeeded.includes(k))
  batchReranking.value = false
}

const STRATEGY_LABELS: Record<string, string> = {
  hybrid: 'Hybrid',
  vector: 'Vector',
  cosine: 'Cosine',
  bm25: 'BM25',
}

function strategyLabel(strategy: string) {
  return STRATEGY_LABELS[strategy] || strategy
}

function onSearch() {}

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

async function fetchList() {
  if (!activeProjectStore.activeProjectId) return
  loading.value = true
  try {
    const params: { retrieval_status?: string } = {}
    if (retrievalFilter.value) {
      params.retrieval_status = retrievalFilter.value
    }
    const res = await getGoldenList(activeProjectStore.activeProjectId, params)
    dataList.value = res || []
  } catch {
    message.error('获取黄金数据集失败')
  } finally {
    loading.value = false
  }
}

function onSelectChange(keys: any[]) {
  selectedRowKeys.value = keys as string[]
}

// 新增
function handleCreate() {
  openCreate()
  selectedRefKeys.value = []
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  fetchChunks(true)
}

// 编辑
function handleEdit(record: GoldenItem) {
  openEdit(record.id, {
    query: record.query,
    ground_truth_refs: [...record.ground_truth_refs],
    reference_answer: record.reference_answer,
  })
  selectedRefKeys.value = record.ground_truth_refs.map(r => `${r.storage_key}::${r.chunk_index}`)
  chunkSearchQuery.value = ''
  chunkOptions.value = []
  chunkOffset.value = 0
  fetchChunks(true)
}

// 提交
async function handleFormSubmit() {
  // 将复合键转换为 GroundTruthRef[]
  formState.ground_truth_refs = selectedRefKeys.value.map(key => {
    const [storage_key, indexStr] = key.split('::')
    return { storage_key, chunk_index: parseInt(indexStr, 10) }
  })
  await handleSubmit((form) => {
    if (!form.query.trim()) return '请输入查询文本'
    if (form.ground_truth_refs.length === 0) return '请选择至少一个关联分块'
    return null
  })
}

// 删除
async function handleDelete(id: string) {
  try {
    await deleteGolden(activeProjectStore.activeProjectId!, id)
    message.success('删除成功')
    await fetchList()
  } catch {
    message.error('删除失败')
  }
}

// 批量删除
const { batchProcessing: batchDeleting, handleBatchProcess: _handleBatchDelete } = useBatchProcess({
  selectedRowKeys: () => selectedRowKeys.value,
  setSelectedRowKeys: (keys) => { selectedRowKeys.value = keys },
  canProcess: () => true,
  action: (id) => deleteGolden(activeProjectStore.activeProjectId!, id),
  label: '批量删除',
  onBatchComplete: (_results, batchSucceededIds) => {
    dataList.value = dataList.value.filter(d => !batchSucceededIds.includes(d.id))
  },
})

function handleBatchDelete() {
  _handleBatchDelete()
}

// 分块搜索
async function fetchChunks(reset: boolean = false) {
  if (!activeProjectStore.activeProjectId) return
  chunksLoading.value = true
  if (reset) {
    chunkOffset.value = 0
    chunkOptions.value = []
  }
  try {
    const res = await searchProjectChunks(
      activeProjectStore.activeProjectId,
      chunkSearchQuery.value,
      20,
      chunkOffset.value,
    )
    const chunks = res.chunks || []
    if (reset) {
      chunkOptions.value = chunks
    } else {
      chunkOptions.value = [...chunkOptions.value, ...chunks]
    }
    hasMoreChunks.value = chunks.length === 20
    chunkOffset.value += chunks.length
  } catch {
    // 静默处理
  } finally {
    chunksLoading.value = false
  }
}

function onChunkSearch() {
  fetchChunks(true)
}

function loadMoreChunks() {
  fetchChunks(false)
}

// 上传相关
function beforeUpload(file: File) {
  // 避免重复添加同名文件
  if (!importFiles.value.some(f => f.name === file.name && f.size === file.size)) {
    importFiles.value = [...importFiles.value, file]
  }
  importResults.value = []
  return false // 阻止自动上传
}

function removeImportFile(index: number) {
  importFiles.value = importFiles.value.filter((_, i) => i !== index)
}

async function handleImport() {
  if (importFiles.value.length === 0 || !activeProjectStore.activeProjectId) return
  importing.value = true
  importResults.value = []
  importCurrentIndex.value = 0

  let hasSuccess = false
  for (let i = 0; i < importFiles.value.length; i++) {
    importCurrentIndex.value = i
    try {
      const result = await importGolden(activeProjectStore.activeProjectId, importFiles.value[i])
      importResults.value = [...importResults.value, { ...result, filename: importFiles.value[i].name }]
      if (result.success_count > 0) hasSuccess = true
    } catch {
      importResults.value = [...importResults.value, {
        success_count: 0,
        skipped_count: 0,
        skipped: [],
        filename: importFiles.value[i].name,
      }]
    }
  }

  if (hasSuccess) await fetchList()
  importing.value = false
}

// 模板下载
function downloadTemplate(format: 'jsonl' | 'csv') {
  let content: string
  let filename: string
  let mimeType: string

  if (format === 'jsonl') {
    const example1 = {
      query: '什么是 RAG？',
      ground_truth_refs: [{ storage_key: 'docs/example.md', chunk_index: 0 }, { storage_key: 'docs/example.md', chunk_index: 2 }],
      reference_answer: 'RAG 是检索增强生成技术，结合了信息检索和文本生成。',
      metadata: { type: 'factual', difficulty: 'easy' },
    }
    const example2 = {
      query: '如何评估检索系统的质量？',
      ground_truth_refs: [{ storage_key: 'docs/evaluation.md', chunk_index: 1 }],
      reference_answer: '可以使用 Recall@K、MRR 等指标评估检索质量。',
      metadata: { type: 'procedural', difficulty: 'medium' },
    }
    content = [example1, example2].map(r => JSON.stringify(r)).join('\n')
    filename = 'golden_template.jsonl'
    mimeType = 'application/jsonl'
  } else {
    content = 'query,ground_truth_refs,reference_answer,metadata\n'
    content += '什么是 RAG？,docs/example.md:0;docs/example.md:2,RAG 是检索增强生成技术。,"{""type"":""factual"",""difficulty"":""easy""}"\n'
    content += '如何评估检索系统的质量？,docs/evaluation.md:1,可以使用 Recall@K、MRR 等指标评估检索质量。,"{""type"":""procedural"",""difficulty"":""medium""}"\n'
    filename = 'golden_template.csv'
    mimeType = 'text/csv'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

watch(() => activeProjectStore.activeProjectId, () => {
  fetchList()
}, { immediate: true })

watch(() => pageStore.refreshTrigger, fetchList)

// 打开上传弹窗时重置状态
watch(importModalVisible, (val) => {
  if (val) {
    importFiles.value = []
    importResults.value = []
  }
})
</script>

<style scoped>
@import '@/styles/common-table.css';

.status-filter {
  width: 120px;
}
.search-input {
  width: 220px;
}

.query-cell {
  font-weight: 500;
}
.answer-cell {
  color: var(--ant-color-text-tertiary);
  font-size: 13px;
}

.chunk-selector {
  border: 1px solid var(--ant-color-border);
  border-radius: 6px;
  padding: 8px 12px;
  max-height: 280px;
  overflow-y: auto;
}
.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chunk-option {
  padding: 4px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary);
}
.chunk-option:last-child {
  border-bottom: none;
}
.chunk-doc {
  font-weight: 500;
  color: var(--ant-color-text-tertiary);
  font-size: 11px;
}
.chunk-heading {
  font-weight: 500;
  color: var(--ant-color-primary);
  font-size: 12px;
}
.chunk-content {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
}
.load-more {
  text-align: center;
  padding: 8px;
  color: var(--ant-color-primary);
  cursor: pointer;
  font-size: 13px;
}
.load-more:hover {
  opacity: 0.8;
}
.selected-info {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ant-color-primary);
}

.drawer-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--ant-color-bg-container);
  border-top: 1px solid var(--ant-color-border);
  text-align: right;
}

/* 上传弹窗 */
.import-modal-content {
  padding: 8px 0;
}
.import-file-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.import-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.import-templates {
  margin-top: 16px;
  padding: 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  font-size: 13px;
}
.template-label {
  color: var(--ant-color-text-tertiary);
  margin-right: 4px;
}
.import-actions {
  margin-top: 16px;
  text-align: right;
}
.import-result {
  margin-top: 16px;
}
.import-result-item {
  margin-bottom: 8px;
}
.import-progress {
  margin-top: 12px;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--ant-color-primary);
}
.skipped-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.skipped-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}
.skipped-item {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  padding: 2px 0;
}

/* 详情 Drawer */
.detail-answer {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}
.detail-metadata {
  margin: 0;
  font-size: var(--ant-font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
}

/* 检索 Drawer - 内容样式 */
.retrieval-query-section {
  flex-shrink: 0;
}
.retrieval-query-label {
  font-size: 13px;
  color: var(--ant-color-text-tertiary);
  margin-bottom: 4px;
}
.retrieval-query-text {
  font-weight: 500;
  font-size: 14px;
  padding: 8px 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
}
.retrieval-id-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--ant-font-family-code, monospace);
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  padding: 4px 8px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 4px;
  word-break: break-all;
  cursor: pointer;
  transition: background 0.2s;
}
.retrieval-id-text:hover {
  background: var(--ant-color-fill-tertiary);
}
.retrieval-id-value {
  flex: 1;
  min-width: 0;
}
.retrieval-id-copy-icon {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ant-color-text-quaternary);
  transition: color 0.2s;
}
.retrieval-id-text:hover .retrieval-id-copy-icon {
  color: var(--ant-color-primary);
}
.retrieval-answer-text {
  font-size: 13px;
  padding: 8px 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
.retrieval-metadata-text {
  margin: 0;
  font-size: 12px;
  font-family: var(--ant-font-family-code, monospace);
  padding: 8px 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
.retrieval-gt-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.retrieval-gt-label {
  font-size: 13px;
  color: var(--ant-color-text-tertiary);
  margin-bottom: 8px;
}
.retrieval-gt-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.retrieval-params {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.retrieval-param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.retrieval-param-label {
  font-size: 13px;
  color: var(--ant-color-text-secondary);
}
.retrieval-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  justify-content: center;
  color: var(--ant-color-primary);
}
.retrieval-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.retrieval-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.retrieval-item-wrap {
  position: relative;
}
.retrieval-gt-tag {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
}
.retrieval-actions {
  margin-top: 16px;
  text-align: right;
  flex-shrink: 0;
}
</style>
