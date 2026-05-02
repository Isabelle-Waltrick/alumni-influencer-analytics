import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { AuthLayout } from '../components/AuthLayout'
import { apiBase, getApiErrorMessage } from '../lib/api'

type Props = { onErrorToast: (message: string) => void }

export const VerifyEmailPage = ({ onErrorToast }: Props) => {
  const { token = '' } = useParams()
  const [message, setMessage] = useState('Verifying...')

  useEffect(() => {
    const run = async () => {
      try {
        await axios.get(`${apiBase}/api/auth/verify-email/${token}`)
        setMessage('Email verified successfully. You can now login.')
      } catch (err: any) {
        const msg = getApiErrorMessage(err, 'Verification failed')
        setMessage(msg)
        onErrorToast(msg)
      }
    }
    run()
  }, [token])

  return (
    <AuthLayout>
      <section className="w-full max-w-md rounded-lg border bg-white p-5">
        <h2 className="mb-2 text-lg font-semibold">Email Verification</h2>
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-3 text-xs"><Link to="/login" className="hover:underline">Go to login</Link></div>
      </section>
    </AuthLayout>
  )
}
