// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAnalytics.ts — Custom React hook for fetching analytics data
//
// A "custom hook" is a regular function whose name starts with "use".
// It can call React's built-in hooks (useState, useEffect, etc.) internally
// and then return the state and functions that components need.
//
// This hook centralises ALL data fetching for analytics pages. Instead of
// repeating the same fetch logic (loading state, error handling, API calls)
// in each page component, they all call useAnalytics() and get back:
//   summary    — the three KPI numbers (total alumni, employment rate, avg certs)
//   charts     — all chart datasets (skills gap, trends, employers, industries…)
//   alumni     — the full list of alumni rows for the table
//   loading    — true while any fetch is in progress
//   error      — error message string (empty string if no error)
//   fetchAll   — re-fetch using the current filter state
//   fetchWithFilters — fetch immediately with a specific set of filters
//                      (used so Clear can reset + reload in a single action)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { apiBase, encodeFilters, getApiErrorMessage } from '../lib/api'
import type { AlumniRow, ChartsResponse, Filters, Summary } from '../types'

// Owns the three analytics datasets (summary, charts, alumni) plus loading/error state.
// Every page using filters instantiates its own copy so filter changes don't leak across pages.
export const useAnalytics = (
  apiKey: string,     // The developer's analytics API key (sent in the Authorization header)
  filters: Filters,  // Current filter values from the page's state
  onErrorToast?: (message: string) => void  // Optional callback to show the floating error toast
) => {
  const [summary, setSummary] = useState<Summary | null>(null)   // Dashboard KPI numbers
  const [charts, setCharts] = useState<ChartsResponse | null>(null)  // All chart data
  const [alumni, setAlumni] = useState<AlumniRow[]>([])           // Table rows
  const [loading, setLoading] = useState(false)  // True while fetch is in progress
  const [error, setError] = useState('')          // Error message (empty = no error)

  // A ref stores a value that persists between renders but does NOT cause a re-render
  // when it changes. We use it to track which API key has already triggered an
  // auto-load so we don't fetch twice when the component mounts.
  const lastAutoLoadedKey = useRef('')

  // useMemo re-computes the query string only when the filters object changes.
  // This avoids recalculating it on every render.
  const queryString = useMemo(() => encodeFilters(filters), [filters])
  const normalizedApiKey = apiKey.trim()  // Strip accidental whitespace from the pasted key

  // fetchByQuery — the core fetch function. Sends three requests in PARALLEL
  // (Promise.all) to avoid waiting for each one sequentially.
  // It is wrapped in useCallback so its reference only changes when the API key
  // or toast callback changes, which keeps the dependent effects stable.
  const fetchByQuery = useCallback(async (query: string) => {
    if (!normalizedApiKey) {
      setError('Enter API key with required scopes')
      return
    }

    setLoading(true)
    setError('')  // Clear any previous error before fetching
    try {
      // All three endpoints are called at the same time for speed.
      // The API key is sent in the Authorization header (Bearer token format).
      const headers = { Authorization: `Bearer ${normalizedApiKey}` }
      const [s, c, a] = await Promise.all([
        axios.get(`${apiBase}/api/analytics/summary?${query}`, { headers }),  // KPI numbers
        axios.get(`${apiBase}/api/analytics/charts?${query}`, { headers }),   // Chart datasets
        axios.get(`${apiBase}/api/analytics/alumni?${query}`, { headers }),   // Alumni rows
      ])
      setSummary(s.data)
      setCharts(c.data)
      setAlumni(a.data.items || [])  // items may be missing if the server returns an empty result
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to fetch analytics')
      setError(msg)
      onErrorToast?.(msg)  // The ?. means "call this function only if it was provided"
    } finally {
      setLoading(false)  // Always stop the loading spinner, even if there was an error
    }
  }, [normalizedApiKey, onErrorToast])

  // fetchAll — public function for the "Apply Filters" button.
  // Uses the current filter state (already encoded into queryString).
  const fetchAll = useCallback(async () => {
    await fetchByQuery(queryString)
  }, [fetchByQuery, queryString])

  // Accepts an explicit Filters object and fetches immediately using those values.
  // Used by the Clear button on ChartsPage so it can reset state and reload unfiltered
  // data in a single action, without waiting for a second "Apply Filters" click.
  const fetchWithFilters = useCallback(async (nextFilters: Filters) => {
    await fetchByQuery(encodeFilters(nextFilters))
  }, [fetchByQuery])

  // Auto-load: when the user pastes an API key and navigates to any analytics page,
  // the data loads automatically without them having to click "Apply Filters".
  // lastAutoLoadedKey prevents this from re-triggering on unrelated re-renders.
  useEffect(() => {
    // Auto-load once when a usable API key becomes available on page entry.
    if (!normalizedApiKey || lastAutoLoadedKey.current === normalizedApiKey) return

    lastAutoLoadedKey.current = normalizedApiKey  // Mark this key as already loaded
    void fetchAll()  // void = we don't need to await this here
  }, [fetchAll, normalizedApiKey])

  // Return everything the page components need:
  return { summary, charts, alumni, loading, error, fetchAll, fetchWithFilters }
}
