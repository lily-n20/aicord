import type { ApiError } from '@aicord/shared'

const BASE_URL = '/api/v1'

class ApiClient {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private refreshPromise: Promise<void> | null = null

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  private async doRefresh(): Promise<void> {
    if (!this.refreshToken) throw new Error('No refresh token')
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    })
    if (!res.ok) {
      this.clearTokens()
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    const data = await res.json()
    this.accessToken = data.accessToken
    this.refreshToken = data.refreshToken
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    let res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

    if (res.status === 401 && this.refreshToken) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null
        })
      }
      await this.refreshPromise
      headers['Authorization'] = `Bearer ${this.accessToken}`
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    }

    if (!res.ok) {
      const error: ApiError = await res.json().catch(() => ({
        error: { code: 'UNKNOWN', message: 'An error occurred' },
      }))
      throw error
    }

    if (res.status === 204) return undefined as T
    return res.json()
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' })
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export const api = new ApiClient()
