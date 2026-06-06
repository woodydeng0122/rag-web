import { get, post } from './request'
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
