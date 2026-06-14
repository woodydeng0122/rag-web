import { get, post, put, patch, del } from './request'
import type { CreateProjectParams, EvaluationStatsResult, ProjectItem, TriggerEvaluationParams, UpdateEvaluationParams } from './model/projectModel'

enum Api {
  List = '/projects',
  Create = '/projects',
  Get = '/projects',
  Update = '/projects',
  Delete = '/projects',
  Original = '/projects/original',
}

/** 获取项目列表 */
export const getProjectList = () =>
  get<ProjectItem[]>({ url: Api.List })

/** 获取可继承项目列表（原创项目） */
export const getOriginalProjects = () =>
  get<ProjectItem[]>({ url: Api.Original })

/** 获取项目详情 */
export const getProject = (id: string) =>
  get<ProjectItem>({ url: `${Api.Get}/${id}` })

/** 创建项目（继承时可能耗时较长，超时设为 60 秒） */
export const createProject = (params: CreateProjectParams) =>
  post<ProjectItem>({ url: Api.Create, data: params, timeout: 60000 })

/** 更新项目 */
export const updateProject = (id: string, params: CreateProjectParams) =>
  put<ProjectItem>({ url: `${Api.Update}/${id}`, data: params })

/** 删除项目 */
export const deleteProject = (id: string) =>
  del({ url: `${Api.Delete}/${id}` })

/** 触发项目评估统计 */
export const triggerEvaluation = (projectId: string, params: TriggerEvaluationParams) =>
  post<EvaluationStatsResult>({ url: `${Api.List}/${projectId}/evaluation-stats`, data: params })

/** 查询项目评估历史 */
export const getEvaluationHistory = (projectId: string) =>
  get<EvaluationStatsResult[]>({ url: `${Api.List}/${projectId}/evaluation-stats` })

/** 删除评估记录 */
export const deleteEvaluation = (projectId: string, evaluationId: string) =>
  del({ url: `${Api.List}/${projectId}/evaluation-stats/${evaluationId}` })

/** 更新评估记录 */
export const updateEvaluation = (projectId: string, evaluationId: string, params: UpdateEvaluationParams) =>
  patch<EvaluationStatsResult>({ url: `${Api.List}/${projectId}/evaluation-stats/${evaluationId}`, data: params })
