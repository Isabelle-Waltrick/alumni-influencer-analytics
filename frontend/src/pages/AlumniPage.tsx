import { useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const AlumniPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const { alumni, loading, error, fetchAll } = useAnalytics(apiKey, filters, onErrorToast)
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">View Alumni</h2>
      <FiltersBar filters={filters} setFilters={setFilters} />
      <button onClick={fetchAll} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Apply Filters</button>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="overflow-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">LinkedIn</th>
              <th className="p-3">Latest role</th>
              <th className="p-3">Latest company</th>
              <th className="p-3">Top certification</th>
              <th className="p-3">Certs / Courses / Degrees</th>
            </tr>
          </thead>
          <tbody>
            {alumni.map((a) => (
              <tr key={a._id} className="border-t">
                <td className="p-3">{a.firstName} {a.lastName}</td>
                <td className="p-3">
                  {a.linkedInUrl
                    ? <a className="text-blue-600 hover:underline" href={a.linkedInUrl} target="_blank" rel="noreferrer">Profile</a>
                    : '-'}
                </td>
                <td className="p-3">{a.latestJobTitle || '-'}</td>
                <td className="p-3">{a.latestCompany || '-'}</td>
                <td className="p-3">{a.topCertification || '-'}</td>
                <td className="p-3 text-slate-600">
                  {a.certificationsCount} / {a.coursesCount} / {a.degreesCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
