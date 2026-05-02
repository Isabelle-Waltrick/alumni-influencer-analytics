import axios from 'axios'
import type { Filters } from '../types'

export const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

export const getApiErrorMessage = (err: any, fallback = 'Request failed') => {
  const data = err?.response?.data
  if (!data && typeof err?.message === 'string' && err.message.trim()) return err.message
  if (!data) return fallback
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0]
    if (typeof first === 'string') return first
    if (typeof first?.msg === 'string') return first.msg
    if (typeof first?.message === 'string') return first.message
  }
  return fallback
}

// Fetches the CSRF token if backend has ENABLE_CSRF=true; returns empty headers otherwise.
export const getCsrfHeaders = async () => {
  const resp = await axios.get(`${apiBase}/api/csrf-token`, { withCredentials: true })
  if (!resp.data?.csrfEnabled || !resp.data?.csrfToken) return {}
  return { 'x-csrf-token': resp.data.csrfToken }
}

export const encodeFilters = (f: Filters) => {
  const params = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => {
    if (v) params.append(k, v)
  })
  return params.toString()
}
