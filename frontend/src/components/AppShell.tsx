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
  // Tracks the desktop breakpoint so the same toggle can switch between mobile drawer and compact desktop modes.
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  // Mobile keeps a temporary drawer, while desktop stays mounted and can collapse into a narrow rail.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const [sidebarCompact, setSidebarCompact] = useState(false)

  const sidebarVisible = isDesktop || sidebarOpen
  const navButtonLabel = isDesktop
    ? (sidebarCompact ? 'Expand menu' : 'Compact menu')
    : (sidebarOpen ? 'Hide menu' : 'Show menu')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    // Sync layout state with the breakpoint so resizing between phone/tablet/desktop stays predictable.
    const syncLayout = (matchesDesktop: boolean) => {
      setIsDesktop(matchesDesktop)
      setSidebarOpen(matchesDesktop)
      if (!matchesDesktop) {
        setSidebarCompact(false)
      }
    }

    syncLayout(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      syncLayout(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    // After a mobile navigation, close the drawer so the destination content is immediately visible.
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    setSidebarOpen(false)
  }, [location.pathname])

  const handleSidebarToggle = () => {
    if (isDesktop) {
      setSidebarCompact((compact) => !compact)
      return
    }

    setSidebarOpen((open) => !open)
  }

  const getNavInitials = (label: string) =>
    label
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <div className="flex min-h-screen bg-slate-50 lg:flex-row">
      {sidebarOpen && !isDesktop ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white shadow-xl transition-[width,transform] duration-200 lg:static lg:shadow-none ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'} ${sidebarCompact ? 'w-20 p-3' : 'w-64 p-4'}`}
      >
        <div className={sidebarCompact ? 'space-y-3' : undefined}>
          <h1 className={`font-semibold ${sidebarCompact ? 'text-center text-sm' : 'text-lg'}`}>{sidebarCompact ? 'UA' : 'University Analytics'}</h1>
          {sidebarCompact ? null : <p className="text-xs font-medium text-slate-700">Alumni Bidding</p>}
          {sidebarCompact ? null : <p className="mt-1 text-xs text-slate-500">Signed in as {user.email}</p>}
        </div>
        <nav className="mt-6 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={sidebarCompact ? item.label : undefined}
              aria-label={item.label}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarOpen(false)
                }
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${sidebarCompact ? 'justify-center px-2' : ''} ${location.pathname === item.to
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
                }`}
            >
              {sidebarCompact ? (
                // Initials keep desktop navigation usable when the sidebar is collapsed to a rail.
                <span className="text-xs font-semibold tracking-wide">{getNavInitials(item.label)}</span>
              ) : item.label}
            </Link>
          ))}
          <div className="mt-4 border-t pt-3">
            <button
              onClick={onLogout}
              title={sidebarCompact ? 'Logout' : undefined}
              className={`mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 ${sidebarCompact ? 'px-2 text-center' : ''}`}
            >
              {sidebarCompact ? 'LO' : 'Logout'}
            </button>
          </div>
        </nav>
        <div className="mt-6">
          {sidebarCompact ? (
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-center text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setSidebarCompact(false)}
              title="Expand menu to edit the analytics API key"
            >
              API
            </button>
          ) : (
            <>
              <label className="mb-1 block text-xs font-medium text-slate-600">Analytics API Key</label>
              <textarea
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-28 w-full rounded-md border border-slate-300 p-2 text-xs"
                placeholder="Paste key with read:analytics scope"
              />
            </>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={handleSidebarToggle}
          >
            {navButtonLabel}
          </button>
        </div>
        {children}
      </main>
    </div>
  )
}
