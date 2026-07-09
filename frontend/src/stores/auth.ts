import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'

export interface User {
  id: string
  name: string
  email: string
  role: string
  isAdmin: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('reachreq_token') || '')
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!token.value)

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('reachreq_token', newToken)
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('reachreq_token')
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const data = await api.get('/auth/me')
      user.value = data.user
    } catch {
      logout()
    }
  }

  async function login() {
    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    window.location.href = `${apiUrl}/auth/login`
  }

  function handleCallback(tokenFromUrl: string) {
    setToken(tokenFromUrl)
    fetchUser()
  }

  return { token, user, isAuthenticated, isAdmin: computed(() => !!user.value?.isAdmin), setToken, logout, fetchUser, login, handleCallback }
})
