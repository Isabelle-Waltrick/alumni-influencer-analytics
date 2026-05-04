// ─────────────────────────────────────────────────────────────────────────────
// pages/ReportsPage.tsx — Data exports and filter presets
//
// Lets the user download the currently loaded analytics data in two formats:
//   • CSV  — a multi-section spreadsheet with alumni rows + chart breakdowns
//   • PDF  — a formatted A4 document with tables and section headers
//
// The page also offers "Filter Presets":
//   • Save the current filter values under a name (stored in localStorage)
//   • Load a saved preset to quickly re-apply a previous set of filters
//   • Delete saved presets
//   localStorage persists across browser sessions (unlike sessionStorage)
//   so presets survive closing and reopening the browser.
//
// Libraries used:
//   papaparse — converts JS arrays/objects into CSV strings
//   jsPDF     — generates PDF files entirely in the browser (no server needed)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'  // Converts JS objects into CSV format
import jsPDF from 'jspdf'     // Generates PDF documents in the browser
import { FiltersBar } from '../components/FiltersBar'
import { useAnalytics } from '../hooks/useAnalytics'
import { emptyFilters } from '../lib/constants'
import { buildIndustryOptions, buildProgramOptions } from '../lib/filterOptions'
import type { Filters } from '../types'

type Props = { apiKey: string; onErrorToast: (message: string) => void }

