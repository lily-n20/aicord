import { create } from 'zustand'
import type { User } from '@aicord/shared'
import { api } from '../lib/api'
import { wsClient } from '../lib/ws'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, password }
      )
      api.setTokens(res.accessToken, res.refreshToken)
      wsClient.connect(res.accessToken)
      set({ user: res.user, isLoading: false })
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message ?? 'Login failed'
      set({ error: message, isLoading: false })
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null })
    try {
      await api.post('/auth/register', { username, email, password })
      await get().login(email, password)
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message ?? 'Registration failed'
      set({ error: message, isLoading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {})
    } finally {
      api.clearTokens()
      wsClient.destroy()
      set({ user: null })
    }
  },

  clearError: () => set({ error: null }),
}))
