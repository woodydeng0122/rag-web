import { get, post, del } from './request'
import type { GenerateGoldenParams, GenerateGoldenResult, GenerationTaskItem } from './model/generationTaskModel'

/** 提交 LLM 生成黄金数据集任务 */
export const generateGolden = (projectId: string, params: GenerateGoldenParams) =>
  post<GenerateGoldenResult>({ url: `/projects/${projectId}/golden-datasets/generate`, data: params })

/** 获取项目下的生成任务列表 */
export const getGenerationTasks = (projectId: string) =>
  get<GenerationTaskItem[]>({ url: `/projects/${projectId}/generation-tasks` })

/** 获取单个生成任务详情 */
export const getGenerationTask = (projectId: string, taskId: string) =>
  get<GenerationTaskItem>({ url: `/projects/${projectId}/generation-tasks/${taskId}` })

/** SSE 事件流 URL */
export const getGenerationStreamUrl = (projectId: string, taskId: string) =>
  `http://localhost:8000/api/projects/${projectId}/generation-tasks/${taskId}/stream`

/** 暂停生成任务 */
export const pauseGenerationTask = (projectId: string, taskId: string) =>
  post<void>({ url: `/projects/${projectId}/generation-tasks/${taskId}/pause` })

/** 继续生成任务 */
export const resumeGenerationTask = (projectId: string, taskId: string) =>
  post<void>({ url: `/projects/${projectId}/generation-tasks/${taskId}/resume` })

/** 取消生成任务 */
export const cancelGenerationTask = (projectId: string, taskId: string) =>
  del<void>({ url: `/projects/${projectId}/generation-tasks/${taskId}` })

/** 重试失败项 */
export const retryFailedGeneration = (projectId: string, taskId: string) =>
  post<void>({ url: `/projects/${projectId}/generation-tasks/${taskId}/retry-failed` })
