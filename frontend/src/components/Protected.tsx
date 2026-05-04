// ─────────────────────────────────────────────────────────────────────────────
// components/Protected.tsx — Authentication and role guard for dashboard routes
//
// Wraps every protected page (Dashboard, Alumni Explorer, Charts, Reports).
// Before rendering the page content, it checks two things:
//   1. Is there a logged-in user at all? (sessionUser is not null)
//   2. Is that user a developer (not an alumnus)?
//
// If BOTH checks pass → render the page inside the app's navigation shell.
// If EITHER check fails → redirect to /login without showing the page.
//
// This is the last line of defence on the frontend — the backend also checks
// the session cookie on every API request, so even if someone bypassed this
// component they still could not fetch any data.
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'   // The sidebar + main content layout frame
import type { SessionUser } from '../types'

// Props passed from App.tsx when using wrap():
//   children   → the actual page component to render if the check passes
//   sessionUser → the logged-in user object (null = not logged in)
//   apiKey / setApiKey → passed down to AppShell for the sidebar API key field
//   onLogout   → function to call when the user clicks Logout
type Props = {
  children: React.ReactNode
  sessionUser: SessionUser | null
  apiKey: string
  setApiKey: (value: string) => void
  onLogout: () => Promise<void>
}

// This is a ternary (if/else) expressed as JSX:
//   condition ? <show this if true> : <show this if false>
//
// condition: user exists AND is not an alumnus
// true  → render the page wrapped in the AppShell navigation chrome
// false → redirect to /login (replace=true means the login page replaces this
//          in the browser history, so pressing Back doesn't loop back)
export const Protected = ({ children, sessionUser, apiKey, setApiKey, onLogout }: Props) =>
  sessionUser && sessionUser.role !== 'alumnus' ? (
    <AppShell apiKey={apiKey} setApiKey={setApiKey} onLogout={onLogout} user={sessionUser}>
      {children}
    </AppShell>
  ) : (
    <Navigate to="/login" replace />
  )
