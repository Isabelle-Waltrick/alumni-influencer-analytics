// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — Root component and global state manager
//
// This is the "brain" of the whole frontend. It:
//   1. Holds global state: who is logged in (sessionUser), the API key, and
//      whether a toast (error popup) should be visible.
//   2. Checks on startup whether the user already has a valid session cookie
//      from a previous login.
//   3. Defines all the URL routes and decides which page component to show.
//   4. Passes the session user and API key down to every protected page.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'  // Routing primitives from react-router-dom
import axios from 'axios'  // HTTP client used to talk to the backend API

// Importing this file runs ChartJS.register() as a side-effect.
// It must happen before any chart component is rendered for the first time.
import './lib/chartjs'

import { AuthLayout } from './components/AuthLayout'  // Centred card wrapper for login/forgot pages
import { Protected } from './components/Protected'    // Route guard that redirects non-developers to /login
import { Toast } from './components/Toast'            // Floating error notification
import { AlumniPage } from './pages/AlumniPage'        // "Alumni Explorer" page
import { AuthPage } from './pages/AuthPage'            // Shared login / forgot-password page
import { ChartsPage } from './pages/ChartsPage'        // Charts & Trends page
import { DashboardPage } from './pages/DashboardPage'  // Dashboard KPI summary page
import { ReportsPage } from './pages/ReportsPage'      // Reports & Exports page
import { ResetWithTokenPage } from './pages/ResetWithTokenPage'  // Password reset (token from email)
import { apiBase, getCsrfHeaders } from './lib/api'
import type { SessionUser, ToastState } from './types'

// The key used to persist the API key in sessionStorage.
// sessionStorage is cleared when the browser tab is closed, which is safer
// than localStorage for a sensitive key.
const analyticsApiKeyStorageKey = 'analytics-dashboard-api-key'

// App is the root component. Everything else lives inside it.
export default function App() {
  // apiKey — the developer's analytics API key, read from sessionStorage on first render
  // so it survives page refreshes within the same browser tab.
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem(analyticsApiKeyStorageKey) || ''
  })

  // sessionUser — the currently logged-in user, or null if not logged in.
  // Set after a successful login or confirmed by the /api/auth/me check on load.
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)

  // checkingSession — true while we are still asking the backend "is there a valid
  // session cookie?" We show a loading message during this period so the page
  // doesn't flash a login redirect before confirming the user is already logged in.
  const [checkingSession, setCheckingSession] = useState(true)

  // toast — controls the floating error notification (null = hidden).
  const [toast, setToast] = useState<ToastState>(null)

  // Show a red toast notification for 3.5 seconds, then hide it automatically.
  const showErrorToast = (message: string) => {
    setToast({ message, type: 'error' })
    window.setTimeout(() => setToast(null), 3500)
  }

  // useEffect with [] runs ONCE, right after the component first mounts.
  // We ask the backend "is there an active session?" using the /api/auth/me endpoint.
  // The browser automatically sends the session cookie (withCredentials is set in axios defaults).
  // → If the user is a developer: store them in sessionUser so protected pages open.
  // → If the user is an alumnus: immediately log them out — alumni cannot use this dashboard.
  // → If the request fails (no cookie / expired): sessionUser stays null → /login.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const me = await axios.get(`${apiBase}/api/auth/me`, { withCredentials: true })
        if (me.data.user?.role === 'alumnus') {
          // Alumni accounts are not allowed here — silently log them out.
          const csrfHeaders = await getCsrfHeaders()
          await axios.post(
            `${apiBase}/api/auth/logout`,
            {},
            { withCredentials: true, headers: csrfHeaders }
          ).catch(() => { })
          setSessionUser(null)
        } else {
          setSessionUser(me.data.user)  // Valid developer session — set the user
        }
      } catch {
        setSessionUser(null)  // Request failed — treat as not logged in
      } finally {
        setCheckingSession(false)  // Always stop showing the loading screen
      }
    }
    checkSession()
  }, [])

  // useEffect that runs whenever apiKey changes.
  // We keep the API key in sessionStorage so it survives page refreshes.
  // If the user clears the key, we remove it from storage so stale keys don't persist.
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Persist the trimmed key so protected pages can auto-load after refresh/navigation.
    const normalizedApiKey = apiKey.trim()
    if (normalizedApiKey) {
      window.sessionStorage.setItem(analyticsApiKeyStorageKey, normalizedApiKey)
      return
    }

    window.sessionStorage.removeItem(analyticsApiKeyStorageKey)
  }, [apiKey])

  // handleLogout — calls the backend logout endpoint to clear the session cookie,
  // then clears the local sessionUser so the UI immediately reflects "logged out".
  const handleLogout = async () => {
    try {
      const csrfHeaders = await getCsrfHeaders()  // Fetch a CSRF token to authorise the POST
      await axios.post(
        `${apiBase}/api/auth/logout`,
        {},
        { withCredentials: true, headers: csrfHeaders }  // withCredentials sends the session cookie
      )
      setSessionUser(null)  // Clear the user so Protected routes redirect to /login
    } catch {
      showErrorToast('Logout failed')
    }
  }

  // While we are still verifying the session, show a neutral loading screen.
  // This prevents a flash of the login page for users who are already signed in.
  if (checkingSession) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Checking session...</div>
  }

  // wrap() is a shorthand that puts any page component inside <Protected />,
  // which checks the login state and either shows the page or redirects to /login.
  const wrap = (node: React.ReactNode) => (
    <Protected sessionUser={sessionUser} apiKey={apiKey} setApiKey={setApiKey} onLogout={handleLogout}>
      {node}
    </Protected>
  )

  return (
    <>
      {/* Routes — react-router renders whichever <Route> matches the current URL.
          Only one route renders at a time. If no route matches, the wildcard (*)
          redirects back to "/" which then bounces to /login or /dashboard. */}
      <Routes>
        {/* Root path: redirect logged-in users to the dashboard, others to login */}
        <Route path="/" element={<Navigate to={sessionUser ? '/dashboard' : '/login'} replace />} />

        {/* Login: if already logged in, skip to dashboard; otherwise show the login form */}
        <Route path="/login" element={sessionUser ? <Navigate to="/dashboard" replace /> : <AuthLayout><AuthPage mode="login" onLoginSuccess={setSessionUser} onErrorToast={showErrorToast} /></AuthLayout>} />

        {/* Registration happens on the backend EJS view, so redirect anyone who hits /register */}
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Forgot password: only shown to guests (logged-in users go to dashboard) */}
        <Route path="/forgot-password" element={sessionUser ? <Navigate to="/dashboard" replace /> : <AuthLayout><AuthPage mode="forgot" onErrorToast={showErrorToast} /></AuthLayout>} />

        {/* Password reset: the :token segment comes from the link emailed to the user */}
        <Route path="/reset-password/:token" element={sessionUser ? <Navigate to="/dashboard" replace /> : <ResetWithTokenPage onErrorToast={showErrorToast} />} />

        {/* Protected pages: each uses wrap() which verifies the user is a developer */}
        <Route path="/dashboard" element={wrap(<DashboardPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/alumni" element={wrap(<AlumniPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/charts" element={wrap(<ChartsPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/reports" element={wrap(<ReportsPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />

        {/* Catch-all: any unknown URL goes back to the root redirect above */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast sits outside Routes so it can render over any page */}
      <Toast toast={toast} />
    </>
  )
}
