<template>
  <a-drawer
    :open="visible"
    :title="drawerTitle"
    width="50%"
    placement="right"
    @close="handleClose"
  >
    <!-- 控制按钮 -->
    <div v-if="!readOnly" class="drawer-header">
      <div class="drawer-header-actions">
        <a-button v-if="taskStatus === 'running'" size="small" @click="handlePause">暂停</a-button>
        <a-button v-if="taskStatus === 'paused'" size="small" type="primary" @click="handleResume">继续</a-button>
        <a-button v-if="['running', 'paused'].includes(taskStatus)" size="small" danger @click="handleCancel">取消</a-button>
        <a-button v-if="taskStatus === 'completed' && progress.failed > 0" size="small" type="primary" @click="handleRetry">重试失败</a-button>
      </div>
    </div>

    <!-- 参数摘要 -->
    <div v-if="configSummary" class="config-summary">
      <span v-for="item in configSummary" :key="item.label" class="config-item">
        <span class="config-label">{{ item.label }}:</span>
        <span class="config-value">{{ item.value }}</span>
      </span>
    </div>

    <!-- 模型输出 -->
    <div class="event-log" ref="logContainer">
      <div v-for="(item, idx) in eventItems" :key="idx" class="event-item" :class="`event-${item.type}`">
        <!-- Phase 开始 -->
        <template v-if="item.type === 'phase_start'">
          <div class="phase-label">
            <span v-if="item.phase === 'question_gen'">Phase 1: 问题生成</span>
            <span v-else-if="item.phase === 'answer_gen'">Phase 2: 答案生成</span>
            <span v-else>{{ item.phase }}</span>
          </div>
        </template>

        <!-- 问题生成 -->
        <template v-else-if="item.type === 'question_generated'">
          <div class="question-item">
            <check-circle-outlined class="icon-success" />
            <span class="question-text">{{ item.query }}</span>
            <a-tag size="small" class="question-meta-tag">{{ item.type_name }}</a-tag>
            <a-tag size="small" class="question-meta-tag">{{ item.difficulty }}</a-tag>
          </div>
        </template>

        <!-- LLM 流式输出 -->
        <template v-else-if="item.type === 'llm_streaming'">
          <div class="llm-streaming">
            <loading-outlined spin class="icon-loading" />
            <span class="streaming-text">{{ item.content }}</span>
            <span class="cursor-blink">|</span>
          </div>
        </template>

        <!-- 结果 -->
        <template v-else-if="item.type === 'result'">
          <div class="result-item" :class="item.status === 'success' ? 'result-success' : 'result-failed'">
            <check-circle-outlined v-if="item.status === 'success'" class="icon-success" />
            <close-circle-outlined v-else class="icon-error" />
            <span class="result-query">{{ item.query }}</span>
            <span v-if="item.status === 'success' && item.quality_score" class="result-score">质量: {{ item.quality_score }}</span>
            <span v-if="item.status === 'failed'" class="result-error">{{ item.error }}</span>
            <a-button v-if="item.status === 'failed'" size="small" type="link" @click="handleRetry">重试</a-button>
          </div>
        </template>

        <!-- 任务完成 -->
        <template v-else-if="item.type === 'task_done'">
          <div class="task-done">任务完成：{{ item.completed }} 成功，{{ item.failed }} 失败</div>
        </template>

        <!-- 任务失败 -->
        <template v-else-if="item.type === 'task_failed'">
          <div class="task-failed">任务异常：{{ item.error }}</div>
        </template>

        <!-- 任务取消 -->
        <template v-else-if="item.type === 'task_cancelled'">
          <div class="task-cancelled">任务已取消</div>
        </template>
      </div>
    </div>

    <!-- 只读模式：已生成记录列表 -->
    <div v-if="readOnly && goldenRecords.length > 0" class="readonly-records">
      <div v-for="record in goldenRecords" :key="record.id" class="readonly-record-item">
        <div class="readonly-record-header">
          <span class="readonly-record-query">{{ record.query }}</span>
          <a-tag :color="record.status === 'approved' ? 'green' : record.status === 'pending_review' ? 'orange' : 'red'" size="small">
            {{ record.status === 'approved' ? '已通过' : record.status === 'pending_review' ? '待审核' : '已拒绝' }}
          </a-tag>
        </div>
        <div class="readonly-record-meta">
          <a-tag v-if="record.metadata?.type" size="small">{{ record.metadata.type }}</a-tag>
          <span v-if="record.metadata?.quality_score" class="readonly-record-score">质量: {{ record.metadata.quality_score }}</span>
        </div>
        <div v-if="record.reference_answer" class="readonly-record-answer">{{ record.reference_answer }}</div>
      </div>
    </div>
    <a-empty v-else-if="readOnly && goldenRecords.length === 0 && !recordsLoading" description="暂无黄金记录" />
    <a-spin v-if="recordsLoading" />
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import {
  getGenerationStreamUrl,
  pauseGenerationTask,
  resumeGenerationTask,
  cancelGenerationTask,
  retryFailedGeneration,
  getGenerationTask,
} from '@/api/generationTask'
import { getDocumentGoldenRecords } from '@/api/goldenDataset'

