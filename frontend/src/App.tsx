import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import axios from 'axios'

// Side-effect import: registers Chart.js components used by every chart card.
import './lib/chartjs'

import { AuthLayout } from './components/AuthLayout'
import { Protected } from './components/Protected'
import { Toast } from './components/Toast'
import { AlumniPage } from './pages/AlumniPage'
import { AuthPage } from './pages/AuthPage'
import { ChartsPage } from './pages/ChartsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ReportsPage } from './pages/ReportsPage'
import { ResetWithTokenPage } from './pages/ResetWithTokenPage'
import { apiBase, getCsrfHeaders } from './lib/api'
import type { SessionUser, ToastState } from './types'

// Keeps the analytics key available across refreshes within the same browser tab.
const analyticsApiKeyStorageKey = 'analytics-dashboard-api-key'

// Composition root — owns global session + apiKey + toast state, then dispatches to pages.
export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem(analyticsApiKeyStorageKey) || ''
  })
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [toast, setToast] = useState<ToastState>(null)

  const showErrorToast = (message: string) => {
    setToast({ message, type: 'error' })
    window.setTimeout(() => setToast(null), 3500)
  }

  // On mount, look up the existing session. If it belongs to an alumnus,
  // log them out — the dashboard is for developer accounts only.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const me = await axios.get(`${apiBase}/api/auth/me`, { withCredentials: true })
        if (me.data.user?.role === 'alumnus') {
          const csrfHeaders = await getCsrfHeaders()
          await axios.post(
            `${apiBase}/api/auth/logout`,
            {},
            { withCredentials: true, headers: csrfHeaders }
          ).catch(() => { })
          setSessionUser(null)
        } else {
          setSessionUser(me.data.user)
        }
      } catch {
        setSessionUser(null)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [])

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

  const handleLogout = async () => {
    try {
      const csrfHeaders = await getCsrfHeaders()
      await axios.post(
        `${apiBase}/api/auth/logout`,
        {},
        { withCredentials: true, headers: csrfHeaders }
      )
      setSessionUser(null)
    } catch {
      showErrorToast('Logout failed')
    }
  }

  if (checkingSession) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Checking session...</div>
  }

  // Wrap every dashboard route in <Protected /> with the right guard props.
  const wrap = (node: React.ReactNode) => (
    <Protected sessionUser={sessionUser} apiKey={apiKey} setApiKey={setApiKey} onLogout={handleLogout}>
      {node}
    </Protected>
  )

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={sessionUser ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={sessionUser ? <Navigate to="/dashboard" replace /> : <AuthLayout><AuthPage mode="login" onLoginSuccess={setSessionUser} onErrorToast={showErrorToast} /></AuthLayout>} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={sessionUser ? <Navigate to="/dashboard" replace /> : <AuthLayout><AuthPage mode="forgot" onErrorToast={showErrorToast} /></AuthLayout>} />
        <Route path="/reset-password/:token" element={sessionUser ? <Navigate to="/dashboard" replace /> : <ResetWithTokenPage onErrorToast={showErrorToast} />} />
        <Route path="/dashboard" element={wrap(<DashboardPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/alumni" element={wrap(<AlumniPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/charts" element={wrap(<ChartsPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="/reports" element={wrap(<ReportsPage apiKey={apiKey} onErrorToast={showErrorToast} />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} />
    </>
  )
}
