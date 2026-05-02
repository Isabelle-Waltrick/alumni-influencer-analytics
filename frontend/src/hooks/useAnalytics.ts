import { useMemo, useState } from 'react'
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

  const queryString = useMemo(() => encodeFilters(filters), [filters])

  const fetchAll = async () => {
    if (!apiKey) {
      setError('Enter API key with required scopes')
      return
    }

    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${apiKey}` }
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
  }

  return { summary, charts, alumni, loading, error, fetchAll }
}
