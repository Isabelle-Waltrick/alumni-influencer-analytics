import { useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const DashboardPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const { summary, loading, error, fetchAll } = useAnalytics(apiKey, filters, onErrorToast)

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard Overview</h2>
      <FiltersBar filters={filters} setFilters={setFilters} />
      <button onClick={fetchAll} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
        Load Summary
      </button>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Total Alumni</p><p className="text-2xl font-semibold">{summary.totalAlumniTracked}</p></div>
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Employment Rate</p><p className="text-2xl font-semibold">{summary.employmentRate}%</p></div>
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Avg Certifications</p><p className="text-2xl font-semibold">{summary.avgCertificationsPerAlumnus}</p></div>
        </div>
      )}
    </section>
  )
}
