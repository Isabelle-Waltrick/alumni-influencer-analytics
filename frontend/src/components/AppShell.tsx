// ─────────────────────────────────────────────────────────────────────────────
// components/AppShell.tsx — Main layout: sidebar navigation + content area
//
// Every protected page is wrapped by this component. It renders:
//   • A collapsible sidebar on the left with navigation links, the user's email,
//     a logout button, and a textarea to paste the analytics API key.
//   • A main content area on the right where the current page renders.
//
// Responsive behaviour:
//   • Mobile  (<1024 px): sidebar is hidden by default; a toggle button opens it
//     as an overlay drawer with a dark backdrop.
//   • Desktop (≥1024 px): sidebar is always visible; a toggle button collapses it
//     into a narrow "rail" (just icon initials) to give the content more space.
//
// The sidebar width and visibility are driven by three pieces of state:
//   isDesktop      — whether the viewport is currently desktop-width
//   sidebarOpen    — whether the mobile drawer is open
//   sidebarCompact — whether the desktop sidebar is in narrow/rail mode
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { navLinks } from '../lib/constants'
import type { SessionUser } from '../types'

// Props this component receives from Protected.tsx:
//   children   → the current page content to render in the main area
//   apiKey / setApiKey → the developer's analytics API key (shown in the sidebar textarea)
//   onLogout   → function called when the user clicks the Logout button
//   user       → the logged-in developer (used to display their email)
type Props = {
  children: React.ReactNode
  apiKey: string
  setApiKey: (value: string) => void
  onLogout: () => Promise<void>
  user: SessionUser
}

export const AppShell = ({ children, apiKey, setApiKey, onLogout, user }: Props) => {
  // useLocation() gives us the current URL path. We compare it against each
  // nav link's `to` prop to highlight the active link with a dark background.
  const location = useLocation()

  // isDesktop mirrors window.matchMedia('(min-width: 1024px)') as a React state.
  // We need it as state (not just a CSS class) because it controls which
  // behaviour the toggle button triggers (compact mode vs. drawer open/close).
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  // Mobile keeps a temporary drawer, while desktop stays mounted and can collapse into a narrow rail.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  // sidebarCompact — desktop-only state. When true the sidebar shrinks to a
  // narrow 80 px rail showing only two-letter abbreviations of each nav label.
  const [sidebarCompact, setSidebarCompact] = useState(false)

  // derived values — computed from state so the JSX doesn't need inline logic
  const sidebarVisible = isDesktop || sidebarOpen  // Should the sidebar be visible at all?
  const navButtonLabel = isDesktop
    ? (sidebarCompact ? 'Expand menu' : 'Compact menu')  // Desktop: describes the toggle action
    : (sidebarOpen ? 'Hide menu' : 'Show menu')           // Mobile: describes the drawer action

  // useEffect — listens to the (min-width: 1024px) media query.
  // Whenever the window is resized across this breakpoint we sync the layout state
  // so the correct sidebar mode activates without needing a page refresh.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    // Sync layout state with the breakpoint so resizing between phone/tablet/desktop stays predictable.
    const syncLayout = (matchesDesktop: boolean) => {
      setIsDesktop(matchesDesktop)
      setSidebarOpen(matchesDesktop)  // Auto-open on desktop, auto-close on mobile
      if (!matchesDesktop) {
        setSidebarCompact(false)  // Compact mode only makes sense on desktop, reset it
      }
    }

    syncLayout(mediaQuery.matches)  // Run once immediately to match the current window size

    const handleChange = (event: MediaQueryListEvent) => {
      syncLayout(event.matches)  // Re-run whenever the breakpoint is crossed
    }

    mediaQuery.addEventListener('change', handleChange)
    // Clean up: remove the listener when the component unmounts to avoid memory leaks
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // useEffect — closes the mobile drawer whenever the user navigates to a different page.
  // Without this, the drawer would stay open over the new page's content.
  useEffect(() => {
    // After a mobile navigation, close the drawer so the destination content is immediately visible.
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    setSidebarOpen(false)
  }, [location.pathname])  // Re-runs every time the URL path changes

  // handleSidebarToggle — the single toggle button at the top of the content
  // area behaves differently depending on whether we are on desktop or mobile:
  //   Desktop: toggles compact/expanded mode (the sidebar stays visible)
  //   Mobile:  toggles the drawer open/closed
  const handleSidebarToggle = () => {
    if (isDesktop) {
      setSidebarCompact((compact) => !compact)
      return
    }

    setSidebarOpen((open) => !open)
  }

  // getNavInitials — generates a 1–2 letter abbreviation from a nav label.
  // Used to label the buttons in compact desktop mode, e.g.
  //   "Alumni Explorer" → "AE"
  //   "Dashboard" → "D"
  const getNavInitials = (label: string) =>
    label
      .split(/\s+/)           // Split on whitespace to get individual words
      .map((part) => part[0]) // Take the first letter of each word
      .join('')
      .slice(0, 2)            // Keep at most 2 characters
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
          {sidebarCompact ? null : <p className="text-xs font-medium text-slate-700">Alumni Analytics</p>}
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