interface Props {
  visible: boolean
  projectId: string
  taskId: string
  docName?: string
  documentId?: string
  configSummary?: { label: string; value: string }[]
  readOnly?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'completed'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const taskStatus = ref<string>('running')
const progress = ref({ completed: 0, total: 0, failed: 0 })
const eventItems = ref<any[]>([])
const logContainer = ref<HTMLElement | null>(null)
const goldenRecords = ref<any[]>([])
const recordsLoading = ref(false)

let eventSource: EventSource | null = null
let streamingItem: any = null
let streamingTypingTimer: ReturnType<typeof setInterval> | null = null

const drawerTitle = computed(() => {
  const name = props.docName || '生成进度'
  if (props.readOnly) return `黄金记录 — ${name}`
  return `生成进度 — ${name}`
})

function connectSSE() {
  if (!props.taskId || !props.projectId || props.readOnly) return

  disconnectSSE()

  const url = getGenerationStreamUrl(props.projectId, props.taskId)
  eventSource = new EventSource(url)

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data)
    progress.value = { completed: data.completed, total: data.total, failed: data.failed }
  })

  eventSource.addEventListener('phase_start', (e) => {
    const data = JSON.parse(e.data)
    finishStreaming()
    eventItems.value.push({ type: 'phase_start', ...data })
    scrollToBottom()
  })

  eventSource.addEventListener('llm_token', (e) => {
    const data = JSON.parse(e.data)
    if (!streamingItem) {
      streamingItem = { type: 'llm_streaming', content: '' }
      eventItems.value.push(streamingItem)
    }
    // 逐字追加，模拟打字效果
    const chars = data.content
    let i = 0
    if (streamingTypingTimer) clearInterval(streamingTypingTimer)
    streamingTypingTimer = setInterval(() => {
      if (i < chars.length) {
        streamingItem.content += chars[i]
        i++
        scrollToBottom()
      } else {
        clearInterval(streamingTypingTimer)
        streamingTypingTimer = null
      }
    }, 20)
  })

  eventSource.addEventListener('llm_done', () => {
    finishStreaming()
  })

  eventSource.addEventListener('question_generated', (e) => {
    const data = JSON.parse(e.data)
    eventItems.value.push({
      type: 'question_generated',
      query: data.query,
      type_name: data.type || 'factual',
      difficulty: data.difficulty || 'medium',
    })
    scrollToBottom()
  })

  eventSource.addEventListener('result', (e) => {
    const data = JSON.parse(e.data)
    finishStreaming()
    eventItems.value.push({ type: 'result', ...data })
    scrollToBottom()
  })

  eventSource.addEventListener('task_done', (e) => {
    const data = JSON.parse(e.data)
    taskStatus.value = 'completed'
    finishStreaming()
    eventItems.value.push({ type: 'task_done', ...data })
    disconnectSSE()
    emit('completed')
    scrollToBottom()
  })

  eventSource.addEventListener('task_failed', (e) => {
    const data = JSON.parse(e.data)
    taskStatus.value = 'failed'
    finishStreaming()
    eventItems.value.push({ type: 'task_failed', ...data })
    disconnectSSE()
    scrollToBottom()
  })

  eventSource.addEventListener('task_cancelled', () => {
    taskStatus.value = 'cancelled'
    finishStreaming()
    eventItems.value.push({ type: 'task_cancelled' })
    disconnectSSE()
    scrollToBottom()
  })

  eventSource.onerror = () => {
    // SSE 断线，EventSource 会自动重连
  }
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (streamingTypingTimer) {
    clearInterval(streamingTypingTimer)
    streamingTypingTimer = null
  }
}

