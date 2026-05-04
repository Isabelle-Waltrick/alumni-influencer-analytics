// ─────────────────────────────────────────────────────────────────────────────
// lib/api.ts — Shared HTTP helpers for talking to the backend
//
// Three things live here:
//   1. apiBase     — the root URL of the backend (set via an environment variable)
//   2. getApiErrorMessage — extracts a human-readable message from any Axios error
//   3. getCsrfHeaders    — fetches a CSRF token so state-changing requests (POST/PUT/DELETE)
//                           are protected against cross-site request forgery attacks
//   4. encodeFilters     — converts a Filters object into a URL query string
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'
import type { Filters } from '../types'

// The backend server's base URL.
// VITE_API_BASE is set in a .env file (e.g. VITE_API_BASE=https://api.example.com).
// If the env variable is not set, we fall back to localhost:3000 (local development).
export const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

/**
 * Extracts the most useful error message from an Axios error response.
 *
 * The backend can return errors in different formats:
 *   { message: "Something went wrong" }        → returns that message directly
 *   { errors: ["Field is required"] }           → returns the first error string
 *   { errors: [{ msg: "Invalid email" }] }      → returns the msg from the first error object
 *   Network error (no response body)            → returns the Axios error message
 *   Anything else                               → returns the fallback string
 */
export const getApiErrorMessage = (err: any, fallback = 'Request failed') => {
  const data = err?.response?.data  // The parsed response body from the backend
  if (!data && typeof err?.message === 'string' && err.message.trim()) return err.message  // Network-level error
  if (!data) return fallback  // No response body at all
  if (typeof data.message === 'string' && data.message.trim()) return data.message  // Top-level message field
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0]  // Only show the first validation error to keep it simple
    if (typeof first === 'string') return first
    if (typeof first?.msg === 'string') return first.msg
    if (typeof first?.message === 'string') return first.message
  }
  return fallback
}

/**
 * Fetches a CSRF (Cross-Site Request Forgery) token from the backend.
 *
 * CSRF is a security attack where a malicious site tricks your browser into
 * making a request to our API using your session cookie. The backend defends
 * against this by requiring a secret token in the request header that only
 * the real frontend can obtain.
 *
 * If the backend has ENABLE_CSRF=false, it returns { csrfEnabled: false } and
 * this function returns {} (empty headers) so nothing breaks.
 */
export const getCsrfHeaders = async () => {
  const resp = await axios.get(`${apiBase}/api/csrf-token`, { withCredentials: true })
  // If CSRF is disabled on the backend, return empty headers (no token needed)
  if (!resp.data?.csrfEnabled || !resp.data?.csrfToken) return {}
  // Return the token as a header object ready to be spread into an axios request
  return { 'x-csrf-token': resp.data.csrfToken }
}

/**
 * Converts a Filters object into a URL query string.
 *
 * Example:
 *   { program: 'BSc CS', graduationDate: '', industrySector: 'Tech' }
 *   → 'program=BSc+CS&industrySector=Tech'
 *
 * Empty values are skipped so the backend only sees filters that were actually set.
 * URLSearchParams handles special characters (spaces, &, = etc.) safely.
 */
export const encodeFilters = (f: Filters) => {
  const params = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => {
    if (v) params.append(k, v)  // Only include non-empty filter values
  })
  return params.toString()  // e.g. "program=BSc+CS&industrySector=Technology+%26+IT"
}
