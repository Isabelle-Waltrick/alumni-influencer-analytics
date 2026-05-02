export type Filters = {
  certification: string
  company: string
  jobTitle: string
  certYearFrom: string
  certYearTo: string
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
  topIssuingBodies: ChartItem[]
  commonJobTitles: ChartItem[]
  topEmployers: ChartItem[]
  topCourseProviders: ChartItem[]
  topDegreeInstitutions: ChartItem[]
}

export type AlumniRow = {
  _id: string
  firstName: string
  lastName: string
  linkedInUrl: string
  latestJobTitle: string
  latestCompany: string
  topCertification: string
  certificationsCount: number
  coursesCount: number
  degreesCount: number
}
