import { post, get } from './request'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserInfo {
  id: string
  username: string
  created_at: string | null
}

export function login(data: LoginRequest): Promise<TokenResponse> {
  return post<TokenResponse>({ url: '/auth/login', data })
}

export function getMe(): Promise<UserInfo> {
  return get<UserInfo>({ url: '/auth/me' })
}
