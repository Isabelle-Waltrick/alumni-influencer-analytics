import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { AuthLayout } from '../components/AuthLayout'
import { apiBase, getApiErrorMessage, getCsrfHeaders } from '../lib/api'

type Props = { onErrorToast: (message: string) => void }

export const ResetWithTokenPage = ({ onErrorToast }: Props) => {
  const { token = '' } = useParams()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const submit = async () => {
    try {
      const csrfHeaders = await getCsrfHeaders()
      await axios.post(
        `${apiBase}/api/auth/reset-password/${token}`,
        { password },
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
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>
    </AuthLayout>
  )
}
