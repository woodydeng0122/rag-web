<template>
  <div class="qa-page">
    <!-- 未选择项目提示 -->
    <div v-if="!activeProjectStore.activeProjectId" class="qa-empty">
      <NoProjectPrompt description="请先选择一个项目" button-text="选择项目" />
    </div>

    <template v-else>
      <div class="qa-layout">
        <!-- 左侧：会话列表 -->
        <div class="qa-sidebar">
          <div class="qa-sidebar-header">
            <span class="qa-sidebar-title">对话</span>
            <a-button type="text" size="small" class="qa-sidebar-new-btn" @click="handleNewSession">
              <template #icon><plus-outlined /></template>
              新对话
            </a-button>
          </div>
          <div v-if="sessions.length > 5" class="qa-sidebar-search">
            <a-input
              v-model:value="searchKeyword"
              placeholder="搜索对话"
              size="small"
              allow-clear
            >
              <template #prefix><search-outlined class="qa-search-icon" /></template>
            </a-input>
          </div>
          <div class="qa-sidebar-list">
            <template v-if="filteredGroupedSessions.length > 0">
              <div v-for="group in filteredGroupedSessions" :key="group.label" class="qa-session-group">
                <div class="qa-session-group-label">{{ group.label }}</div>
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="qa-session-item"
                  :class="{ 'qa-session-item--active': activeSessionId === item.id }"
                  @click="handleSelectSession(item.id)"
                >
                  <div class="qa-session-item-body">
                    <message-outlined class="qa-session-item-icon" />
                    <div class="qa-session-item-content">
                      <div class="qa-session-item-title">{{ item.title || '新对话' }}</div>
                      <div class="qa-session-item-time">{{ formatRelativeTime(item.updated_at) }}</div>
                    </div>
                  </div>
                  <div class="qa-session-item-actions">
                    <a-button
                      type="text"
                      size="small"
                      class="qa-session-item-delete"
                      @click.stop="handleDeleteSession(item.id)"
                    >
                      <template #icon><delete-outlined /></template>
                    </a-button>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="qa-sidebar-empty">
              <comment-outlined class="qa-sidebar-empty-icon" />
              <p v-if="searchKeyword" class="qa-sidebar-empty-text">未找到匹配的对话</p>
              <p v-else class="qa-sidebar-empty-text">暂无对话</p>
            </div>
          </div>
        </div>

        <!-- 右侧：聊天区域 -->
        <div class="qa-main">
          <div class="qa-container">
            <!-- 消息列表区域 -->
            <div ref="messageListRef" class="qa-messages">
              <!-- 空状态 -->
              <div v-if="displayMessages.length === 0" class="qa-welcome">
                <div class="qa-welcome-icon">
                  <comment-outlined />
                </div>
                <h2 class="qa-welcome-title">智能问答</h2>
                <p class="qa-welcome-desc">基于项目文档库进行检索增强问答，输入问题即可获得答案和来源引用</p>
                <div class="qa-welcome-tips">
                  <div v-for="tip in sampleQuestions" :key="tip" class="qa-tip-card" @click="handleTipClick(tip)">
                    {{ tip }}
                  </div>
                </div>
              </div>

              <!-- 消息列表 -->
              <template v-for="msg in displayMessages" :key="msg.id">
                <!-- 用户问题：右对齐 -->
                <div class="qa-message-row qa-message-row--user">
                  <div class="qa-bubble qa-bubble--user">
                    {{ msg.content }}
                  </div>
                  <div class="qa-avatar qa-avatar--user">
                    <user-outlined />
                  </div>
                </div>

                <!-- AI 回答：左对齐 -->
                <div v-if="msg.role === 'user' && (msg.answer || msg.loading)" class="qa-message-row qa-message-row--ai">
                  <div class="qa-avatar qa-avatar--ai">
                    <robot-outlined />
                  </div>
                  <div class="qa-bubble qa-bubble--ai">
                    <!-- 加载状态 -->
                    <div v-if="msg.loading" class="qa-loading">
                      <a-spin size="small" />
                      <span>正在检索并生成回答...</span>
                    </div>

                    <template v-else>
                      <!-- 回答内容 -->
                      <div class="qa-answer-content">
                        <markdown-renderer :content="msg.answer || '暂无回答'" file-type="markdown" />
                      </div>

                      <!-- 元信息 -->
                      <div class="qa-answer-meta">
                        <span v-if="msg.latency_ms" class="qa-meta-item">
                          <clock-circle-outlined />
                          {{ (msg.latency_ms / 1000).toFixed(1) }}s
                        </span>
                        <span v-if="msg.chunks?.length" class="qa-meta-item">
                          <file-search-outlined />
                          {{ msg.chunks.length }} 个引用
                        </span>
                      </div>

                      <!-- 引用来源 -->
                      <div v-if="msg.chunks?.length" class="qa-sources">
                        <div
                          class="qa-sources-header"
                          @click="msg.sourcesExpanded = !msg.sourcesExpanded"
                        >
                          <span>
                            <link-outlined />
                            引用来源
                          </span>
                          <up-outlined v-if="msg.sourcesExpanded" />
                          <down-outlined v-else />
                        </div>
                        <div v-show="msg.sourcesExpanded" class="qa-sources-list">
                          <div
                            v-for="(chunk, idx) in msg.chunks"
                            :key="chunk.chunk_id"
                            class="qa-source-item"
                          >
                            <div class="qa-source-header">
                              <a-tag color="blue" size="small">#{{ idx + 1 }}</a-tag>
                              <span class="qa-source-file">
                                <file-text-outlined />
                                {{ chunk.source_file }}
                              </span>
                              <span class="qa-source-score">
                                相关度 {{ (chunk.score * 100).toFixed(1) }}%
                              </span>
                            </div>
                            <div class="qa-source-content">{{ chunk.content }}</div>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </div>

            <!-- 输入区域 -->
            <div class="qa-input-area">
              <div class="qa-input-wrapper">
                <a-textarea
                  ref="inputRef"
                  v-model:value="inputText"
                  :placeholder="inputPlaceholder"
                  :auto-size="{ minRows: 1, maxRows: 4 }"
                  :disabled="asking"
                  @pressEnter="handleEnter"
                />
                <a-button
                  type="primary"
                  :disabled="!inputText.trim() || asking"
                  :loading="asking"
                  class="qa-send-btn"
                  @click="handleSend"
                >
                  <template #icon><send-outlined /></template>
                </a-button>
              </div>
              <div class="qa-input-hint">Enter 发送，Shift + Enter 换行</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message as antMessage, Modal } from 'ant-design-vue'
