// ─────────────────────────────────────────────────────────────────────────────
// lib/constants.ts — App-wide constant values
//
// Keeping these in one file means changing a label or route path only requires
// editing here — every component that imports these will pick up the change.
// ─────────────────────────────────────────────────────────────────────────────

import type { Filters } from '../types'

// navLinks — the list of sidebar navigation items.
// Each object has:
//   to    → the URL path (matches a <Route path=...> in App.tsx)
//   label → the human-readable text shown in the sidebar
export const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/alumni', label: 'Alumni Explorer' },
  { to: '/charts', label: 'Charts & Trends' },
  { to: '/reports', label: 'Reports' },
]

// emptyFilters — a blank Filters object used to reset the filter form.
// Spread this ({ ...emptyFilters }) whenever you want to wipe all filter fields
// because spreading creates a fresh copy rather than sharing the same reference.
export const emptyFilters: Filters = {
  program: '',
  graduationDate: '',
  industrySector: '',
}
