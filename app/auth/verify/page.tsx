'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState('Calling your phone with a code…')

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const placeCall = async () => {
    setSending(true); setError(null)
    try {
      const res = await fetch('/api/auth/2fa/send', { method: 'POST', headers: { Authorization: `Bearer ${await token()}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not place the call')
      setInfo('We just called your phone. Enter the 4-digit code you heard.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); setInfo('') }
    finally { setSending(false) }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/auth/login'); return }
      placeCall()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setVerifying(true); setError(null)
    try {
      const res = await fetch('/api/auth/2fa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ code }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Wrong code')
      router.replace('/admin')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') }
    finally { setVerifying(false) }
  }

  const cancel = async () => { await supabase.auth.signOut(); router.replace('/auth/login') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-4xl mb-3">📞</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify it&apos;s you</h1>
        <p className="text-gray-500 text-sm mb-6">{sending ? 'Calling your phone…' : info}</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={verify} className="space-y-4">
          <input type="text" inputMode="numeric" maxLength={4} autoFocus placeholder="4-digit code"
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" disabled={verifying || code.length < 4}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {verifying ? 'Verifying…' : 'Verify & sign in'}
          </button>
        </form>
        <div className="flex justify-between mt-4 text-sm">
          <button onClick={placeCall} disabled={sending} className="text-indigo-600 hover:underline disabled:opacity-50">Call again</button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    </div>
  )
}
