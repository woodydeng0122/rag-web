<template>
  <div class="qa-page">
    <!-- 未选择项目提示 -->
    <div v-if="!activeProjectStore.activeProjectId" class="qa-empty">
      <a-empty description="请先选择一个项目">
        <a-button type="primary" @click="router.push('/projects')">选择项目</a-button>
      </a-empty>
    </div>

    <template v-else>
      <div class="qa-container">
        <!-- 消息列表区域 -->
        <div ref="messageListRef" class="qa-messages">
          <!-- 空状态 -->
          <div v-if="messages.length === 0" class="qa-welcome">
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
          <div v-for="msg in messages" :key="msg.id" class="qa-message">
            <!-- 用户问题 -->
            <div class="qa-message-question">
              <div class="qa-avatar qa-avatar--user">
                <user-outlined />
              </div>
              <div class="qa-bubble qa-bubble--question">
                {{ msg.question }}
              </div>
            </div>

            <!-- AI 回答 -->
            <div class="qa-message-answer">
              <div class="qa-avatar qa-avatar--ai">
                <robot-outlined />
              </div>
              <div class="qa-bubble qa-bubble--answer">
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
          </div>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveProjectStore } from '@/store/activeProject'
import { askQuestion } from '@/api/qa'
import type { QAChunk } from '@/api/model/qaModel'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
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
} from '@ant-design/icons-vue'

const router = useRouter()
const activeProjectStore = useActiveProjectStore()

const inputText = ref('')
const asking = ref(false)
const messageListRef = ref<HTMLElement>()
const inputRef = ref()

interface DisplayMessage {
  id: string
  question: string
  answer: string
  chunks: QAChunk[]
  latency_ms: number
  loading: boolean
  sourcesExpanded: boolean
}

const messages = ref<DisplayMessage[]>([])

const sampleQuestions = [
  '项目文档的核心内容是什么？',
  '有哪些关键的技术决策？',
  '系统架构是如何设计的？',
]

const inputPlaceholder = computed(() =>
  asking ? '正在生成回答...' : '输入你的问题',
)

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

  const msgId = Date.now().toString()
  const newMsg: DisplayMessage = {
    id: msgId,
    question,
    answer: '',
    chunks: [],
    latency_ms: 0,
    loading: true,
    sourcesExpanded: false,
  }
  messages.value.push(newMsg)
  scrollToBottom()

  try {
    const res = await askQuestion(projectId, { question })
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) {
      msg.answer = res.answer
      msg.chunks = res.chunks || []
      msg.latency_ms = res.latency_ms
      msg.loading = false
    }
  } catch {
    const msg = messages.value.find(m => m.id === msgId)
    if (msg) {
      msg.answer = '抱歉，生成回答时出现错误，请稍后重试。'
      msg.loading = false
    }
  } finally {
    asking.value = false
    scrollToBottom()
    nextTick(() => inputRef.value?.focus())
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<style scoped>
.qa-page {
  height: calc(100dvh - 56px - 48px); /* header + content padding */
  display: flex;
  flex-direction: column;
}

.qa-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.qa-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ant-color-bg-container);
  border-radius: 10px;
  overflow: hidden;
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
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
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

/* 消息 */
.qa-message {
  margin-bottom: 24px;
}
.qa-message:last-child {
  margin-bottom: 8px;
}

.qa-message-question,
.qa-message-answer {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.qa-message-answer {
  margin-top: 16px;
}

.qa-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.qa-avatar--user {
  background: var(--ant-color-fill-quaternary);
  color: var(--ant-color-text-secondary);
}
.qa-avatar--ai {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #fff;
}

.qa-bubble {
  max-width: calc(100% - 52px);
  line-height: 1.6;
}
.qa-bubble--question {
  font-size: 15px;
  font-weight: 500;
  color: var(--ant-color-text);
}
.qa-bubble--answer {
  background: var(--ant-color-fill-quaternary);
  border-radius: 0 12px 12px 12px;
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