function finishStreaming() {
  // 立即刷完剩余字符
  if (streamingTypingTimer) {
    clearInterval(streamingTypingTimer)
    streamingTypingTimer = null
  }
  streamingItem = null
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

async function loadGoldenRecords() {
  if (!props.readOnly || !props.projectId || !props.documentId) return
  recordsLoading.value = true
  try {
    const res = await getDocumentGoldenRecords(props.projectId, props.documentId)
    goldenRecords.value = res || []
  } catch {
    goldenRecords.value = []
  } finally {
    recordsLoading.value = false
  }
}

async function handlePause() {
  try {
    await pauseGenerationTask(props.projectId, props.taskId)
    taskStatus.value = 'paused'
    message.success('任务已暂停')
  } catch {
    message.error('暂停失败')
  }
}

async function handleResume() {
  try {
    await resumeGenerationTask(props.projectId, props.taskId)
    taskStatus.value = 'running'
    message.success('任务已继续')
  } catch {
    message.error('继续失败')
  }
}

async function handleCancel() {
  try {
    await cancelGenerationTask(props.projectId, props.taskId)
    taskStatus.value = 'cancelled'
    disconnectSSE()
    message.success('任务已取消')
  } catch {
    message.error('取消失败')
  }
}

async function handleRetry() {
  try {
    await retryFailedGeneration(props.projectId, props.taskId)
    taskStatus.value = 'running'
    connectSSE()
    message.success('正在重试失败项')
  } catch {
    message.error('重试失败')
  }
}

function handleClose() {
  disconnectSSE()
  emit('close')
}

// 监听 visible 和 taskId 变化
watch(() => [props.visible, props.taskId], ([vis, tid]) => {
  if (vis && tid) {
    if (props.readOnly) {
      loadGoldenRecords()
    } else {
      taskStatus.value = 'running'
      progress.value = { completed: 0, total: 0, failed: 0 }
      eventItems.value = []
      streamingItem = null
      connectSSE()
    }
  } else {
    disconnectSSE()
  }
}, { immediate: true })

onUnmounted(() => {
  disconnectSSE()
})
</script>

<style scoped>
.drawer-header {
  margin-bottom: 16px;
}

.drawer-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.drawer-header-actions {
  display: flex;
  gap: 6px;
}

.config-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
}

.config-label {
  color: #999;
}

.config-value {
  color: #333;
  font-weight: 500;
}

.event-log {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
}

.event-item {
  padding: 2px 0;
}

.phase-label {
  font-weight: 500;
  color: #1677ff;
  margin-top: 8px;
  margin-bottom: 4px;
}

.question-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.question-text {
  flex: 1;
}

.question-meta-tag {
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
}

.llm-streaming {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 2px 0;
  color: #666;
}

.streaming-text {
  white-space: pre-wrap;
  word-break: break-all;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: #1677ff;
}

@keyframes blink {
  50% { opacity: 0; }
}

.result-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.result-success {
  color: #52c41a;
}

.result-failed {
  color: #ff4d4f;
}

.result-query {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-score {
  color: #888;
  font-size: 12px;
}

.result-error {
  color: #ff4d4f;
  font-size: 12px;
}

.icon-success { color: #52c41a; }
.icon-error { color: #ff4d4f; }
.icon-loading { color: #1677ff; }

.task-done {
  color: #52c41a;
  font-weight: 500;
  margin-top: 8px;
  padding: 8px;
  background: #f6ffed;
  border-radius: 4px;
}

.task-failed {
  color: #ff4d4f;
  font-weight: 500;
  margin-top: 8px;
  padding: 8px;
  background: #fff2f0;
  border-radius: 4px;
}

.task-cancelled {
  color: #999;
  font-weight: 500;
  margin-top: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
}

/* 只读记录列表 */
.readonly-records {
  margin-top: 12px;
}

.readonly-record-item {
  padding: 10px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 8px;
}

.readonly-record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.readonly-record-query {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.readonly-record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.readonly-record-score {
  font-size: 11px;
  color: #8c8c8c;
}

.readonly-record-answer {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
}
</style>
