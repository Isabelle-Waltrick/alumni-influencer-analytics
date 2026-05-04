// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts — Shared TypeScript type definitions
//
// TypeScript types describe the "shape" of data — i.e. what fields an object
// has and what types those fields are. Centralising them here means every file
// imports from one place, so if the API response changes we only update it once.
// ─────────────────────────────────────────────────────────────────────────────

// Filters — the three search fields the user can fill in on any page.
// All fields are strings because they come directly from form inputs.
export type Filters = {
  program: string          // Degree programme name (e.g. "BSc Computer Science")
  graduationDate: string   // ISO date string picked from the date input
  industrySector: string   // Industry the alumni works in (e.g. "Technology & IT")
}

// Summary — the three headline KPI numbers shown on the Dashboard page.
// These come from the /api/analytics/summary endpoint.
export type Summary = {
  totalAlumniTracked: number              // How many alumni records are in the database
  employmentRate: number                  // Percentage currently employed (0-100)
  avgCertificationsPerAlumnus: number     // Mean number of certs per person
}

// SessionUser — the logged-in user returned by /api/auth/me.
// We only need the email (for display) and the role (to guard routes).
export type SessionUser = { email: string; role: 'alumnus' | 'developer' }

// ToastState — drives the floating error notification at the top-right.
// null means "no toast visible right now".
export type ToastState = { message: string; type: 'error' } | null

// ChartItem — a generic label+count pair used by most chart endpoints.
// e.g. { label: "Google", value: 12 } for Top Employers.
export type ChartItem = { label: string; value: number }

// SkillsItem — used specifically for the Skills Gap bar chart.
// Includes a pre-calculated percentage and a human-readable severity band.
export type SkillsItem = { label: string; percentage: number; severity: string }

// ChartsResponse — the complete payload returned by /api/analytics/charts.
// Each field maps to one of the charts on the Charts & Trends page.
export type ChartsResponse = {
  skillsGap: SkillsItem[]                                                       // Bar chart: cert adoption gaps
  certificationTrend: Array<{ year: string; value: number }>                    // Total certs earned per year
  certificationTrendSeries: Array<{ certification: string; year: string; value: number }> // Per-cert breakdown per year
  alumniTotalsByYear: Record<string, number>                                    // Total alumni graduated per year (used to convert counts → %)
  employmentByIndustry: ChartItem[]                                             // Pie chart: industry sectors
  commonJobTitles: ChartItem[]                                                  // Doughnut chart: job roles
  topEmployers: ChartItem[]                                                     // Horizontal bar: employers
  topCourseProviders: ChartItem[]                                               // Course providers (reserved)
  geographicDistribution: ChartItem[]                                           // Radar chart: regions
}

// AlumniRow — a single alumni record returned by /api/analytics/alumni.
// Each row appears as one entry in the Alumni Explorer table.
export type AlumniRow = {
  _id: string                      // MongoDB document ID (unique identifier)
  firstName: string
  lastName: string
  linkedInUrl: string              // LinkedIn profile URL (may be empty)
  programs: string[]               // List of degree programmes this person completed
  graduationDateDisplay: string    // Human-readable graduation date string for display
  graduationDateLines: string[]    // Multi-line graduation dates (one per degree)
  latestJobTitle: string           // Most recent job title from their employment history
  latestCompany: string            // Most recent employer name
  latestIndustry: string           // Industry of most recent employer
  certifications: string[]         // All certifications held by this person
  topCertification: string         // Their most notable / recent certification
  certificationsCount: number      // Total number of certifications
  coursesCount: number             // Total number of courses completed
  degreesCount: number             // Total number of degrees awarded
}
