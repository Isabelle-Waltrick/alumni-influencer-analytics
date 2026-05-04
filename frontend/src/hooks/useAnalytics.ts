import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { apiBase, encodeFilters, getApiErrorMessage } from '../lib/api'
import type { AlumniRow, ChartsResponse, Filters, Summary } from '../types'

// Owns the three analytics datasets (summary, charts, alumni) plus loading/error state.
// Every page using filters instantiates its own copy so filter changes don't leak across pages.
export const useAnalytics = (
  apiKey: string,
  filters: Filters,
  onErrorToast?: (message: string) => void
) => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [charts, setCharts] = useState<ChartsResponse | null>(null)
  const [alumni, setAlumni] = useState<AlumniRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Tracks which key already triggered the initial auto-load for this page instance.
  const lastAutoLoadedKey = useRef('')

  const queryString = useMemo(() => encodeFilters(filters), [filters])
  const normalizedApiKey = apiKey.trim()

  const fetchAll = useCallback(async () => {
    if (!normalizedApiKey) {
      setError('Enter API key with required scopes')
      return
    }

    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${normalizedApiKey}` }
      const [s, c, a] = await Promise.all([
        axios.get(`${apiBase}/api/analytics/summary?${queryString}`, { headers }),
        axios.get(`${apiBase}/api/analytics/charts?${queryString}`, { headers }),
        axios.get(`${apiBase}/api/analytics/alumni?${queryString}`, { headers }),
      ])
      setSummary(s.data)
      setCharts(c.data)
      setAlumni(a.data.items || [])
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to fetch analytics')
      setError(msg)
      onErrorToast?.(msg)
    } finally {
      setLoading(false)
    }
  }, [normalizedApiKey, onErrorToast, queryString])

  useEffect(() => {
    // Auto-load once when a usable API key becomes available on page entry.
    if (!normalizedApiKey || lastAutoLoadedKey.current === normalizedApiKey) return

    lastAutoLoadedKey.current = normalizedApiKey
    void fetchAll()
  }, [fetchAll, normalizedApiKey])

  return { summary, charts, alumni, loading, error, fetchAll }
}
