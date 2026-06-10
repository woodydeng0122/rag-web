import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as loginApi, getMe, type UserInfo, type LoginRequest } from '@/api/auth'

const TOKEN_KEY = 'rag_access_token'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(null)

  async function login(req: LoginRequest) {
    const res = await loginApi(req)
    token.value = res.access_token
    localStorage.setItem(TOKEN_KEY, res.access_token)
    await fetchUserInfo()
  }

  async function fetchUserInfo() {
    if (!token.value) return
    try {
      userInfo.value = await getMe()
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  const isLoggedIn = () => !!token.value

  return { token, userInfo, login, fetchUserInfo, logout, isLoggedIn }
})
