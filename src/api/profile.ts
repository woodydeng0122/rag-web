import { get, put } from './request'
import type { ProfileItem } from './model/profileModel'

enum Api {
  Profile = '/profile',
}

/** 获取用户配置 */
export const getProfile = () =>
  get<ProfileItem>({ url: Api.Profile })

/** 更新激活项目 */
export const updateProfile = (active_project_id: string | null) =>
  put<ProfileItem>({ url: Api.Profile, data: { active_project_id } })