import { useActiveProjectStore } from '@/store/activeProject'
import { dayjs } from '@/utils/time'
import { createSession, getSessions, deleteSession, getMessages, askStream } from '@/api/qa'
import type { QASession, QAChunk, SSEEvent } from '@/api/model/qaModel'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import NoProjectPrompt from '@/components/NoProjectPrompt.vue'
import {
  UserOutlined,
  RobotOutlined,
  SendOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  LinkOutlined,
  UpOutlined,
  DownOutlined,
  FileTextOutlined,
  CommentOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  MessageOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const activeProjectStore = useActiveProjectStore()

const inputText = ref('')
const asking = ref(false)
const messageListRef = ref<HTMLElement>()
const inputRef = ref()

// ── 会话管理 ──
const sessions = ref<QASession[]>([])
const sessionsLoading = ref(false)
const activeSessionId = ref<string | null>(null)
const searchKeyword = ref('')

// ── 会话分组 ──
interface SessionGroup {
  label: string
  items: QASession[]
}

const filteredGroupedSessions = computed<SessionGroup[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const filtered = keyword
    ? sessions.value.filter(s => (s.title || '新对话').toLowerCase().includes(keyword))
    : sessions.value

  const now = dayjs()
  const todayStart = now.startOf('day')
  const yesterdayStart = todayStart.subtract(1, 'day')
  const weekStart = todayStart.subtract(7, 'day')

  const groups: SessionGroup[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '7天内', items: [] },
    { label: '更早', items: [] },
  ]

  for (const s of filtered) {
    const t = dayjs(s.updated_at)
    if (t.isAfter(todayStart)) {
      groups[0].items.push(s)
    } else if (t.isAfter(yesterdayStart)) {
      groups[1].items.push(s)
    } else if (t.isAfter(weekStart)) {
      groups[2].items.push(s)
    } else {
      groups[3].items.push(s)
    }
  }

  return groups.filter(g => g.items.length > 0)
})