export const ReportsPage = ({ apiKey, onErrorToast }: Props) => {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })

  // presetName — the text field where the user types a name to save/load a preset
  const [presetName, setPresetName] = useState('')

  // presetMsg — status message shown after save/load/delete actions (e.g. 'Saved "My Preset".')
  const [presetMsg, setPresetMsg] = useState('')

  // savedPresets — the names of all presets currently stored in localStorage.
  // Displayed as a list so the user can load or delete them.
  const [savedPresets, setSavedPresets] = useState<string[]>([])

  // We need alumni (for the table section) and charts (for the breakdown sections).
  const { alumni, charts, loading, fetchAll, fetchWithFilters, error } = useAnalytics(apiKey, filters, onErrorToast)
  const programOptions = useMemo(() => buildProgramOptions(alumni), [alumni])
  const industryOptions = useMemo(() => buildIndustryOptions(alumni), [alumni])

  // Clear should reset fields and immediately reload report datasets (tables + chart-backed exports).
  const handleClearFilters = async () => {
    const clearedFilters = { ...emptyFilters }
    setFilters(clearedFilters)
    await fetchWithFilters(clearedFilters)
  }

  // Pre-calculate totals for each breakdown section.
  // Each total is the sum of all values in that chart dataset —
  // needed to convert raw counts into percentages for the exports.
  const employmentIndustryTotal = charts?.employmentByIndustry.reduce((sum, item) => sum + item.value, 0) || 0
  const commonJobTitlesTotal = charts?.commonJobTitles.reduce((sum, item) => sum + item.value, 0) || 0
  const topEmployersTotal = charts?.topEmployers.reduce((sum, item) => sum + item.value, 0) || 0
  const geographicDistributionTotal = charts?.geographicDistribution.reduce((sum, item) => sum + item.value, 0) || 0
  const certificationTrendTotal = charts?.certificationTrend?.reduce((sum, item) => sum + item.value, 0) || 0

  /**
   * Formats a data point as a percentage string, maintaining consistency across all exports.
   * Used in CSV, PDF, and chart tooltips so exported reports match on-screen visualizations.
   * 
   * @param {number} value - Count of items (e.g., 35 alumni with certification)
   * @param {number} total - Total population (e.g., 150 alumni overall)
   * @returns {string} Percentage with one decimal (e.g., "23.3")
   * 
   * @example
   * formatShare(35, 150)  // returns "23.3" → rendered as "23.3%" in CSV/PDF
   * formatShare(0, 100)   // returns "0.0" (prevents division-by-zero issues)
   */
  const formatShare = (value: number, total: number) => {
    if (total <= 0) return '0.0'
    return ((value / total) * 100).toFixed(1)
  }

  // refreshPresets — reads all keys from localStorage and keeps only the ones
  // that start with 'preset:'. Strips the prefix to get the human-readable name.
  // Called on mount and after every save/load/delete so the list stays up to date.
  const refreshPresets = () => {
    const names: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('preset:')) names.push(k.slice('preset:'.length))
    }
    setSavedPresets(names.sort())  // Sort alphabetically for consistent display order
  }
  // Load the preset list as soon as this page first renders.
  useEffect(() => { refreshPresets() }, [])

  // savePreset — serialises the current filter object to JSON and stores it
  // in localStorage under the key 'preset:<name>'.
  const savePreset = () => {
    if (!presetName.trim()) {
      setPresetMsg('Type a preset name first.')
      return
    }
    localStorage.setItem(`preset:${presetName.trim()}`, JSON.stringify(filters))
    setPresetMsg(`Saved "${presetName.trim()}".`)
    refreshPresets()
  }

  // loadPreset — reads the stored JSON from localStorage and merges it with
  // emptyFilters so any new fields added later don't cause undefined values.
  const loadPreset = (name: string) => {
    const raw = localStorage.getItem(`preset:${name}`)
    if (!raw) {
      setPresetMsg(`No preset named "${name}".`)
      return
    }
    setFilters({ ...emptyFilters, ...JSON.parse(raw) })  // Spread to keep type safety
    setPresetName(name)
    setPresetMsg(`Loaded "${name}". Use the load button to refresh with those filters.`)
  }

  // deletePreset — removes the key from localStorage and refreshes the displayed list.
  const deletePreset = (name: string) => {
    localStorage.removeItem(`preset:${name}`)
    setPresetMsg(`Deleted "${name}".`)
    refreshPresets()
  }

  const exportCsv = () => {
    // ——— Section 1: Alumni rows ———
    // The first section mirrors the Alumni Explorer table so spreadsheet exports stay familiar.
    // Papa.unparse() converts an array of plain objects into a CSV string.
    const alumniCsv = Papa.unparse(
      alumni.map((a) => ({
        Name: `${a.firstName} ${a.lastName}`.trim(),
        Program: a.programs.join(' | ') || '-',
        'Graduation Date': a.graduationDateDisplay || '-',
        'Latest Company': a.latestCompany || '-',
        Certifications: a.certifications.join(' | ') || '-',
        Industry: a.latestIndustry || '-',
      }))
    )

    // ——— Sections 2-6: Chart breakdowns ———
    // Extra report sections carry the same count + percentage context shown in the charts.
    // Each section is only added if the data exists (?.length check).
    const jobTitlesCsv = charts?.commonJobTitles?.length
      ? Papa.unparse(
        charts.commonJobTitles.map((item) => ({
          'Job Title': item.label,
          'Alumni Count': item.value,
          Percentage: `${formatShare(item.value, commonJobTitlesTotal)}%`,
          Basis: `${commonJobTitlesTotal} tracked job-title records`,
        }))
      )
      : ''
    const topEmployersCsv = charts?.topEmployers?.length
      ? Papa.unparse(
        charts.topEmployers.map((item) => ({
          Employer: item.label,
          'Alumni Count': item.value,
          Percentage: `${formatShare(item.value, topEmployersTotal)}%`,
          Basis: `${topEmployersTotal} tracked employer records`,
        }))
      )
      : ''
    const industriesCsv = charts?.employmentByIndustry?.length
      ? Papa.unparse(
        charts.employmentByIndustry.map((item) => ({
          Industry: item.label,
          'Alumni Count': item.value,
          Percentage: `${formatShare(item.value, employmentIndustryTotal)}%`,
          Basis: `${employmentIndustryTotal} alumni with an industry record`,
        }))
      )
      : ''
    const geographyCsv = charts?.geographicDistribution?.length
      ? Papa.unparse(
        charts.geographicDistribution.map((item) => ({
          Region: item.label,
          'Alumni Count': item.value,
          Percentage: `${formatShare(item.value, geographicDistributionTotal)}%`,
          Basis: `${geographicDistributionTotal} alumni with a geographic record`,
        }))
      )
      : ''
    const certificationTrendCsv = charts?.certificationTrendSeries?.length
      ? Papa.unparse(
        charts.certificationTrendSeries.map((item) => {
          const yearTotal = charts.certificationTrend?.find((yt) => yt.year === item.year)?.value || 1
          return {
            Year: item.year,
            Certification: item.certification,
            Count: item.value,
            Percentage: `${formatShare(item.value, yearTotal)}%`,
            Basis: `${yearTotal} certifications earned in ${item.year}`,
          }
        })
      )
      : ''
    // Join all non-empty sections with a blank line between them.
    // filter(Boolean) removes any empty strings (sections that had no data).
    const csvSections = [
      'Alumni',
      alumniCsv,
      topEmployersCsv ? `Top Employers\n${topEmployersCsv}` : '',
      jobTitlesCsv ? `Most Common Job Titles\n${jobTitlesCsv}` : '',
      industriesCsv ? `Employment by Industry Sector\n${industriesCsv}` : '',
      geographyCsv ? `Geographic Distribution\n${geographyCsv}` : '',
      certificationTrendCsv ? `Certification Trend by Year and Certification\n${certificationTrendCsv}` : '',
    ].filter(Boolean)
    const csv = csvSections.join('\n\n')

    // Create a Blob (binary object) from the CSV string and trigger a browser download.
    // URL.createObjectURL creates a temporary URL pointing to the blob data.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')  // Create a hidden <a> element to trigger the download
    link.href = url
    link.download = 'alumni-report.csv'
    link.click()  // Programmatically click the link to start the download
  }

  const exportPdf = () => {
    const doc = new jsPDF()  // Create a new A4-sized PDF document (default: portrait, mm units)
    const pageBottom = 285  // Leave ~5 mm margin at the bottom before adding a new page
    let y = 18              // Current vertical cursor position in mm from the top of the page

    // newPageIfNeeded — checks whether the next content block fits on the current page.
    // If not, it creates a new page and resets y to the top margin.
    const newPageIfNeeded = (need = 8) => {
      if (y + need > pageBottom) {
        doc.addPage()
        y = 18
      }
    }

    // truncate — clips a string to n characters and adds '…' if it was cut.
    // Prevents long text from overflowing a column in the PDF table.
    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

    // sectionHeader — prints a bold section title with a small gap above it.
    // Resets the font back to normal size/weight afterwards so body text is unaffected.
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

    // writeList — prints each item as "left text  —  right text" on its own line.
    // Used for all the breakdown sections (employers, job titles, etc.).
    const writeList = (items: Array<{ left: string; right?: string | number }>) => {
      for (const it of items) {
        newPageIfNeeded()
        const right = it.right !== undefined && it.right !== '' ? `  —  ${it.right}` : ''
        doc.text(truncate(`${it.left}${right}`, 110), 14, y)
        y += 5
      }
    }

    // ——— Document title and metadata ———
    // Title + meta
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('University Analytics Report', 14, y); y += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, 14, y); y += 5

    // Print the active filters so the reader knows what subset of data is in the report.
    const activeFilters = Object.entries(filters).filter(([, v]) => v && String(v).trim() !== '')
    doc.text(
      activeFilters.length
        ? `Filters: ${activeFilters.map(([k, v]) => `${k}=${v}`).join(', ')}`
        : 'Filters: (none — all alumni)',
      14, y,
    ); y += 6

    // ——— Summary KPI numbers ———
    // Summary KPIs
    sectionHeader('Summary')
    writeList([
      { left: 'Alumni rows', right: alumni.length },
      { left: 'Skills-gap items', right: charts?.skillsGap?.length ?? 0 },
      { left: 'Top employers', right: charts?.topEmployers?.length ?? 0 },
      { left: 'Common job titles', right: charts?.commonJobTitles?.length ?? 0 },
      { left: 'Geographic distribution entries', right: charts?.geographicDistribution?.length ?? 0 },
    ])

    // ——— Alumni table ———
    // Each cell can be multi-line (e.g. multiple programs/dates), so we measure
    // the tallest cell in each row and use that height for the whole row.
    // Column positions (x) and widths are tuned to fit A4 portrait at ~9 pt.
    // Alumni table — column positions chosen to fit A4 portrait at ~9pt
    if (alumni.length > 0) {
      sectionHeader('Alumni')
      doc.setFont('helvetica', 'bold')
      const cols = [
        { label: 'Name', x: 14, width: 34 },
        { label: 'Program', x: 52, width: 38 },
        { label: 'Graduation Date', x: 94, width: 30 },
        { label: 'Company', x: 128, width: 28 },
        { label: 'Industry', x: 160, width: 36 },
      ]
      cols.forEach((c) => doc.text(c.label, c.x, y))
      y += 1
      doc.setLineWidth(0.2)
      doc.line(14, y, 196, y)
      y += 4
      doc.setFont('helvetica', 'normal')

      // mm-per-line at 9pt (~3.175 mm per point, 9pt ≈ 4.5 mm)
      const lineH = 4.5
      for (const a of alumni) {
        // Wrap each cell to its column width and measure how many lines it needs
        const cells = [
          doc.splitTextToSize(`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '-', cols[0].width),
          doc.splitTextToSize(a.programs.join('\n') || '-', cols[1].width),
          doc.splitTextToSize(a.graduationDateDisplay || '-', cols[2].width),
          doc.splitTextToSize(a.latestCompany || '-', cols[3].width),
          doc.splitTextToSize(a.latestIndustry || '-', cols[4].width),
        ] as string[][]
        const textHeight = Math.max(...cells.map((c) => c.length)) * lineH
        const rowPadding = 3
        newPageIfNeeded(textHeight + rowPadding)
        cells.forEach((lines, i) => doc.text(lines, cols[i].x, y))
        y += textHeight
        // Divider line drawn after the last line of text, before the next row
        doc.setLineWidth(0.1)
        doc.setDrawColor(180)
        doc.line(14, y + 1, 196, y + 1)
        doc.setDrawColor(0)
        y += rowPadding + 1
      }
    }

    if (charts?.skillsGap?.length) {
      sectionHeader('Skills Gap (top certifications across cohort)')
      writeList(charts.skillsGap.map((s) => ({ left: s.label, right: `${s.percentage}% — ${s.severity}` })))
    }
    if (charts?.topEmployers?.length) {
      sectionHeader('Top Employers')
      writeList(charts.topEmployers.map((x) => ({ left: x.label, right: `${x.value} alumni (${formatShare(x.value, topEmployersTotal)}%)` })))
      newPageIfNeeded()
      doc.text(`Based on ${topEmployersTotal} tracked employer records.`, 14, y)
      y += 5
    }
    if (charts?.commonJobTitles?.length) {
      sectionHeader('Most Common Job Titles')
      writeList(charts.commonJobTitles.map((x) => ({ left: x.label, right: `${x.value} alumni (${formatShare(x.value, commonJobTitlesTotal)}%)` })))
      newPageIfNeeded()
      doc.text(`Based on ${commonJobTitlesTotal} tracked job-title records.`, 14, y)
      y += 5
    }
    if (charts?.employmentByIndustry?.length) {
      sectionHeader('Employment by Industry Sector')
      // Match the richer hover state by exporting both raw counts and share of the visible total.
      writeList(charts.employmentByIndustry.map((x: { label: string; value: number }) => ({ left: x.label, right: `${x.value} alumni (${formatShare(x.value, employmentIndustryTotal)}%)` })))
      newPageIfNeeded()
      doc.text(`Based on ${employmentIndustryTotal} alumni with an industry record.`, 14, y)
      y += 5
    }
    if (charts?.geographicDistribution?.length) {
      sectionHeader('Geographic Distribution')
      writeList(charts.geographicDistribution.map((x) => ({ left: x.label, right: `${x.value} alumni (${formatShare(x.value, geographicDistributionTotal)}%)` })))
      newPageIfNeeded()
      doc.text(`Based on ${geographicDistributionTotal} alumni with a geographic record.`, 14, y)
      y += 5
    }
    if (charts?.certificationTrend?.length) {
      sectionHeader('Certification Trend by Year')
      writeList(charts.certificationTrend.map((x) => ({ left: x.year, right: `${x.value} certifications (${formatShare(x.value, certificationTrendTotal)}%)` })))
      newPageIfNeeded()
      doc.text(`Based on ${certificationTrendTotal} total certifications earned across all years.`, 14, y)
      y += 5
    }

    // ——— Add page numbers to every page ———
    // We can only know the total page count AFTER all content has been added,
    // so we loop back over every page at the end to stamp "Page X of Y".
    // Page numbers
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Page ${i} of ${total}`, 196, 290, { align: 'right' })
    }

    // Trigger the browser's file download dialog.
    doc.save('analytics-report.pdf')
  }

  // dataReady — true when there is at least one alumni row to export.
  // Disables the export buttons when no data has been loaded yet.
  const dataReady = alumni.length > 0

  // noData — true when loading has finished but nothing was returned.
  // Used to show the "paste your API key" hint message.
  const noData = !loading && !error && alumni.length === 0

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Reports & Exports</h2>
      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        actionLabel={loading ? 'Loading…' : 'Apply Filters'}
        onAction={fetchAll}
        // Use custom clear behavior so report content updates immediately.
        onClear={handleClearFilters}
        actionDisabled={loading}
        programOptions={programOptions}
        industryOptions={industryOptions}
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={exportCsv} disabled={!dataReady}
          className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400">Export CSV</button>
        <button onClick={exportPdf} disabled={!dataReady}
          className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400">Export PDF</button>
      </div>

      {/* Status block — gives the user feedback after clicking Apply Filters */}
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
            No data yet. Paste an API key with <code>read:alumni</code> + <code>read:analytics</code> in the sidebar to load everything automatically, or use the filters above and then refresh with the load button.
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
