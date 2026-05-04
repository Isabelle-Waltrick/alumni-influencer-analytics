import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { navLinks } from '../lib/constants'
import type { SessionUser } from '../types'

type Props = {
  children: React.ReactNode
  apiKey: string
  setApiKey: (value: string) => void
  onLogout: () => Promise<void>
  user: SessionUser
}

export const AppShell = ({ children, apiKey, setApiKey, onLogout, user }: Props) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 1024)

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-slate-50 lg:flex-row">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 lg:static lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:-translate-x-0 lg:overflow-hidden lg:border-r-0 lg:p-0'
          }`}
      >
        <h1 className="text-lg font-semibold">University Analytics</h1>
        <p className="text-xs font-medium text-slate-700">Alumni Bidding</p>
        <p className="mt-1 text-xs text-slate-500">Signed in as {user.email}</p>
        <nav className="mt-6 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarOpen(false)
                }
              }}
              className={`block rounded-md px-3 py-2 text-sm ${location.pathname === item.to
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
                }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-4 border-t pt-3">
            <button
              onClick={onLogout}
              className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </nav>
        <div className="mt-6">
          <label className="mb-1 block text-xs font-medium text-slate-600">Analytics API Key</label>
          <textarea
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-28 w-full rounded-md border border-slate-300 p-2 text-xs"
            placeholder="Paste key with read:analytics scope"
          />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? 'Hide menu' : 'Show menu'}
          </button>
        </div>
        {children}
      </main>
    </div>
  )
}
