import { useState } from 'react'
import { Bar, Doughnut, Line, Pie, Radar } from 'react-chartjs-2'
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const ChartsPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const { charts, loading, error, fetchAll } = useAnalytics(apiKey, filters, onErrorToast)

  // Color-codes a Skills Gap bar by its percentage value:
  // Critical (>70%) → red, Significant (>50%) → orange, Emerging (>20%) → yellow, Monitor → gray.
  const skillGapColor = (value: number) => {
    if (value >= 70) return '#EF4444'
    if (value >= 50) return '#F97316'
    if (value >= 20) return '#EAB308'
    return '#6B7280'
  }

  const trendSeries = charts?.certificationTrendSeries || []
  const trendYearLabels = Array.from(new Set(trendSeries.map((entry) => entry.year))).sort(
    (a, b) => Number(a) - Number(b)
  )
  const certificationNames = Array.from(new Set(trendSeries.map((entry) => entry.certification)))
  const totalsByYear = charts?.alumniTotalsByYear || {}
  const usePercentages =
    trendYearLabels.length > 0 && trendYearLabels.every((year) => (totalsByYear[year] || 0) > 0)

  const certYearValues = trendSeries.reduce<Record<string, Record<string, number>>>((acc, entry) => {
    if (!acc[entry.certification]) acc[entry.certification] = {}
    acc[entry.certification][entry.year] = entry.value
    return acc
  }, {})

  const lineColorFor = (index: number) => {
    const hue = Math.round((index * 137.508) % 360)
    return `hsl(${hue} 72% 44%)`
  }

  const lineColorByCertification = new Map(
    certificationNames.map((certification, index) => [certification, lineColorFor(index)])
  )

  const certificationTrendDatasets = certificationNames.map((certification, index) => {
    const borderColor = lineColorByCertification.get(certification) || lineColorFor(index)
    return {
      label: certification,
      data: trendYearLabels.map((year) => {
        const count = certYearValues[certification]?.[year] || 0
        if (!usePercentages) return count
        const total = totalsByYear[year] || 0
        return total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
      }),
      borderColor,
      backgroundColor: borderColor,
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: borderColor,
      pointBorderColor: '#ffffff',
      fill: false,
    }
  })

  // Composes every <canvas> inside #charts-grid onto one image. Avoids html2canvas
  // because Tailwind v4 emits oklch() colors that html2canvas 1.x can't parse.
  const downloadChartImage = () => {
    const grid = document.getElementById('charts-grid')
    if (!grid) return
    const canvases = Array.from(grid.querySelectorAll('canvas')) as HTMLCanvasElement[]
    if (canvases.length === 0) {
      onErrorToast('Click "Load Charts" first — there is nothing to capture.')
      return
    }

    const cols = 2
    const pad = 24
    const titleH = 28
    const cellW = Math.max(...canvases.map((c) => c.width))
    const cellH = Math.max(...canvases.map((c) => c.height)) + titleH
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

    canvases.forEach((c, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * (cellW + pad)
      const y = pad + row * (cellH + pad)
      const title = (c.closest('.rounded-lg')?.querySelector('h3')?.textContent || '').trim()
      if (title) ctx.fillText(title, x, y + 18)
      ctx.drawImage(c, x, y + titleH)
    })

    const link = document.createElement('a')
    link.href = master.toDataURL('image/png')
    link.download = 'charts-dashboard.png'
    link.click()
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Trends, Charts and Graphs</h2>
      <FiltersBar filters={filters} setFilters={setFilters} actionLabel="Load Charts" onAction={fetchAll} />
      <div className="flex gap-2">
        <button onClick={downloadChartImage} className="rounded border px-4 py-2 text-sm">Download Chart Image</button>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {charts && (
        <div id="charts-grid" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Skills Gap Analysis (Bar)</h3>
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
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const v = context.parsed.y ?? 0
                        const label = v >= 70 ? 'CRITICAL GAP' : v >= 50 ? 'SIGNIFICANT GAP' : v >= 20 ? 'EMERGING GAP' : 'MONITOR'
                        return `${v}% of alumni (${label})`
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Percentage of Alumni (%)' },
                  },
                  x: {
                    title: { display: true, text: 'Certification' },
                  },
                },
              }}
            />
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Certification Trend (Line)</h3>
            <Line
              id="trendsChart"
              data={{ labels: trendYearLabels, datasets: certificationTrendDatasets }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { position: 'top' as const },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.dataset.label || ''
                        const value = context.parsed.y ?? 0
                        return usePercentages
                          ? `${label}: ${value}%`
                          : `${label}: ${value}`
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: usePercentages
                        ? 'Percentage of Alumni with Certification (%)'
                        : 'Number of Certifications Earned',
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Year',
                    },
                  },
                },
              }}
            />
          </div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Employment by Industry Sector (Pie)</h3><Pie data={{ labels: charts.employmentByIndustry.map((x) => x.label), datasets: [{ label: 'Alumni Count', data: charts.employmentByIndustry.map((x) => x.value), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#6B7280', '#84CC16'], borderWidth: 3, borderColor: '#fff' }] }} options={{ plugins: { legend: { position: 'right' as const } } }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Most Common Job Titles (Doughnut)</h3><Doughnut data={{ labels: charts.commonJobTitles.map((x) => x.label), datasets: [{ data: charts.commonJobTitles.map((x) => x.value), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#6B7280', '#84CC16'], borderWidth: 3, borderColor: '#fff' }] }} options={{ plugins: { legend: { position: 'right' as const } } }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Top Employers (Horizontal Bar)</h3><Bar options={{ indexAxis: 'y' as const }} data={{ labels: charts.topEmployers.map((x) => x.label), datasets: [{ label: 'Alumni', data: charts.topEmployers.map((x) => x.value), backgroundColor: '#3B82F6' }] }} /></div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Geographic Distribution</h3>
            <p className="mb-3 text-xs text-slate-500">Where alumni are currently working by region.</p>
            <Radar
              data={{
                labels: charts.geographicDistribution.map((x) => x.label),
                datasets: [{
                  label: 'Number of Alumni',
                  data: charts.geographicDistribution.map((x) => x.value),
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderColor: '#3B82F6',
                  borderWidth: 2,
                  pointBackgroundColor: '#3B82F6',
                  pointBorderColor: '#fff',
                  pointRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { r: { beginAtZero: true, ticks: { stepSize: 50 } } },
              }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
