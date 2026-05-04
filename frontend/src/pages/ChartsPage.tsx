// ─────────────────────────────────────────────────────────────────────────────
// pages/ChartsPage.tsx — Interactive charts and data visualisations
//
// Displays six chart cards, each showing a different view of alumni data:
//   1. Skills Gap Analysis (Bar)       — cert adoption rates colour-coded by severity
//   2. Certification Trend (Line)      — how certification uptake changes year on year
//   3. Employment by Industry (Pie)    — which industries alumni work in
//   4. Most Common Job Titles (Doughnut)— top job roles across the cohort
//   5. Top Employers (Horizontal Bar)  — companies that appear most often
//   6. Geographic Distribution (Radar) — regions where alumni are working
//
// Features:
//   • Filterable via the FiltersBar (same as other pages)
//   • Each card has an "Expand" button that opens a full-screen modal with a
//     larger chart area (especially useful on mobile)
//   • A "Download Chart Image" button exports all charts to a single PNG file
//   • A compact flag reduces font/tick sizes on small screens so charts remain
//     legible without horizontal scrolling
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bar, Doughnut, Line, Pie, Radar } from 'react-chartjs-2'  // Chart.js wrapper components
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import { buildIndustryOptions, buildProgramOptions } from '../lib/filterOptions'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

// ChartDefinition — a blueprint for one chart card.
// By storing each chart as a data object we can map over them uniformly
// to render all chart cards and the expanded modal without repeating JSX.
type ChartDefinition = {
  id: string                                   // Unique identifier used to track which chart is expanded
  title: string                                // Heading shown on the card
  description: ReactNode                       // Explanation text below the heading
  renderChart: (expanded: boolean) => ReactNode  // Function that returns the actual <Bar>, <Pie> etc.
  // expanded=true means the chart is in the modal —
  // the function can then use larger fonts/padding
}

// ChartCardProps — props for the individual chart card component
type ChartCardProps = {
  chart: ChartDefinition
  onExpand: (id: string) => void  // Called when "Expand" is clicked; sets the modal chart ID
}

// CSS class strings stored as constants to avoid repeating them.
// chartViewportClass: fixed height so Chart.js can calculate axis sizes properly.
// expandedChartViewportClass: wider minimum width so the modal is usable on large screens.
// Keep mobile cards fully visible while still giving desktop enough chart area.
const chartViewportClass = 'h-56 sm:h-72 lg:h-96 xl:h-[28rem]'
const expandedChartViewportClass = 'h-[22rem] w-full sm:h-[30rem] sm:min-w-[48rem] sm:w-auto'

// ChartCard — renders a single chart inside a titled card with an Expand button.
// It is kept outside ChartsPage so React does not re-create the component type
// on every render (which would unmount/remount and reset Chart.js animations).
const ChartCard = ({ chart, onExpand }: ChartCardProps) => (
  <article className="min-w-0 overflow-hidden rounded-lg border bg-white p-3 sm:p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold">{chart.title}</h3>
        <div className="text-xs text-slate-500">{chart.description}</div>
      </div>
      {/* Each chart can open in a wider viewport so mobile users can inspect dense legends and labels. */}
      <button
        type="button"
        className="shrink-0 rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3 sm:py-2"
        onClick={() => onExpand(chart.id)}
      >
        Expand
      </button>
    </div>
    {/* Fixed-height containers give Chart.js enough room to render axes and legends on small screens. */}
    <div className={`min-w-0 ${chartViewportClass}`}>{chart.renderChart(false)}</div>
  </article>
)

