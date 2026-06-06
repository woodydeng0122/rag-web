import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'

const instance = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 15000,
})

export default instance

// 请求拦截
instance.interceptors.request.use((config) => {
  return config
})

interface ApiResponse<T> {
  code: number
  message: string
  result: T
}

// 响应拦截
instance.interceptors.response.use(
  (res: AxiosResponse<ApiResponse<any>>) => {
    const { code, message: msg, result } = res.data
    if (code !== 0) {
      message.error(msg || '请求失败')
      return Promise.reject(new Error(msg))
    }
    return result
  },
  (error) => {
    const data = error.response?.data
    const msg = data?.message || data?.detail || error.message || '请求失败'
    message.error(msg)
    return Promise.reject(error)
  },
)

export function get<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.get<T>(config.url!, config)
}

export function post<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.post<T>(config.url!, config.data, config)
}

export function put<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.put<T>(config.url!, config.data, config)
}

export function patch<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.patch<T>(config.url!, config.data, config)
}

export function del<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.delete<T>(config.url!, config)
}
