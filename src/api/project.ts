import { get, post, put, del } from './request'
import type { CreateProjectParams, ProjectItem } from './model/projectModel'

enum Api {
  List = '/projects',
  Create = '/projects',
  Get = '/projects',
  Update = '/projects',
  Delete = '/projects',
}

/** 获取项目列表 */
export const getProjectList = () =>
  get<ProjectItem[]>({ url: Api.List })

/** 获取项目详情 */
export const getProject = (id: string) =>
  get<ProjectItem>({ url: `${Api.Get}/${id}` })

/** 创建项目 */
export const createProject = (params: CreateProjectParams) =>
  post<ProjectItem>({ url: Api.Create, data: params })

/** 更新项目 */
export const updateProject = (id: string, params: CreateProjectParams) =>
  put<ProjectItem>({ url: `${Api.Update}/${id}`, data: params })

/** 删除项目 */
export const deleteProject = (id: string) =>
  del({ url: `${Api.Delete}/${id}` })
