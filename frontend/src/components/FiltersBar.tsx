import type { Filters } from '../types'
import { emptyFilters } from '../lib/constants'

type Props = {
  filters: Filters
  setFilters: (f: Filters) => void
  actionLabel: string
  onAction: () => void
  onClear?: () => void
  actionDisabled?: boolean
}

export const FiltersBar = ({ filters, setFilters, actionLabel, onAction, onClear, actionDisabled = false }: Props) => (
  <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-3">
    <h3 className="text-sm font-semibold text-slate-700 lg:col-span-3">Filters</h3>
    <div className="space-y-1">
      <label htmlFor="program-filter" className="text-xs font-medium text-slate-600">Program</label>
      <input
        id="program-filter"
        className="w-full rounded-md border border-slate-300 p-2 text-sm"
        placeholder="Program (e.g. BSc Computer Science)"
        value={filters.program}
        onChange={(e) => setFilters({ ...filters, program: e.target.value })}
      />
    </div>
    <div className="space-y-1">
      <label htmlFor="graduation-date-filter" className="text-xs font-medium text-slate-600">Graduation Date</label>
      <input
        id="graduation-date-filter"
        type="date"
        className="w-full rounded-md border border-slate-300 p-2 text-sm"
        value={filters.graduationDate}
        onChange={(e) => setFilters({ ...filters, graduationDate: e.target.value })}
      />
    </div>
    <div className="space-y-1">
      <label htmlFor="industry-sector-filter" className="text-xs font-medium text-slate-600">Industry Sector</label>
      <input
        id="industry-sector-filter"
        className="w-full rounded-md border border-slate-300 p-2 text-sm"
        placeholder="Industry sector (e.g. Technology & IT)"
        value={filters.industrySector}
        onChange={(e) => setFilters({ ...filters, industrySector: e.target.value })}
      />
    </div>
    {/* Keep the action buttons stacked longer so tablets do not squeeze the filter controls. */}
    <div className="flex flex-col gap-2 sm:flex-row lg:col-span-3">
      <button
        onClick={onAction}
        disabled={actionDisabled}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {actionLabel}
      </button>
      <button
        onClick={() => {
          if (onClear) {
            onClear()
            return
          }
          setFilters({ ...emptyFilters })
        }}
        type="button"
        className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  </div>
)
