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

  // Returns the bar color for a Skills Gap entry — red/amber/orange by severity,
  // falling back to a rotating palette for entries below the "monitor" threshold.
  const skillColors = (n: number, severity?: string) => {
    if (severity === 'critical') return '#EF4444'
    if (severity === 'significant') return '#F59E0B'
    if (severity === 'emerging') return '#F97316'
    return ['#3B82F6', '#10B981', '#6366F1', '#14B8A6', '#A855F7'][n % 5]
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Trends, Charts and Graphs</h2>
      <FiltersBar filters={filters} setFilters={setFilters} />
      <div className="flex gap-2">
        <button onClick={fetchAll} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Load Charts</button>
        <button onClick={downloadChartImage} className="rounded border px-4 py-2 text-sm">Download Chart Image</button>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {charts && (
        <div id="charts-grid" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Skills Gap Analysis (Bar)</h3><Bar data={{ labels: charts.skillsGap.map((x) => x.label), datasets: [{ label: '% Alumni', data: charts.skillsGap.map((x) => x.percentage), backgroundColor: charts.skillsGap.map((x, i) => skillColors(i, x.severity)) }] }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Certification Trend (Line)</h3><Line data={{ labels: charts.certificationTrend.map((x) => x.year), datasets: [{ label: 'Certifications', data: charts.certificationTrend.map((x) => x.value), borderColor: '#326CE5', backgroundColor: 'rgba(50,108,229,0.1)', fill: true, tension: 0.35 }] }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Employment by Industry Sector (Pie)</h3><Pie data={{ labels: charts.employmentByIndustry.map((x) => x.label), datasets: [{ label: 'Alumni Count', data: charts.employmentByIndustry.map((x) => x.value), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#6B7280', '#84CC16'], borderWidth: 3, borderColor: '#fff' }] }} options={{ plugins: { legend: { position: 'right' as const } } }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Most Common Job Titles (Doughnut)</h3><Doughnut data={{ labels: charts.commonJobTitles.map((x) => x.label), datasets: [{ data: charts.commonJobTitles.map((x) => x.value) }] }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Top Employers (Horizontal Bar)</h3><Bar options={{ indexAxis: 'y' as const }} data={{ labels: charts.topEmployers.map((x) => x.label), datasets: [{ label: 'Alumni', data: charts.topEmployers.map((x) => x.value), backgroundColor: '#3B82F6' }] }} /></div>
          <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Top Course Providers (Radar)</h3><Radar data={{ labels: charts.topCourseProviders.map((x) => x.label), datasets: [{ label: 'Count', data: charts.topCourseProviders.map((x) => x.value), backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3B82F6' }] }} /></div>
          <div className="rounded-lg border bg-white p-4 md:col-span-2">
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
