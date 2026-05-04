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
      <FiltersBar filters={filters} setFilters={setFilters} actionLabel="Apply Filters" onAction={fetchAll} />
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {/* Mobile switches to stacked cards so each alumnus remains readable without horizontal scrolling. */}
      <div className="grid gap-3 md:hidden">
        {alumni.map((a) => (
          <article key={a._id} className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{a.firstName} {a.lastName}</h3>
              <p className="text-sm text-slate-500">{a.latestCompany || 'No latest company listed'}</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-700">Program</dt>
                <dd className="mt-1 text-slate-600">{a.programs.length > 0 ? a.programs.join(', ') : '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Graduation Date</dt>
                <dd className="mt-1 text-slate-600">{a.graduationDateLines.length > 0 ? a.graduationDateLines.join(', ') : '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Certifications</dt>
                <dd className="mt-1 text-slate-600">{a.certifications.length > 0 ? a.certifications.join(', ') : '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Industry</dt>
                <dd className="mt-1 text-slate-600">{a.latestIndustry || '-'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-auto rounded-lg border bg-white md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Program</th>
              <th className="p-3">Graduation Date</th>
              <th className="p-3">Latest company</th>
              <th className="p-3">Certifications</th>
              <th className="p-3">Industry</th>
            </tr>
          </thead>
          <tbody>
            {alumni.map((a) => (
              <tr key={a._id} className="border-t">
                <td className="p-3">{a.firstName} {a.lastName}</td>
                <td className="p-3 align-top">
                  {a.programs.length > 0
                    ? <div className="space-y-1">{a.programs.map((program, index) => <div key={`${a._id}-program-${index}`}>{program}</div>)}</div>
                    : '-'}
                </td>
                <td className="p-3 align-top">
                  {a.graduationDateLines.length > 0
                    ? <div className="space-y-1">{a.graduationDateLines.map((line, index) => <div key={`${a._id}-grad-${index}`}>{line}</div>)}</div>
                    : '-'}
                </td>
                <td className="p-3">{a.latestCompany || '-'}</td>
                <td className="p-3 align-top">
                  {a.certifications.length > 0
                    ? <div className="space-y-1">{a.certifications.map((cert, index) => <div key={`${a._id}-cert-${index}`}>{cert}</div>)}</div>
                    : '-'}
                </td>
                <td className="p-3 text-slate-600">
                  {a.latestIndustry || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
