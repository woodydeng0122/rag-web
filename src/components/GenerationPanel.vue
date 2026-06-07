<template>
  <div v-if="visible" class="generation-panel">
    <div class="panel-header" @click="collapsed = !collapsed">
      <div class="panel-header-left">
        <span class="panel-title">生成任务</span>
        <a-tag v-if="taskStatus === 'running'" color="processing">运行中</a-tag>
        <a-tag v-else-if="taskStatus === 'paused'" color="warning">已暂停</a-tag>
        <a-tag v-else-if="taskStatus === 'completed'" color="success">已完成</a-tag>
        <a-tag v-else-if="taskStatus === 'failed'" color="error">失败</a-tag>
        <a-tag v-else-if="taskStatus === 'cancelled'" color="default">已取消</a-tag>
        <span class="panel-progress-text">{{ progress.completed }}/{{ progress.total }} 完成 {{ progress.failed }} 失败</span>
      </div>
      <div class="panel-header-right" @click.stop>
        <a-button v-if="taskStatus === 'running'" size="small" @click="handlePause">暂停</a-button>
        <a-button v-if="taskStatus === 'paused'" size="small" type="primary" @click="handleResume">继续</a-button>
        <a-button v-if="['running', 'paused'].includes(taskStatus)" size="small" danger @click="handleCancel">取消</a-button>
        <a-button v-if="taskStatus === 'completed' && progress.failed > 0" size="small" type="primary" @click="handleRetry">重试失败</a-button>
        <a-button size="small" @click="handleClose">关闭</a-button>
        <span class="collapse-icon">{{ collapsed ? '▼' : '▲' }}</span>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-body">
      <!-- 进度条 -->
      <a-progress
        :percent="progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0"
        :status="taskStatus === 'failed' ? 'exception' : taskStatus === 'completed' ? 'success' : 'active'"
        size="small"
        style="margin-bottom: 12px"
      />

      <!-- 事件流 -->
      <div class="event-log" ref="logContainer">
        <div v-for="(item, idx) in eventItems" :key="idx" class="event-item" :class="`event-${item.type}`">
          <!-- Phase 开始 -->
          <template v-if="item.type === 'phase_start'">
            <div class="phase-label">
              <span v-if="item.phase === 'question_gen'">Phase 1: 问题生成</span>
              <span v-else-if="item.phase === 'answer_gen'">Phase 2: 答案生成</span>
              <span v-else>{{ item.phase }}</span>
              <span v-if="item.doc_id" class="phase-doc"> — {{ item.doc_id }}</span>
            </div>
          </template>

          <!-- 问题生成 -->
          <template v-else-if="item.type === 'question_generated'">
            <div class="question-item">
              <check-circle-outlined class="icon-success" />
              <span class="question-text">{{ item.query }}</span>
              <a-tag size="small" class="question-type-tag">{{ item.type_name }}</a-tag>
              <a-tag size="small" class="question-diff-tag">{{ item.difficulty }}</a-tag>
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
              <a-button v-if="item.status === 'failed'" size="small" type="link" @click="handleRetrySingle(idx)">重试</a-button>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
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
} from '@/api/generationTask'

interface Props {
  visible: boolean
  projectId: string
  taskId: string
}

interface Emits {
  (e: 'close'): void
  (e: 'completed'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const collapsed = ref(false)
const taskStatus = ref<string>('running')
const progress = ref({ completed: 0, total: 0, failed: 0 })
const eventItems = ref<any[]>([])
const logContainer = ref<HTMLElement | null>(null)

let eventSource: EventSource | null = null
let streamingItem: any = null

function connectSSE() {
  if (!props.taskId || !props.projectId) return

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
    streamingItem.content += data.content
    scrollToBottom()
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
}

function finishStreaming() {
  streamingItem = null
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
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

function handleRetrySingle(_idx: number) {
  // 单条重试通过整体重试实现
  handleRetry()
}

function handleClose() {
  disconnectSSE()
  emit('close')
}

// 监听 visible 和 taskId 变化
watch(() => [props.visible, props.taskId], ([vis, tid]) => {
  if (vis && tid) {
    taskStatus.value = 'running'
    progress.value = { completed: 0, total: 0, failed: 0 }
    eventItems.value = []
    streamingItem = null
    connectSSE()
  } else {
    disconnectSSE()
  }
}, { immediate: true })

onUnmounted(() => {
  disconnectSSE()
})
</script>

<style scoped>
.generation-panel {
  margin-bottom: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #fafafa;
  cursor: pointer;
  user-select: none;
}

.panel-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-title {
  font-weight: 500;
  font-size: 14px;
}

.panel-progress-text {
  color: #888;
  font-size: 13px;
}

.collapse-icon {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

.panel-body {
  padding: 12px 16px;
}

.event-log {
  max-height: 320px;
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

.phase-doc {
  color: #888;
  font-weight: normal;
  font-size: 12px;
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

.question-type-tag,
.question-diff-tag {
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

.icon-success {
  color: #52c41a;
}

.icon-error {
  color: #ff4d4f;
}

.icon-loading {
  color: #1677ff;
}

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
</style>
