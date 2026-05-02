import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiBase, getApiErrorMessage, getCsrfHeaders } from '../lib/api'
import type { SessionUser } from '../types'

type Props = {
  mode: 'login' | 'register' | 'forgot'
  onLoginSuccess?: (user: SessionUser) => void
  onErrorToast: (message: string) => void
}

export const AuthPage = ({ mode, onLoginSuccess, onErrorToast }: Props) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const submit = async () => {
    try {
      const csrfHeaders = await getCsrfHeaders()
      if (mode === 'login') {
        await axios.post(
          `${apiBase}/api/auth/login`,
          { email, password },
          { withCredentials: true, headers: csrfHeaders }
        )
        const me = await axios.get(`${apiBase}/api/auth/me`, { withCredentials: true })
        if (me.data.user?.role === 'alumnus') {
          await axios.post(
            `${apiBase}/api/auth/logout`,
            {},
            { withCredentials: true, headers: csrfHeaders }
          ).catch(() => {})
          throw new Error('This account is not permitted on the analytics dashboard. Use http://localhost:3000 for alumni profile and bidding.')
        }
        onLoginSuccess?.(me.data.user)
        navigate('/dashboard')
      } else if (mode === 'register') {
        await axios.post(
          `${apiBase}/api/auth/register`,
          { email, password, role: 'developer' },
          { withCredentials: true, headers: csrfHeaders }
        )
        setMessage('Registered. Verify email from inbox.')
      } else if (mode === 'forgot') {
        await axios.post(
          `${apiBase}/api/auth/forgot-password`,
          { email },
          { withCredentials: true, headers: csrfHeaders }
        )
        setMessage('If account exists, a reset email has been sent.')
      }
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Request failed')
      setMessage(msg)
      onErrorToast(msg)
    }
  }

  return (
    <section className="w-full max-w-md rounded-lg border bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">{mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : 'Reset Password'}</h2>
      <div className="space-y-3">
        <input className="w-full rounded border p-2 text-sm" placeholder="University email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'forgot' && (
          <input type="password" className="w-full rounded border p-2 text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        <button onClick={submit} className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white">Submit</button>
      </div>
      <div className="mt-4 flex gap-3 text-xs text-slate-600">
        {mode !== 'login' && <Link to="/login" className="hover:underline">Go to login</Link>}
        {mode !== 'register' && <Link to="/register" className="hover:underline">Create account</Link>}
        {mode !== 'forgot' && <Link to="/forgot-password" className="hover:underline">Forgot password</Link>}
      </div>
      {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
    </section>
  )
}