// ── 消息展示 ──
interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer: string
  chunks: QAChunk[]
  latency_ms: number | null
  loading: boolean
  sourcesExpanded: boolean
}

const displayMessages = ref<DisplayMessage[]>([])

const sampleQuestions = [
  '项目文档的核心内容是什么？',
  '有哪些关键的技术决策？',
  '系统架构是如何设计的？',
]

const inputPlaceholder = computed(() =>
  asking.value ? '正在生成回答...' : '输入你的问题',
)

// ── 会话操作 ──

async function fetchSessions() {
  const projectId = activeProjectStore.activeProjectId
  if (!projectId) return
  sessionsLoading.value = true
  try {
    sessions.value = await getSessions(projectId)
  } catch {
    // 静默处理
  } finally {
    sessionsLoading.value = false
  }
}

async function handleNewSession() {
  const projectId = activeProjectStore.activeProjectId
  if (!projectId) return
  try {
    const session = await createSession(projectId)
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    displayMessages.value = []
    nextTick(() => inputRef.value?.focus())
  } catch {
    antMessage.error('创建会话失败')
  }
}

async function handleSelectSession(sessionId: string) {
  if (activeSessionId.value === sessionId) return
  activeSessionId.value = sessionId
  await loadMessages(sessionId)
}

async function loadMessages(sessionId: string) {
  const projectId = activeProjectStore.activeProjectId
  if (!projectId) return
  try {
    const msgs = await getMessages(projectId, sessionId)
    displayMessages.value = msgs.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      answer: m.role === 'assistant' ? m.content : '',
      chunks: m.chunks || [],
      latency_ms: m.latency_ms,
      loading: false,
      sourcesExpanded: false,
    }))
    // 将 user 消息和其对应的 assistant 消息合并展示
    // user 消息的 answer 字段指向下一条 assistant 消息
    for (let i = 0; i < displayMessages.value.length; i++) {
      const msg = displayMessages.value[i]
      if (msg.role === 'user' && i + 1 < displayMessages.value.length) {
        const next = displayMessages.value[i + 1]
        if (next.role === 'assistant') {
          msg.answer = next.content
          msg.chunks = next.chunks
          msg.latency_ms = next.latency_ms
          msg.sourcesExpanded = false
        }
      }
    }
    scrollToBottom()
  } catch {
    antMessage.error('加载消息失败')
  }
}

