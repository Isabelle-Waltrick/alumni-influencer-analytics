// ─────────────────────────────────────────────────────────────────────────────
// pages/ResetWithTokenPage.tsx — Password reset form (token from email link)
//
// The flow is:
//   1. User requests a reset on the Forgot Password page.
//   2. Backend sends an email with a link like /reset-password/abc123token.
//   3. React Router matches that URL and renders THIS component.
//   4. useParams() extracts the token from the URL.
//   5. User types a new password and clicks "Reset Password".
//   6. We POST the token + new password to the backend.
//   7. On success, we show a confirmation message and the user can login.
//
// This page is intentionally kept very simple — it is wrapped in AuthLayout
// to give it the same centred card appearance as the login page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'  // useParams reads the :token segment from the URL
import axios from 'axios'
import { AuthLayout } from '../components/AuthLayout'  // Centred card wrapper
import { apiBase, getApiErrorMessage, getCsrfHeaders } from '../lib/api'

type Props = { onErrorToast: (message: string) => void }

export const ResetWithTokenPage = ({ onErrorToast }: Props) => {
  // useParams reads the URL — if the URL is /reset-password/abc123, then token = 'abc123'
  const { token = '' } = useParams()
  const [password, setPassword] = useState('')  // The new password the user types
  const [message, setMessage] = useState('')    // Confirmation or error message shown after submit

  // submit — sends the reset token and the new password to the backend.
  // The backend validates the token (checks it hasn't expired) and updates the password.
  const submit = async () => {
    try {
      const csrfHeaders = await getCsrfHeaders()  // CSRF protection for the POST
      await axios.post(
        `${apiBase}/api/auth/reset-password/${token}`,  // Token is embedded in the URL path
        { password },                                    // New password in the request body
        { withCredentials: true, headers: csrfHeaders }
      )
      setMessage('Password reset successful. You can now login.')
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Reset failed')
      setMessage(msg)
      onErrorToast(msg)
    }
  }

  return (
    // AuthLayout centres the card vertically and horizontally with the site branding
    <AuthLayout>
      <section className="w-full max-w-md rounded-lg border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Set New Password</h2>
        <input
          type="password"
          className="w-full rounded border p-2 text-sm"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={submit} className="mt-3 w-full rounded bg-slate-900 px-3 py-2 text-sm text-white">Reset Password</button>
        <div className="mt-3 text-xs"><Link to="/login" className="hover:underline">Back to login</Link></div>
        {/* Show the result message (success or error) after the user clicks the button */}
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>
    </AuthLayout>
  )
}
