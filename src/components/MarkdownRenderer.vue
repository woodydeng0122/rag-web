<template>
  <div v-if="isMarkdown" class="markdown-body" :class="{ 'markdown-body--full': fullHeight }" v-html="renderedHtml" />
  <pre v-else class="plain-content" :class="{ 'plain-content--full': fullHeight }">{{ content }}</pre>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const props = withDefaults(defineProps<{
  content: string
  fileType: string
  fullHeight?: boolean
}>(), {
  fullHeight: false,
})

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {
        // fallback
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

const isMarkdown = computed(() => {
  const t = (props.fileType || '').toLowerCase()
  return t === 'md' || t === 'markdown'
})

const renderedHtml = computed(() => {
  return md.render(props.content || '')
})
</script>

<style scoped>
.markdown-body {
  padding: 12px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--ant-color-text);
  word-break: break-word;
}
.markdown-body--full {
  /* 源文档场景无需额外处理 */
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin-top: 12px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-body :deep(h1) { font-size: 1.4em; }
.markdown-body :deep(h2) { font-size: 1.25em; }
.markdown-body :deep(h3) { font-size: 1.1em; }

.markdown-body :deep(p) {
  margin: 6px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.markdown-body :deep(code) {
  background: var(--ant-color-fill-quaternary);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
}

.markdown-body :deep(pre.hljs) {
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-body :deep(pre.hljs code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--ant-color-border);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--ant-color-text-secondary);
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--ant-color-border-secondary);
  padding: 6px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--ant-color-fill-quaternary);
  font-weight: 500;
}

.markdown-body :deep(a) {
  color: var(--ant-color-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--ant-color-border-secondary);
  margin: 12px 0;
}

.plain-content {
  padding: 12px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ant-color-text);
  white-space: pre-wrap;
  word-break: break-word;
}
.plain-content--full {
  /* 源文档场景无需额外处理 */
}
</style>
