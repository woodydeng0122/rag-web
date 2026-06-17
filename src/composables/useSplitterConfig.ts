import { ref, watch } from 'vue'

export interface SplitterConfigFormState {
  strategy: string
  chunk_size: number
  chunk_overlap: number
  min_chars: number
  max_chars: number
}

export interface SplitterConfigResult {
  strategy: string
  chunk_size: number
  chunk_overlap: number
  min_chars: number
  max_chars: number
}

const STRATEGY_LABELS: Record<string, string> = {
  section_heading: '章节标题',
  heading_aware: '多级标题感知',
  fixed: '固定大小',
  recursive: '递归字符',
  semantic: '语义分块',
}

const STRATEGY_COLORS: Record<string, string> = {
  section_heading: 'blue',
  heading_aware: 'purple',
  fixed: 'orange',
  recursive: 'cyan',
  semantic: 'green',
}

/** 根据模型的 max_position_embeddings 推算分块参数默认值 */
export function getSplitterDefaults(maxPos: number | undefined): Omit<SplitterConfigFormState, 'strategy'> {
  // 中文约 1 token ≈ 1.5 字符，留 20% 安全余量
  const maxChars = maxPos ? Math.round(maxPos * 1.5 * 0.8) : 500
  return {
    chunk_size: maxChars,
    chunk_overlap: Math.round(maxChars * 0.1),
    min_chars: Math.round(maxChars * 0.4),
    max_chars: maxChars,
  }
}

/** 从项目/文档的 splitter_config 还原表单状态 */
export function splitterConfigToForm(config?: Record<string, any>): SplitterConfigFormState {
  return {
    strategy: config?.strategy || 'section_heading',
    chunk_size: config?.chunk_size || 500,
    chunk_overlap: config?.chunk_overlap || 50,
    min_chars: config?.min_chars || 200,
    max_chars: config?.max_chars || 500,
  }
}

/** 从表单状态构建提交用的 splitter_config */
export function formToSplitterConfig(form: SplitterConfigFormState): SplitterConfigResult {
  return {
    strategy: form.strategy,
    chunk_size: form.chunk_size,
    chunk_overlap: form.chunk_overlap,
    min_chars: form.min_chars,
    max_chars: form.max_chars,
  }
}

export function strategyLabel(strategy?: string): string {
  return STRATEGY_LABELS[strategy || 'section_heading'] || strategy || '-'
}

export function strategyColor(strategy?: string): string {
  return STRATEGY_COLORS[strategy || 'section_heading'] || 'default'
}

/** 分块策略表单 composable */
export function useSplitterConfig(defaultConfig?: Record<string, any>) {
  const formState = ref<SplitterConfigFormState>(splitterConfigToForm(defaultConfig))

  function reset(config?: Record<string, any>) {
    formState.value = splitterConfigToForm(config)
  }

  function toConfig(): SplitterConfigResult {
    return formToSplitterConfig(formState.value)
  }

  return { formState, reset, toConfig }
}
