import { create } from 'zustand'
import { API_URL } from '../lib/config'

interface User {
  id: number
  username: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('cloudcodex_token'),
  isAuthenticated: false,
  isLoading: true,

  login: async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      
      localStorage.setItem('cloudcodex_token', data.token)
      set({ user: data.user, token: data.token, isAuthenticated: true })
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to connect to server' }
    }
  },

  register: async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }

      localStorage.setItem('cloudcodex_token', data.token)
      set({ user: data.user, token: data.token, isAuthenticated: true })
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to connect to server' }
    }
  },

  logout: () => {
    localStorage.removeItem('cloudcodex_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = get().token
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, isAuthenticated: true, isLoading: false })
      } else {
        localStorage.removeItem('cloudcodex_token')
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
