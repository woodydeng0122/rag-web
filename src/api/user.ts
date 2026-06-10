import { get, post, put, del } from './request'

export interface UserInfo {
  id: string
  username: string
  created_at: string | null
}

export interface CreateUserRequest {
  username: string
  password: string
}

export interface UpdateUserRequest {
  password: string
}

export function listUsers(): Promise<UserInfo[]> {
  return get<UserInfo[]>({ url: '/users' })
}

export function createUser(data: CreateUserRequest): Promise<UserInfo> {
  return post<UserInfo>({ url: '/users', data })
}

export function updateUser(id: string, data: UpdateUserRequest): Promise<UserInfo> {
  return put<UserInfo>({ url: `/users/${id}`, data })
}

export function deleteUser(id: string): Promise<void> {
  return del<void>({ url: `/users/${id}` })
}
