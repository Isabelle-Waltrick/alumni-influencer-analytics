// ─────────────────────────────────────────────────────────────────────────────
// pages/DashboardPage.tsx — Overview dashboard with KPI summary cards
//
// This is the first page a developer sees after logging in.
// It shows three headline statistics (called KPIs — Key Performance Indicators):
//   • Total number of alumni tracked in the database
//   • Employment rate as a percentage
//   • Average number of certifications per alumni
//
// The user can narrow these numbers down using the filter panel:
//   • Filter by graduation program (e.g. "BSc Computer Science")
//   • Filter by graduation date
//   • Filter by industry sector
//
// When filters are applied, only alumni matching ALL filters count towards
// the displayed statistics.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import { buildIndustryOptions, buildProgramOptions } from '../lib/filterOptions'
import type { Filters } from '../types'

// Props passed from App.tsx via the wrap() helper:
//   apiKey       → the developer's analytics API key for authenticated requests
//   onErrorToast → function to display the floating red error notification
type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const DashboardPage = ({ apiKey, onErrorToast }: Props) => {
  // filters — the current values in the filter form (program, date, industry).
  // Starts as empty so the initial auto-load shows data for ALL alumni.
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })

  // useAnalytics handles all data fetching. We get back the loaded data,
  // loading/error state, and two functions to trigger fetches.
  // We only need 'summary' and 'alumni' on this page (not 'charts').
  const { summary, alumni, loading, error, fetchAll, fetchWithFilters } = useAnalytics(apiKey, filters, onErrorToast)

  // Build the dropdown option lists from the alumni data that was just fetched.
  // useMemo means these only recompute when the 'alumni' array changes.
  const programOptions = useMemo(() => buildProgramOptions(alumni), [alumni])
  const industryOptions = useMemo(() => buildIndustryOptions(alumni), [alumni])

  // handleClearFilters — resets all filter fields to blank AND immediately
  // re-fetches the data without filters so the KPI cards update right away.
  // Without this, the user would have to click "Apply Filters" after clearing.
  const handleClearFilters = async () => {
    const clearedFilters = { ...emptyFilters }  // Create a fresh empty filters object
    setFilters(clearedFilters)                  // Reset the form fields
    await fetchWithFilters(clearedFilters)      // Fetch unfiltered data immediately
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard Overview</h2>

      {/* FiltersBar shows the three filter fields and the Apply/Clear buttons */}
      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        actionLabel="Apply Filters"
        onAction={fetchAll}          // Clicking "Apply Filters" triggers a new fetch
        // Use custom clear behavior so summary data updates immediately.
        onClear={handleClearFilters}
        programOptions={programOptions}
        industryOptions={industryOptions}
      />

      {/* Show a loading message while the API call is in progress */}
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {/* Show an error message if the fetch failed */}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* Only render the KPI cards once we have summary data */}
      {summary && (
        // Three equal-width cards side-by-side on medium screens and above.
        <div className="grid gap-4 md:grid-cols-3">
          {/* KPI Card 1: Total alumni count */}
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Total Alumni</p>
            <p className="text-2xl font-semibold">{summary.totalAlumniTracked}</p>
          </div>

          {/* KPI Card 2: Employment rate (percentage of alumni currently employed) */}
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Employment Rate</p>
            <p className="text-2xl font-semibold">{summary.employmentRate}%</p>
          </div>

          {/* KPI Card 3: Average certifications per person in this cohort */}
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Avg Certifications</p>
            <p className="text-2xl font-semibold">{summary.avgCertificationsPerAlumnus}</p>
          </div>
        </div>
      )}
    </section>
  )
}
