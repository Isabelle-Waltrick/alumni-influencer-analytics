import { Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'
import type { SessionUser } from '../types'

type Props = {
  children: React.ReactNode
  sessionUser: SessionUser | null
  apiKey: string
  setApiKey: (value: string) => void
  onLogout: () => Promise<void>
}

// Defense-in-depth route guard:
//   - if no session OR session is alumnus → redirect to /login
//   - otherwise → render the dashboard chrome around the children
export const Protected = ({ children, sessionUser, apiKey, setApiKey, onLogout }: Props) =>
  sessionUser && sessionUser.role !== 'alumnus' ? (
    <AppShell apiKey={apiKey} setApiKey={setApiKey} onLogout={onLogout} user={sessionUser}>
      {children}
    </AppShell>
  ) : (
    <Navigate to="/login" replace />
  )
