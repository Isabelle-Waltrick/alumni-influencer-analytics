import type { Filters } from '../types'

export const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/alumni', label: 'Alumni Explorer' },
  { to: '/charts', label: 'Charts & Trends' },
  { to: '/reports', label: 'Reports' },
]

export const emptyFilters: Filters = {
  certification: '',
  company: '',
  jobTitle: '',
  certYearFrom: '',
  certYearTo: '',
}