function handleDeleteSession(sessionId: string) {
  const session = sessions.value.find(s => s.id === sessionId)
  Modal.confirm({
    title: '删除对话',
    content: `确定删除「${session?.title || '新对话'}」？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const projectId = activeProjectStore.activeProjectId
      if (!projectId) return
      try {
        await deleteSession(projectId, sessionId)
        sessions.value = sessions.value.filter(s => s.id !== sessionId)
        if (activeSessionId.value === sessionId) {
          activeSessionId.value = null
          displayMessages.value = []
        }
      } catch {
        antMessage.error('删除会话失败')
      }
    },
  })
}

// ── 问答操作 ──

function handleTipClick(tip: string) {
  inputText.value = tip
  handleSend()
}

function handleEnter(e: KeyboardEvent) {
  if (e.shiftKey) return
  e.preventDefault()
  handleSend()
}

async function handleSend() {
  const question = inputText.value.trim()
  if (!question || asking.value) return

  const projectId = activeProjectStore.activeProjectId!
  asking.value = true
  inputText.value = ''

  // 如果没有活跃会话，自动创建
  if (!activeSessionId.value) {
    try {
      const session = await createSession(projectId, { title: question.slice(0, 50) })
      sessions.value.unshift(session)
      activeSessionId.value = session.id
    } catch {
      antMessage.error('创建会话失败')
      asking.value = false
      return
    }
  }

  const sessionId = activeSessionId.value!

  // 添加用户消息
  const userMsg: DisplayMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: question,
    answer: '',
    chunks: [],
    latency_ms: null,
    loading: true,
    sourcesExpanded: false,
  }
  displayMessages.value.push(userMsg)
  scrollToBottom()

  try {
    await askStream(projectId, sessionId, { query: question }, (event: SSEEvent) => {
      const msg = displayMessages.value.find(m => m.id === userMsg.id)
      if (!msg) return

      if (event.type === 'sources') {
        msg.chunks = event.chunks || []
      } else if (event.type === 'chunk') {
        msg.answer += event.data || ''
        msg.loading = false
        scrollToBottom()
      } else if (event.type === 'done') {
        msg.latency_ms = event.latency_ms || null
        msg.loading = false
      } else if (event.type === 'error') {
        msg.answer = msg.answer || '生成回答时出现错误，请稍后重试。'
        msg.loading = false
      }
    })
  } catch {
    const msg = displayMessages.value.find(m => m.id === userMsg.id)
    if (msg) {
      msg.answer = '抱歉，生成回答时出现错误，请稍后重试。'
      msg.loading = false
    }
  } finally {
    asking.value = false
    scrollToBottom()
    nextTick(() => inputRef.value?.focus())
    // 刷新会话列表（标题可能已更新）
    fetchSessions()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function formatRelativeTime(dateStr: string): string {
  return dateStr ? dayjs(dateStr).fromNow() : ''
}

// ── 生命周期 ──

onMounted(() => {
  fetchSessions()
  inputRef.value?.focus()
})

watch(() => activeProjectStore.activeProjectId, () => {
  activeSessionId.value = null
  displayMessages.value = []
  fetchSessions()
})
</script>

<style scoped>
.qa-page {
  height: calc(100dvh - 56px - 48px);
  display: flex;
  flex-direction: column;
}

.qa-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* 整体布局：左侧栏 + 右侧聊天 */
.qa-layout {
  display: flex;
  height: 100%;
  gap: 0;
  background: var(--ant-color-bg-container);
  border-radius: 10px;
  overflow: hidden;
}

/* 左侧会话列表 */
.qa-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--ant-color-border-secondary);
  display: flex;
  flex-direction: column;
  background: var(--ant-color-bg-container);
}
.qa-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
}
.qa-sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ant-color-text);
}
.qa-sidebar-new-btn {
  font-size: 13px;
  color: var(--ant-color-primary);
  font-weight: 500;
}
.qa-sidebar-search {
  padding: 0 12px 8px;
}
.qa-sidebar-search :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  background: var(--ant-color-bg-container);
}
.qa-search-icon {
  color: var(--ant-color-text-quaternary);
  font-size: 12px;
}
.qa-sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

/* 会话分组 */
.qa-session-group {
  margin-bottom: 4px;
}
.qa-session-group-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--ant-color-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 8px 4px;
}

/* 会话项 */
.qa-session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 4px;
}
.qa-session-item:hover {
  background: var(--ant-color-fill-quaternary);
}
.qa-session-item--active {
  background: var(--ant-color-primary-bg);
}
.qa-session-item--active:hover {
  background: var(--ant-color-primary-bg);
}
.qa-session-item--active .qa-session-item-icon {
  color: var(--ant-color-primary);
}
.qa-session-item--active .qa-session-item-title {
  color: var(--ant-color-primary);
  font-weight: 500;
}
.qa-session-item-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.qa-session-item-icon {
  font-size: 14px;
  color: var(--ant-color-text-quaternary);
  flex-shrink: 0;
  margin-top: 2px;
}
.qa-session-item-content {
  min-width: 0;
  flex: 1;
}
.qa-session-item-title {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ant-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qa-session-item-time {
  font-size: 11px;
  color: var(--ant-color-text-quaternary);
  margin-top: 1px;
}
.qa-session-item-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.qa-session-item:hover .qa-session-item-actions {
  opacity: 1;
}
.qa-session-item-delete {
  font-size: 12px;
  color: var(--ant-color-text-quaternary);
}
.qa-session-item-delete:hover {
  color: var(--ant-color-error) !important;
}

/* 空状态 */
.qa-sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}
.qa-sidebar-empty-icon {
  font-size: 32px;
  color: var(--ant-color-text-quaternary);
  margin-bottom: 12px;
  opacity: 0.5;
}
.qa-sidebar-empty-text {
  font-size: 13px;
  color: var(--ant-color-text-quaternary);
  margin: 0;
}

/* 右侧聊天区域 */
.qa-main {
  flex: 1;
  min-width: 0;
}

.qa-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 消息列表 */
.qa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

/* 欢迎页 */
.qa-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px 20px;
}
.qa-welcome-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0891B2 0%, #22D3EE 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  margin-bottom: 20px;
}
.qa-welcome-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--ant-color-text);
  margin: 0 0 8px;
}
.qa-welcome-desc {
  font-size: 14px;
  color: var(--ant-color-text-secondary);
  margin: 0 0 32px;
  max-width: 420px;
}
.qa-welcome-tips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 720px;
}
.qa-tip-card {
  padding: 14px 18px;
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 10px;
  font-size: 13px;
  color: var(--ant-color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  line-height: 1.5;
}
.qa-tip-card:hover {
  border-color: var(--ant-color-primary);
  color: var(--ant-color-primary);
  background: var(--ant-color-primary-bg);
}

/* 消息行 */
.qa-message-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 20px;
}
.qa-message-row--user {
  justify-content: flex-end;
}
.qa-message-row--ai {
  justify-content: flex-start;
}

.qa-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.qa-avatar--user {
  background: var(--ant-color-primary);
  color: #fff;
}
.qa-avatar--ai {
  background: var(--ant-color-fill-quaternary);
  color: var(--ant-color-text-secondary);
}

.qa-bubble {
  max-width: 70%;
  line-height: 1.6;
}
.qa-bubble--user {
  background: var(--ant-color-primary);
  color: #fff;
  border-radius: 12px 2px 12px 12px;
  padding: 10px 16px;
  font-size: 14px;
  word-break: break-word;
}
.qa-bubble--ai {
  background: var(--ant-color-fill-quaternary);
  border-radius: 2px 12px 12px 12px;
  padding: 16px 20px;
  font-size: 14px;
  color: var(--ant-color-text);
}

/* 加载状态 */
.qa-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ant-color-text-secondary);
  font-size: 14px;
}

/* 回答内容 */
.qa-answer-content {
  word-break: break-word;
}
.qa-answer-content :deep(.markdown-body) {
  padding: 0;
}

/* 元信息 */
.qa-answer-meta {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--ant-color-border-secondary);
}
.qa-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
}

/* 引用来源 */
.qa-sources {
  margin-top: 12px;
}
.qa-sources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
  color: var(--ant-color-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.qa-sources-header:hover {
  color: var(--ant-color-primary);
}
.qa-sources-header > span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qa-sources-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qa-source-item {
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  padding: 12px 14px;
}
.qa-source-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.qa-source-file {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ant-color-text);
}
.qa-source-score {
  margin-left: auto;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
}
.qa-source-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--ant-color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

/* 输入区域 */
.qa-input-area {
  padding: 16px 32px 20px;
  border-top: 1px solid var(--ant-color-border-secondary);
  background: var(--ant-color-bg-container);
}
.qa-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border);
  border-radius: 12px;
  padding: 8px 12px;
  transition: border-color 0.2s;
}
.qa-input-wrapper:focus-within {
  border-color: var(--ant-color-primary);
}
.qa-input-wrapper :deep(.ant-input) {
  border: none;
  box-shadow: none;
  background: transparent;
  resize: none;
  font-size: 14px;
  padding: 4px 0;
}
.qa-input-wrapper :deep(.ant-input:focus) {
  box-shadow: none;
}
.qa-send-btn {
  flex-shrink: 0;
  border-radius: 8px;
}
.qa-input-hint {
  font-size: 12px;
  color: var(--ant-color-text-quaternary);
  margin-top: 6px;
  padding-left: 2px;
}
</style>
