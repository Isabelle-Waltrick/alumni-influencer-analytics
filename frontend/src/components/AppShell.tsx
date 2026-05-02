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
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold">University Analytics</h1>
        <p className="text-xs font-medium text-slate-700">Alumni Bidding</p>
        <p className="mt-1 text-xs text-slate-500">Signed in as {user.email}</p>
        <nav className="mt-6 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block rounded-md px-3 py-2 text-sm ${
                location.pathname === item.to
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
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
