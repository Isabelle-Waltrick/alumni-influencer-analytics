// ─────────────────────────────────────────────────────────────────────────────
// components/FiltersBar.tsx — Reusable filter panel with Program, Graduation
//                              Date, and Industry Sector fields
//
// Used on Dashboard, Alumni Explorer, Charts, and Reports pages.
// The parent page owns the filter state; this component only reads it and
// calls callbacks (setFilters / onAction / onClear) when the user interacts.
//
// Props:
//   filters         → current filter values from the parent page's state
//   setFilters      → parent's state setter — called whenever a field changes
//   actionLabel     → text for the primary button (e.g. "Apply Filters")
//   onAction        → called when the primary button is clicked (usually fetches data)
//   onClear         → optional override for the Clear button; when omitted the bar
//                     just resets the fields without triggering a data reload
//   actionDisabled  → disables the primary button (e.g. while loading)
//   programOptions  → sorted list of programs to show in the Program combobox
//   industryOptions → sorted list of industries to show in the Industry combobox
// ─────────────────────────────────────────────────────────────────────────────

import type { Filters } from '../types'
import { emptyFilters } from '../lib/constants'
import { FilterCombobox } from './FilterCombobox'

type Props = {
  filters: Filters
  setFilters: (f: Filters) => void
  actionLabel: string
  onAction: () => void
  /** Optional override for the Clear button. When provided, it is responsible for
   *  both resetting filter state and triggering any immediate data reload.
   *  When omitted, Clear simply resets the filter fields to empty values. */
  onClear?: () => void
  actionDisabled?: boolean
  /** Alphabetically-sorted program names derived from the current alumni dataset. */
  programOptions?: string[]
  /** Alphabetically-sorted industry sectors derived from the current alumni dataset. */
  industryOptions?: string[]
}

export const FiltersBar = ({
  filters,
  setFilters,
  actionLabel,
  onAction,
  onClear,
  actionDisabled = false,
  programOptions = [],
  industryOptions = [],
}: Props) => (
  <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-3">
    <h3 className="text-sm font-semibold text-slate-700 lg:col-span-3">Filters</h3>
    <FilterCombobox
      id="program-filter"
      label="Program"
      placeholder="Program (e.g. BSc Computer Science)"
      value={filters.program}
      onChange={(v) => setFilters({ ...filters, program: v })}
      options={programOptions}
    />
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
    <FilterCombobox
      id="industry-sector-filter"
      label="Industry Sector"
      placeholder="Industry sector (e.g. Technology & IT)"
      value={filters.industrySector}
      onChange={(v) => setFilters({ ...filters, industrySector: v })}
      options={industryOptions}
    />
    {/* Graduation Date uses a plain date input — no combobox needed as dates are not pre-populated values. */}
    {/* Keep the action buttons stacked longer so tablets do not squeeze the filter controls. */}
    <div className="flex flex-col gap-2 sm:flex-row lg:col-span-3">
      <button
        onClick={onAction}
        disabled={actionDisabled}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {actionLabel}
      </button>
      {/* If the page passes an onClear handler (e.g. ChartsPage which also refetches
           unfiltered data), delegate to it; otherwise just reset the fields locally. */}
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
