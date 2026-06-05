<template>
  <a-modal
    :open="visible"
    title="Embedding 向量详情"
    :footer="null"
    width="720px"
    @cancel="handleClose"
  >
    <a-spin :spinning="loading">
      <div v-if="vector.length" class="embedding-content">
        <div class="embedding-toolbar">
          <span class="embedding-label">Embedding</span>
          <span class="embedding-dim">{{ dimension }}d</span>
          <a-segmented v-model:value="viewMode" :options="viewOptions" size="small" />
        </div>

        <!-- 热力图 -->
        <div v-if="viewMode === 'heatmap'" class="heatmap-wrap">
          <canvas ref="canvasRef" class="heatmap-canvas" />
          <div class="heatmap-legend">
            <span class="legend-min">{{ stats.min.toFixed(2) }}</span>
            <div class="legend-bar" />
            <span class="legend-max">{{ stats.max.toFixed(2) }}</span>
          </div>
        </div>

        <!-- 原始数据 -->
        <div v-else class="raw-data">
          <div class="raw-stats">
            <span>min: <b>{{ stats.min.toFixed(4) }}</b></span>
            <span>max: <b>{{ stats.max.toFixed(4) }}</b></span>
            <span>mean: <b>{{ stats.mean.toFixed(4) }}</b></span>
            <span>std: <b>{{ stats.std.toFixed(4) }}</b></span>
          </div>
          <div class="raw-grid">
            <span v-for="(v, i) in vector" :key="i" class="raw-cell" :style="cellStyle(v)">
              {{ v.toFixed(3) }}
            </span>
          </div>
        </div>
      </div>

      <a-empty v-else-if="!loading" description="暂无向量数据" />
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { getChunkEmbedding } from '@/api/document'

const props = defineProps<{
  projectId: string
  chunkId: string
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const loading = ref(false)
const vector = ref<number[]>([])
const dimension = ref(0)
const viewMode = ref<'heatmap' | 'raw'>('heatmap')
const canvasRef = ref<HTMLCanvasElement | null>(null)

const viewOptions = [
  { label: '热力图', value: 'heatmap' },
  { label: '原始数据', value: 'raw' },
]

const stats = computed(() => {
  if (!vector.value.length) return { min: 0, max: 0, mean: 0, std: 0 }
  const vals = vector.value
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
  return { min, max, mean, std }
})

function cellStyle(v: number) {
  const { min, max } = stats.value
  const range = max - min || 1
  const t = (v - min) / range
  const r = Math.round(255 * t)
  const b = Math.round(255 * (1 - t))
  return {
    backgroundColor: `rgb(${r}, 240, ${b})`,
  }
}

function handleClose() {
  emit('update:visible', false)
}

async function fetchEmbedding() {
  loading.value = true
  try {
    const res = await getChunkEmbedding(props.projectId, props.chunkId)
    vector.value = res.vector || []
    dimension.value = res.dimension || 0
    if (viewMode.value === 'heatmap') {
      await nextTick()
      drawHeatmap()
    }
  } catch {
    vector.value = []
  } finally {
    loading.value = false
  }
}

function drawHeatmap() {
  const canvas = canvasRef.value
  if (!canvas || !vector.value.length) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = 64
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  const { min, max } = stats.value
  const range = max - min || 1
  const cellWidth = width / vector.value.length

  for (let i = 0; i < vector.value.length; i++) {
    const t = (vector.value[i] - min) / range
    const r = Math.round(255 * t)
    const b = Math.round(255 * (1 - t))
    ctx.fillStyle = `rgb(${r}, 240, ${b})`
    ctx.fillRect(i * cellWidth, 0, cellWidth + 0.5, height)
  }
}

// 弹窗打开时才加载数据
watch(() => props.visible, async (val) => {
  if (val && props.chunkId) {
    await fetchEmbedding()
  }
})

// 切换到热力图时重绘
watch(viewMode, async (mode) => {
  if (mode === 'heatmap' && vector.value.length) {
    await nextTick()
    drawHeatmap()
  }
})
</script>

<style scoped>
.embedding-content {
  min-height: 200px;
}

.embedding-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.embedding-label {
  font-size: 13px;
  font-weight: 600;
  color: #595959;
}

.embedding-dim {
  font-size: 11px;
  color: #1677ff;
  font-family: ui-monospace, 'SF Mono', monospace;
  background: #f0f5ff;
  padding: 1px 6px;
  border-radius: 3px;
}

/* 热力图 */
.heatmap-wrap {
  position: relative;
}

.heatmap-canvas {
  width: 100%;
  height: 64px;
  border-radius: 6px;
  display: block;
  border: 1px solid #f0f0f0;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: #8c8c8c;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.legend-bar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, rgb(0, 240, 255), rgb(128, 240, 128), rgb(255, 240, 0));
}

.legend-min,
.legend-max {
  flex-shrink: 0;
}

/* 原始数据 */
.raw-data {
  max-height: 400px;
  overflow-y: auto;
}

.raw-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.raw-stats b {
  color: #333;
}

.raw-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.raw-cell {
  font-size: 9px;
  font-family: ui-monospace, 'SF Mono', monospace;
  padding: 2px 4px;
  border-radius: 2px;
  line-height: 1.4;
  color: #333;
}
</style>