export const ChartsPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })

  // expandedChartId — stores the ID of the chart currently open in the full-screen
  // modal, or null if no modal is open.
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null)

  // isCompactCharts — true when the viewport is narrow (<768 px).
  // Chart.js tick font sizes and legend sizes are reduced to keep charts readable
  // on small screens. This state updates automatically when the window is resized.
  const [isCompactCharts, setIsCompactCharts] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  // We use charts and alumni from useAnalytics. charts feeds the chart visualisations;
  // alumni feeds the filter dropdown options.
  const { charts, alumni, loading, error, fetchAll, fetchWithFilters } = useAnalytics(apiKey, filters, onErrorToast)

  const programOptions = useMemo(() => buildProgramOptions(alumni), [alumni])
  const industryOptions = useMemo(() => buildIndustryOptions(alumni), [alumni])

  const handleClearFilters = async () => {
    const clearedFilters = { ...emptyFilters }
    setFilters(clearedFilters)
    await fetchWithFilters(clearedFilters)
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')

    // Keep chart legends and axis density in sync with the current screen width.
    const syncCompactCharts = (matchesCompact: boolean) => {
      setIsCompactCharts(matchesCompact)
    }

    syncCompactCharts(mediaQuery.matches)  // Apply on first render

    const handleChange = (event: MediaQueryListEvent) => {
      syncCompactCharts(event.matches)  // Re-apply when the viewport crosses the breakpoint
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)  // Cleanup on unmount
  }, [])

  // When a chart is expanded into the modal, prevent the page behind it from scrolling.
  // We also listen for the Escape key so keyboard users can close the modal easily.
  useEffect(() => {
    if (!expandedChartId) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'  // Prevent background scroll while modal is open

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedChartId(null)  // Close the modal on Escape key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow  // Restore scroll on close
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expandedChartId])

  /**
   * Maps certification percentage to severity color for Skills Gap visualization.
   * Helps university stakeholders quickly identify critical curriculum gaps (red bars) vs. emerging areas (yellow).
   * 
   * @param {number} value - Percentage of alumni with the certification (0-100)
   * @returns {string} Hex color code: #EF4444 (≥70% critical), #F97316 (≥50% significant),
   *                   #EAB308 (≥20% emerging), #6B7280 (<20% monitor)
   * 
   * @example
   * skillGapColor(75) // returns '#EF4444' (red) → "Critical gap, add to curriculum"
   * skillGapColor(15) // returns '#6B7280' (gray) → "Monitor but not urgent"
   */
  const skillGapColor = (value: number) => {
    if (value >= 70) return '#EF4444'
    if (value >= 50) return '#F97316'
    if (value >= 20) return '#EAB308'
    return '#6B7280'
  }

  // ——— Data preparation for the Certification Trend line chart ———
  // trendSeries — flat list of { certification, year, value } entries from the API
  const trendSeries = charts?.certificationTrendSeries || []

  // Get a sorted unique list of years (x-axis labels for the line chart)
  const trendYearLabels = Array.from(new Set(trendSeries.map((entry) => entry.year))).sort(
    (a, b) => Number(a) - Number(b)
  )

  // Get a unique list of certification names (one line per certification)
  const certificationNames = Array.from(new Set(trendSeries.map((entry) => entry.certification)))

  // alumniTotalsByYear — total alumni graduated each year; used to convert counts to percentages
  const totalsByYear = charts?.alumniTotalsByYear || {}

  // If every year has a known total, show percentages on the Y-axis.
  // Otherwise fall back to raw counts (some data sets may not have total-by-year data).
  const usePercentages =
    trendYearLabels.length > 0 && trendYearLabels.every((year) => (totalsByYear[year] || 0) > 0)

  // Pivot the flat trendSeries into a nested object keyed by certification then year.
  // Structure: { 'AWS Certified': { '2021': 5, '2022': 10, ... }, ... }
  // This makes it easy to look up a certification's value for any given year.
  const certYearValues = trendSeries.reduce<Record<string, Record<string, number>>>((acc, entry) => {
    if (!acc[entry.certification]) acc[entry.certification] = {}
    acc[entry.certification][entry.year] = entry.value
    return acc
  }, {})

  // lineColorFor — generates a visually distinct colour for each certification line
  // using the "golden angle" (137.508°) technique: spacing hues around the colour
  // wheel by the golden ratio ensures no two adjacent lines look similar.
  const lineColorFor = (index: number) => {
    const hue = Math.round((index * 137.508) % 360)
    return `hsl(${hue} 72% 44%)`
  }

  // Pre-compute a stable colour map so the same certification always gets the same
  // colour even if the chart is re-rendered with different filter results.
  const lineColorByCertification = new Map(
    certificationNames.map((certification, index) => [certification, lineColorFor(index)])
  )

  // Build the Chart.js dataset array — one dataset object per certification.
  // Each dataset controls colour, dot size, line tension, etc.
  const certificationTrendDatasets = certificationNames.map((certification, index) => {
    const borderColor = lineColorByCertification.get(certification) || lineColorFor(index)
    return {
      label: certification,
      data: trendYearLabels.map((year) => {
        const count = certYearValues[certification]?.[year] || 0
        if (!usePercentages) return count  // Raw count mode
        const total = totalsByYear[year] || 0
        return total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0  // Percentage mode
      }),
      borderColor,
      backgroundColor: borderColor,
      tension: 0.4,         // Slightly curved lines
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: borderColor,
      pointBorderColor: '#ffffff',
      fill: false,
    }
  })

  // ——— Data preparation for the Geographic Distribution radar chart ———
  const geographicValues = charts?.geographicDistribution.map((x) => x.value) || []
  const maxGeographicAlumni = geographicValues.length ? Math.max(...geographicValues) : 0
  // geographicStepSize: a readable tick interval on the radar's radial axis.
  // Dividing max by 3 gives roughly 3 rings on the chart.
  const geographicStepSize = Math.max(1, Math.ceil(maxGeographicAlumni / 3))

  // ——— Totals used for percentage calculations in chart tooltips ———
  // Totals power the richer tooltip text and keep chart hover details aligned with exports.
  const employmentIndustryTotal = charts?.employmentByIndustry.reduce((sum, item) => sum + item.value, 0) || 0
  const commonJobTitlesTotal = charts?.commonJobTitles.reduce((sum, item) => sum + item.value, 0) || 0
  const topEmployersTotal = charts?.topEmployers.reduce((sum, item) => sum + item.value, 0) || 0
  const geographicDistributionTotal = charts?.geographicDistribution.reduce((sum, item) => sum + item.value, 0) || 0

  // Shared percentage formatter keeps hover labels aligned with report exports.
  const formatShare = (value: number, total: number) => {
    if (total <= 0) return '0.0'
    return ((value / total) * 100).toFixed(1)
  }

  // Font size helpers: smaller ticks on narrow screens, normal size on desktop.
  const sharedTickFontSize = isCompactCharts ? 10 : 12
  // Legend position: bottom on mobile (less width), right on desktop (avoids squashing the chart).
  const compactLegendPosition = 'bottom' as const
  const wideLegendPosition = 'right' as const

  const chartDefinitions: ChartDefinition[] = charts ? [
    {
      id: 'skills-gap',
      title: 'Skills Gap Analysis (Bar)',
      description: (
        <>
          Percentage of alumni holding each certification, calculated across all alumni records in the database up to the current date.
          Bars are colour-coded by gap severity:&nbsp;
          <span className="font-medium text-red-500">■ Critical (≥ 70%)</span>,&nbsp;
          <span className="font-medium text-orange-500">■ Significant (≥ 50%)</span>,&nbsp;
          <span className="font-medium text-yellow-500">■ Emerging (≥ 20%)</span>,&nbsp;
          <span className="font-medium text-slate-500">■ Monitor (&lt; 20%)</span>.
          Higher values indicate a widely-held certification; lower values highlight areas where the cohort may be under-qualified.
        </>
      ),
      renderChart: (expanded) => (
        <Bar
          data={{
            labels: charts.skillsGap.map((x) => x.label),
            datasets: [{
              label: '% Alumni',
              data: charts.skillsGap.map((x) => x.percentage),
              backgroundColor: charts.skillsGap.map((x) => skillGapColor(x.percentage)),
              borderWidth: 0,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const value = context.parsed.y ?? 0
                    const label = value >= 70 ? 'CRITICAL GAP' : value >= 50 ? 'SIGNIFICANT GAP' : value >= 20 ? 'EMERGING GAP' : 'MONITOR'
                    return `${value}% of alumni (${label})`
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: { font: { size: expanded ? 12 : sharedTickFontSize } },
                title: { display: true, text: 'Percentage of Alumni (%)' },
              },
              x: {
                ticks: {
                  font: { size: expanded ? 12 : sharedTickFontSize },
                  maxRotation: isCompactCharts && !expanded ? 18 : 0,
                  minRotation: isCompactCharts && !expanded ? 18 : 0,
                },
                title: { display: true, text: 'Certification' },
              },
            },
          }}
        />
      ),
    },
    {
      id: 'certification-trend',
      title: 'Certification Trend (Line)',
      description: 'How certification uptake has changed year-on-year across the cohort. Each line represents one certification; values show the percentage of alumni who held it in a given graduation year.',
      renderChart: (expanded) => (
        <Line
          id="trendsChart"
          data={{ labels: trendYearLabels, datasets: certificationTrendDatasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  boxWidth: expanded ? 32 : (isCompactCharts ? 18 : 36),
                  font: { size: expanded ? 12 : sharedTickFontSize },
                },
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.dataset.label || ''
                    const value = context.parsed.y ?? 0
                    return usePercentages ? `${label}: ${value}%` : `${label}: ${value}`
                  },
                  footer: () => usePercentages
                    ? 'Based on alumni graduating in that year.'
                    : 'Absolute count of certifications earned.',
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { font: { size: expanded ? 12 : sharedTickFontSize } },
                title: {
                  display: true,
                  text: usePercentages
                    ? 'Percentage of Alumni with Certification (%)'
                    : 'Number of Certifications Earned',
                },
              },
              x: {
                ticks: { font: { size: expanded ? 12 : sharedTickFontSize } },
                title: { display: true, text: 'Year' },
              },
            },
          }}
        />
      ),
    },
    {
      id: 'industry-sector',
      title: 'Employment by Industry Sector (Pie)',
      description: 'Breakdown of the industries alumni are currently working in, based on their most recent employment record.',
      renderChart: (expanded) => (
        <Pie
          data={{
            labels: charts.employmentByIndustry.map((x) => x.label),
            datasets: [{
              label: 'Alumni Count',
              data: charts.employmentByIndustry.map((x) => x.value),
              backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#6B7280', '#84CC16'],
              borderWidth: 3,
              borderColor: '#fff',
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: expanded ? wideLegendPosition : (isCompactCharts ? compactLegendPosition : wideLegendPosition),
                labels: {
                  boxWidth: expanded ? 18 : (isCompactCharts ? 14 : 18),
                  font: { size: expanded ? 12 : sharedTickFontSize },
                },
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || ''
                    const value = Number(context.parsed) || 0
                    return `${label}: ${value} alumni (${formatShare(value, employmentIndustryTotal)}%)`
                  },
                  footer: () => employmentIndustryTotal > 0 ? `Based on ${employmentIndustryTotal} alumni with an industry record.` : 'No industry data available.',
                },
              },
            },
          }}
        />
      ),
    },
    {
      id: 'job-titles',
      title: 'Most Common Job Titles (Doughnut)',
      description: 'The most frequently appearing job titles across all alumni employment records, showing which roles the cohort gravitates towards.',
      renderChart: (expanded) => (
        <Doughnut
          data={{
            labels: charts.commonJobTitles.map((x) => x.label),
            datasets: [{
              data: charts.commonJobTitles.map((x) => x.value),
              backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#6B7280', '#84CC16'],
              borderWidth: 3,
              borderColor: '#fff',
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: expanded ? wideLegendPosition : (isCompactCharts ? compactLegendPosition : wideLegendPosition),
                labels: {
                  boxWidth: expanded ? 18 : (isCompactCharts ? 14 : 18),
                  font: { size: expanded ? 12 : sharedTickFontSize },
                },
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || ''
                    const value = Number(context.parsed) || 0
                    return `${label}: ${value} alumni (${formatShare(value, commonJobTitlesTotal)}%)`
                  },
                  footer: () => commonJobTitlesTotal > 0 ? `Based on ${commonJobTitlesTotal} tracked job-title records.` : 'No job-title data available.',
                },
              },
            },
          }}
        />
      ),
    },
    {
      id: 'top-employers',
      title: 'Top Employers (Horizontal Bar)',
      description: 'Companies that appear most frequently across alumni employment records, indicating the organisations where graduates are most likely to be hired.',
      renderChart: (expanded) => (
        <Bar
          options={{
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || ''
                    const value = Number(context.parsed.x) || 0
                    return `${label}: ${value} alumni (${formatShare(value, topEmployersTotal)}%)`
                  },
                  footer: () => topEmployersTotal > 0 ? `Based on ${topEmployersTotal} tracked employer records.` : 'No employer data available.',
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: expanded ? 12 : sharedTickFontSize } } },
              y: { ticks: { font: { size: expanded ? 12 : sharedTickFontSize } } },
            },
          }}
          data={{
            labels: charts.topEmployers.map((x) => x.label),
            datasets: [{ label: 'Alumni', data: charts.topEmployers.map((x) => x.value), backgroundColor: '#3B82F6' }],
          }}
        />
      ),
    },
    {
      id: 'geographic-distribution',
      title: 'Geographic Distribution (Radar)',
      description: 'Where alumni are currently working by region, based on the country or location listed in their most recent employment record.',
      renderChart: (expanded) => (
        <Radar
          data={{
            labels: charts.geographicDistribution.map((x) => x.label),
            datasets: [{
              label: 'Number of Alumni',
              data: geographicValues,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderColor: '#3B82F6',
              borderWidth: 2,
              pointBackgroundColor: '#3B82F6',
              pointBorderColor: '#fff',
              pointRadius: 3,
              pointHoverRadius: 4,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            // Top padding gives the outermost point labels enough clearance without creating a visible blank gap.
            // Give labels generous space all around — radar point labels sit outside the polygon boundary
            layout: { padding: { top: expanded ? 32 : 28, bottom: expanded ? 32 : 28, left: expanded ? 40 : 36, right: expanded ? 40 : 36 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || ''
                    const value = Number(context.parsed.r) || 0
                    return `${label}: ${value} alumni (${formatShare(value, geographicDistributionTotal)}%)`
                  },
                  footer: () => geographicDistributionTotal > 0
                    ? `Based on ${geographicDistributionTotal} alumni with a geographic record.`
                    : 'No geographic data available.',
                },
              },
            },
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: maxGeographicAlumni,
                angleLines: { display: true },
                grid: { display: true, circular: false },
                pointLabels: {
                  // More padding between the polygon edge and the region name text
                  padding: expanded ? 16 : (isCompactCharts ? 10 : 14),
                  font: { size: expanded ? 13 : (isCompactCharts ? 10 : 12) },
                },
                ticks: {
                  display: true,
                  stepSize: geographicStepSize,
                  padding: expanded ? 8 : (isCompactCharts ? 6 : 12),
                  showLabelBackdrop: false,
                  color: '#0f172a',
                  font: { size: expanded ? 12 : (isCompactCharts ? 10 : 14), weight: 'bold' },
                  z: 10,
                  callback: (value) => Math.round(Number(value)).toString(),
                },
              },
            },
          }}
        />
      ),
    },
  ] : []

  const expandedChart = chartDefinitions.find((chart) => chart.id === expandedChartId) || null

  /**
   * Exports all rendered charts to a single PNG image without external CSS parsing.
   * 
   * Why manual canvas composition instead of html2canvas?
   * - Tailwind CSS v4 emits modern oklch() color functions
   * - html2canvas 1.x cannot parse oklch(); it fails silently in async pipeline
   * - Solution: Each Chart.js instance is already a <canvas> element
   * - We iterate <canvas> elements directly and drawImage() them onto a master canvas
   * - Result: High-fidelity export with zero CSS interpretation overhead
   * 
   * Grid layout preserved: charts exported in 2-column layout (on desktop) or 1-column (mobile)
   * Titles rendered above each chart on the master canvas.
   */
  const downloadChartImage = () => {
    const grid = document.getElementById('charts-grid')
    if (!grid) return
    const canvases = Array.from(grid.querySelectorAll('canvas')) as HTMLCanvasElement[]
    if (canvases.length === 0) {
      onErrorToast('Click "Apply Filters" first - there is nothing to capture.')
      return
    }

    // Match the tablet/desktop grid so exported chart sheets follow the on-screen layout.
    const cols = window.innerWidth >= 1280 ? 2 : 1
    const pad = 24
    const titleH = 28
    const cellW = Math.max(...canvases.map((canvas) => canvas.width))
    const cellH = Math.max(...canvases.map((canvas) => canvas.height)) + titleH
    const rows = Math.ceil(canvases.length / cols)

    const master = document.createElement('canvas')
    master.width = cols * cellW + (cols + 1) * pad
    master.height = rows * cellH + (rows + 1) * pad
    const ctx = master.getContext('2d')
    if (!ctx) {
      onErrorToast('Could not create canvas context for export.')
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, master.width, master.height)
    ctx.fillStyle = '#0f172a'
    ctx.font = '600 16px system-ui, sans-serif'

    canvases.forEach((canvas, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const x = pad + col * (cellW + pad)
      const y = pad + row * (cellH + pad)
      const title = (canvas.closest('.rounded-lg')?.querySelector('h3')?.textContent || '').trim()
      if (title) ctx.fillText(title, x, y + 18)
      ctx.drawImage(canvas, x, y + titleH)
    })

    const link = document.createElement('a')
    link.href = master.toDataURL('image/png')
    link.download = 'charts-dashboard.png'
    link.click()
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Trends, Charts and Graphs</h2>
      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        actionLabel="Apply Filters"
        onAction={fetchAll}
        onClear={handleClearFilters}
        programOptions={programOptions}
        industryOptions={industryOptions}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={downloadChartImage} className="rounded border px-4 py-2 text-sm">Download Chart Image</button>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {charts && (
        <div id="charts-grid" className="grid gap-4 xl:grid-cols-2">
          {/* Hold the charts in one column until xl so tablet screens have enough width for legends and axes. */}
          {chartDefinitions.map((chart) => <ChartCard key={chart.id} chart={chart} onExpand={setExpandedChartId} />)}
        </div>
      )}
      {expandedChart ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close expanded chart"
            className="absolute inset-0"
            onClick={() => setExpandedChartId(null)}
          />
          {/* The modal keeps a landscape-sized chart area and allows horizontal scrolling when the phone is too narrow. */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{expandedChart.title}</h3>
                <p className="mt-1 text-xs text-slate-500">Rotate your phone for the widest view, or swipe sideways inside the chart if needed.</p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setExpandedChartId(null)}
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto overflow-y-hidden">
              <div className={expandedChartViewportClass}>{expandedChart.renderChart(true)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
