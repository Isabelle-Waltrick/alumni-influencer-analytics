export type Filters = {
  program: string
  graduationDate: string
  industrySector: string
}

export type Summary = {
  totalAlumniTracked: number
  employmentRate: number
  avgCertificationsPerAlumnus: number
}

export type SessionUser = { email: string; role: 'alumnus' | 'developer' }
export type ToastState = { message: string; type: 'error' } | null

export type ChartItem = { label: string; value: number }
export type SkillsItem = { label: string; percentage: number; severity: string }

export type ChartsResponse = {
  skillsGap: SkillsItem[]
  certificationTrend: Array<{ year: string; value: number }>
  certificationTrendSeries: Array<{ certification: string; year: string; value: number }>
  alumniTotalsByYear: Record<string, number>
  employmentByIndustry: ChartItem[]
  commonJobTitles: ChartItem[]
  topEmployers: ChartItem[]
  topCourseProviders: ChartItem[]
  geographicDistribution: ChartItem[]
}

export type AlumniRow = {
  _id: string
  firstName: string
  lastName: string
  linkedInUrl: string
  programs: string[]
  graduationDateDisplay: string
  graduationDateLines: string[]
  latestJobTitle: string
  latestCompany: string
  latestIndustry: string
  certifications: string[]
  topCertification: string
  certificationsCount: number
  coursesCount: number
  degreesCount: number
}
