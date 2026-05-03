import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const ReportsPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const [presetName, setPresetName] = useState('')
  const [presetMsg, setPresetMsg] = useState('')
  const [savedPresets, setSavedPresets] = useState<string[]>([])
  const { alumni, charts, loading, fetchAll, error } = useAnalytics(apiKey, filters, onErrorToast)

  // Refresh the preset list from localStorage on mount and after every save/delete.
  const refreshPresets = () => {
    const names: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('preset:')) names.push(k.slice('preset:'.length))
    }
    setSavedPresets(names.sort())
  }
  useEffect(() => { refreshPresets() }, [])

  const savePreset = () => {
    if (!presetName.trim()) {
      setPresetMsg('Type a preset name first.')
      return
    }
    localStorage.setItem(`preset:${presetName.trim()}`, JSON.stringify(filters))
    setPresetMsg(`Saved "${presetName.trim()}".`)
    refreshPresets()
  }

  const loadPreset = (name: string) => {
    const raw = localStorage.getItem(`preset:${name}`)
    if (!raw) {
      setPresetMsg(`No preset named "${name}".`)
      return
    }
    setFilters({ ...emptyFilters, ...JSON.parse(raw) })
    setPresetName(name)
    setPresetMsg(`Loaded "${name}". Click Load Report Data to fetch.`)
  }

  const deletePreset = (name: string) => {
    localStorage.removeItem(`preset:${name}`)
    setPresetMsg(`Deleted "${name}".`)
    refreshPresets()
  }

  const exportCsv = () => {
    const csv = Papa.unparse(
      alumni.map((a) => ({
        firstName: a.firstName,
        lastName: a.lastName,
        linkedInUrl: a.linkedInUrl,
        latestJobTitle: a.latestJobTitle,
        latestCompany: a.latestCompany,
        topCertification: a.topCertification,
        certificationsCount: a.certificationsCount,
        coursesCount: a.coursesCount,
        degreesCount: a.degreesCount,
      }))
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'alumni-report.csv'
    link.click()
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    const pageBottom = 285
    let y = 18

    const newPageIfNeeded = (need = 8) => {
      if (y + need > pageBottom) {
        doc.addPage()
        y = 18
      }
    }
    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
    const sectionHeader = (title: string) => {
      newPageIfNeeded(12)
      y += 3
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(title, 14, y)
      y += 6
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
    }
    const writeList = (items: Array<{ left: string; right?: string | number }>) => {
      for (const it of items) {
        newPageIfNeeded()
        const right = it.right !== undefined && it.right !== '' ? `  —  ${it.right}` : ''
        doc.text(truncate(`${it.left}${right}`, 110), 14, y)
        y += 5
      }
    }

    // Title + meta
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('University Analytics Report', 14, y); y += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, 14, y); y += 5

    const activeFilters = Object.entries(filters).filter(([, v]) => v && String(v).trim() !== '')
    doc.text(
      activeFilters.length
        ? `Filters: ${activeFilters.map(([k, v]) => `${k}=${v}`).join(', ')}`
        : 'Filters: (none — all alumni)',
      14, y,
    ); y += 6

    // Summary KPIs
    sectionHeader('Summary')
    writeList([
      { left: 'Alumni rows', right: alumni.length },
      { left: 'Skills-gap items', right: charts?.skillsGap?.length ?? 0 },
      { left: 'Top employers', right: charts?.topEmployers?.length ?? 0 },
      { left: 'Common job titles', right: charts?.commonJobTitles?.length ?? 0 },
      { left: 'Top course providers', right: charts?.topCourseProviders?.length ?? 0 },
      { left: 'Top degree institutions', right: charts?.topDegreeInstitutions?.length ?? 0 },
    ])

    // Alumni table — column positions chosen to fit A4 portrait at ~9pt
    if (alumni.length > 0) {
      sectionHeader('Alumni')
      doc.setFont('helvetica', 'bold')
      const cols = [
        { label: 'Name', x: 14, width: 30 },
        { label: 'Latest role', x: 60, width: 28 },
        { label: 'Company', x: 100, width: 22 },
        { label: 'Top cert', x: 138, width: 28 },
        { label: 'C/Co/D', x: 184, width: 12 },
      ]
      cols.forEach((c) => doc.text(c.label, c.x, y))
      y += 1
      doc.setLineWidth(0.2)
      doc.line(14, y, 196, y)
      y += 4
      doc.setFont('helvetica', 'normal')

      for (const a of alumni) {
        newPageIfNeeded()
        doc.text(truncate(`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '-', cols[0].width), cols[0].x, y)
        doc.text(truncate(a.latestJobTitle || '-', cols[1].width), cols[1].x, y)
        doc.text(truncate(a.latestCompany || '-', cols[2].width), cols[2].x, y)
        doc.text(truncate(a.topCertification || '-', cols[3].width), cols[3].x, y)
        doc.text(`${a.certificationsCount}/${a.coursesCount}/${a.degreesCount}`, cols[4].x, y)
        y += 5
      }
      doc.setFontSize(8)
      doc.setTextColor(100)
      newPageIfNeeded()
      doc.text('(C/Co/D = certifications / courses / degrees count per alumnus)', 14, y); y += 4
      doc.setTextColor(0)
      doc.setFontSize(9)
    }

    if (charts?.skillsGap?.length) {
      sectionHeader('Skills Gap (top certifications across cohort)')
      writeList(charts.skillsGap.map((s) => ({ left: s.label, right: `${s.percentage}% — ${s.severity}` })))
    }
    if (charts?.topEmployers?.length) {
      sectionHeader('Top Employers')
      writeList(charts.topEmployers.map((x) => ({ left: x.label, right: `${x.value} alumni` })))
    }
    if (charts?.commonJobTitles?.length) {
      sectionHeader('Most Common Job Titles')
      writeList(charts.commonJobTitles.map((x) => ({ left: x.label, right: `${x.value} alumni` })))
    }
    if (charts?.employmentByIndustry?.length) {
      sectionHeader('Employment by Industry Sector')
      writeList(charts.employmentByIndustry.map((x: { label: string; value: number }) => ({ left: x.label, right: x.value })))
    }
    if (charts?.topCourseProviders?.length) {
      sectionHeader('Top Course Providers')
      writeList(charts.topCourseProviders.map((x) => ({ left: x.label, right: x.value })))
    }
    if (charts?.topDegreeInstitutions?.length) {
      sectionHeader('Top Degree Institutions')
      writeList(charts.topDegreeInstitutions.map((x) => ({ left: x.label, right: x.value })))
    }
    if (charts?.certificationTrend?.length) {
      sectionHeader('Certification Trend by Year')
      writeList(charts.certificationTrend.map((x) => ({ left: x.year, right: `${x.value} certifications` })))
    }

    // Page numbers
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Page ${i} of ${total}`, 196, 290, { align: 'right' })
    }

    doc.save('analytics-report.pdf')
  }

  const dataReady = alumni.length > 0
  const noData = !loading && !error && alumni.length === 0

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Reports & Exports</h2>
      <FiltersBar filters={filters} setFilters={setFilters} />
      <div className="flex flex-wrap gap-2">
        <button onClick={fetchAll} className="rounded bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
          {loading ? 'Loading…' : 'Load Report Data'}
        </button>
        <button onClick={exportCsv} disabled={!dataReady}
          className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400">Export CSV</button>
        <button onClick={exportPdf} disabled={!dataReady}
          className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400">Export PDF</button>
      </div>

      {/* Status block — gives the user feedback after clicking Load Report Data */}
      <div className="rounded-lg border bg-white p-4 text-sm">
        {loading && <p className="text-slate-600">Fetching alumni and chart data…</p>}
        {error && <p className="text-rose-600">{error}</p>}
        {dataReady && !loading && (
          <div className="space-y-1">
            <p className="font-medium text-slate-900">Loaded successfully.</p>
            <p className="text-slate-600">Alumni rows: <span className="font-semibold">{alumni.length}</span></p>
            <p className="text-slate-600">Skills-gap items: <span className="font-semibold">{charts?.skillsGap?.length ?? 0}</span></p>
            <p className="text-slate-600">Top employers: <span className="font-semibold">{charts?.topEmployers?.length ?? 0}</span></p>
            <p className="mt-2 text-xs text-slate-500">Use Export CSV / Export PDF above to download.</p>
          </div>
        )}
        {noData && (
          <p className="text-slate-600">
            No data yet. Paste an API key with <code>read:alumni</code> + <code>read:analytics</code> in the sidebar, set filters above (or leave blank), then click Load Report Data.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium">Filter Presets</h3>
        <p className="mt-1 text-xs text-slate-500">
          Save the current filter values under a name and reload them later. Stored locally in your browser.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g. AWS recent grads)"
            className="rounded border p-2 text-sm"
          />
          <button onClick={savePreset} className="rounded border px-3 py-2 text-sm">Save</button>
          <button onClick={() => loadPreset(presetName)} className="rounded border px-3 py-2 text-sm">Load</button>
        </div>
        {presetMsg && <p className="mt-2 text-xs text-slate-600">{presetMsg}</p>}

        {savedPresets.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">Saved presets</p>
            <ul className="mt-1 divide-y rounded border">
              {savedPresets.map((name) => (
                <li key={name} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{name}</span>
                  <span className="flex gap-2">
                    <button onClick={() => loadPreset(name)} className="text-xs text-blue-600 hover:underline">Load</button>
                    <button onClick={() => deletePreset(name)} className="text-xs text-rose-600 hover:underline">Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
