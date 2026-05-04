// ─────────────────────────────────────────────────────────────────────────────
// pages/AuthPage.tsx — Shared Login and Forgot Password form
//
// One component serves two purposes, controlled by the "mode" prop:
//   mode='login'  → shows email + password fields, a "Sign In" button,
//                    and a "Forgot password" link
//   mode='forgot' → shows only the email field and a "Send Reset Link" button
//
// On successful login:
//   1. Checks the returned user role — if alumnus, immediately logs them out
//      (alumni belong on the backend EJS site, not this React dashboard)
//   2. Calls onLoginSuccess() so App.tsx updates its sessionUser state
//   3. Navigates to /dashboard
//
// Registration is intentionally NOT available here — it is done through the
// backend EJS view at http://localhost:3000/register.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiBase, getApiErrorMessage, getCsrfHeaders } from '../lib/api'
import type { SessionUser } from '../types'

// Props:
//   mode           → controls which form fields and button text to show
//   onLoginSuccess → called with the user object after a successful login
//   onErrorToast   → shows the floating red error notification
type Props = {
  mode: 'login' | 'forgot'
  onLoginSuccess?: (user: SessionUser) => void
  onErrorToast: (message: string) => void
}

export const AuthPage = ({ mode, onLoginSuccess, onErrorToast }: Props) => {
  const [email, setEmail] = useState('')      // Controlled input for the email field
  const [password, setPassword] = useState('')  // Controlled input for the password field
  const [message, setMessage] = useState('')  // Status message shown below the form (errors or success)
  const navigate = useNavigate()              // Programmatic navigation (used after login success)

  // submit — handles both login and forgot-password in one function.
  // The mode prop determines which API endpoint to call.
  const submit = async () => {
    try {
      // Get a CSRF token before any state-changing POST request
      const csrfHeaders = await getCsrfHeaders()

      if (mode === 'login') {
        // Step 1: Send credentials to the login endpoint.
        // The server sets a session cookie in the response if credentials are valid.
        await axios.post(
          `${apiBase}/api/auth/login`,
          { email, password },
          { withCredentials: true, headers: csrfHeaders }  // withCredentials sends/receives cookies
        )

        // Step 2: Fetch the user details to confirm who just logged in.
        const me = await axios.get(`${apiBase}/api/auth/me`, { withCredentials: true })

        // Step 3: If an alumnus somehow logs in here, boot them out.
        // This dashboard is only for developer accounts.
        if (me.data.user?.role === 'alumnus') {
          await axios.post(
            `${apiBase}/api/auth/logout`,
            {},
            { withCredentials: true, headers: csrfHeaders }
          ).catch(() => { })  // Swallow the error — we're logging them out regardless
          throw new Error('This account is not permitted on the analytics dashboard. Use http://localhost:3000 for alumni profile and bidding.')
        }

        onLoginSuccess?.(me.data.user)  // Tell App.tsx the session is now active
        navigate('/dashboard')           // Redirect to the main dashboard

      } else if (mode === 'forgot') {
        // Send only the email — the backend generates a reset link and emails it.
        await axios.post(
          `${apiBase}/api/auth/forgot-password`,
          { email },
          { withCredentials: true, headers: csrfHeaders }
        )
        // Vague success message to avoid revealing whether the email exists (security best practice)
        setMessage('If account exists, a reset email has been sent.')
      }
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Request failed')
      setMessage(msg)    // Show the error below the form
      onErrorToast(msg)  // Also show the floating toast notification
    }
  }

  return (
    <section className="w-full max-w-md rounded-lg border bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">{mode === 'login' ? 'Login' : 'Reset Password'}</h2>
      <div className="space-y-3">
        <input className="w-full rounded border p-2 text-sm" placeholder="University email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'forgot' && (
          <input type="password" className="w-full rounded border p-2 text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        <button onClick={submit} className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white">{mode === 'login' ? 'Sign In' : 'Send Reset Link'}</button>
      </div>
      <div className="mt-4 flex gap-3 text-xs text-slate-600">
        {mode !== 'login' && <Link to="/login" className="hover:underline">Go to login</Link>}
        {mode !== 'forgot' && <Link to="/forgot-password" className="hover:underline">Forgot password</Link>}
      </div>
      {mode === 'login' && (
        <p className="mt-3 text-xs text-slate-600">
          Registration is available only on{' '}
          <a className="text-blue-700 hover:underline" href="http://localhost:3000/register" target="_blank" rel="noreferrer">
            http://localhost:3000/register
          </a>
          .
        </p>
      )}
      {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
    </section>
  )
}
