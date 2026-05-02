import type { Filters } from '../types'

type Props = { filters: Filters; setFilters: (f: Filters) => void }

export const FiltersBar = ({ filters, setFilters }: Props) => (
  <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
    <input
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Certification (e.g. AWS)"
      value={filters.certification}
      onChange={(e) => setFilters({ ...filters, certification: e.target.value })}
    />
    <input
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Company"
      value={filters.company}
      onChange={(e) => setFilters({ ...filters, company: e.target.value })}
    />
    <input
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Job title"
      value={filters.jobTitle}
      onChange={(e) => setFilters({ ...filters, jobTitle: e.target.value })}
    />
    <input
      type="number"
      min={1900}
      max={2100}
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Cert year from"
      value={filters.certYearFrom}
      onChange={(e) => setFilters({ ...filters, certYearFrom: e.target.value })}
    />
    <input
      type="number"
      min={1900}
      max={2100}
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Cert year to"
      value={filters.certYearTo}
      onChange={(e) => setFilters({ ...filters, certYearTo: e.target.value })}
    />
  </div>
)
