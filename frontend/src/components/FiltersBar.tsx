import type { Filters } from '../types'

type Props = {
  filters: Filters
  setFilters: (f: Filters) => void
  actionLabel: string
  onAction: () => void
  actionDisabled?: boolean
}

export const FiltersBar = ({ filters, setFilters, actionLabel, onAction, actionDisabled = false }: Props) => (
  <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
    <h3 className="text-sm font-semibold text-slate-700 md:col-span-3">Filters</h3>
    <input
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Program (e.g. BSc Computer Science)"
      value={filters.program}
      onChange={(e) => setFilters({ ...filters, program: e.target.value })}
    />
    <input
      type="date"
      className="rounded-md border border-slate-300 p-2 text-sm"
      value={filters.graduationDate}
      onChange={(e) => setFilters({ ...filters, graduationDate: e.target.value })}
    />
    <input
      className="rounded-md border border-slate-300 p-2 text-sm"
      placeholder="Industry sector (e.g. Technology & IT)"
      value={filters.industrySector}
      onChange={(e) => setFilters({ ...filters, industrySector: e.target.value })}
    />
    <div className="md:col-span-3">
      <button
        onClick={onAction}
        disabled={actionDisabled}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {actionLabel}
      </button>
    </div>
  </div>
)
