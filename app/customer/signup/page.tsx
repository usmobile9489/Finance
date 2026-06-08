'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CustomerSignup() {
  const [stage, setStage] = useState<1 | 2 | 3>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null)
    try {
      const res = await fetch('/api/customer/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setStage(2)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setLoading(false) }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null)
    try {
      const res = await fetch('/api/customer/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code, email, password, pin }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setStage(3)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Customer Sign Up</h1>
        <p className="text-gray-500 text-sm mb-6">View your invoices &amp; balance.</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        {stage === 1 && (
          <form onSubmit={requestCode} className="space-y-4">
            <p className="text-sm text-gray-600">Enter the phone number the business has on file. We&apos;ll <b>call you</b> with a 4-digit code.</p>
            <input type="tel" required placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button disabled={loading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Calling…' : 'Call me with a code'}
            </button>
          </form>
        )}

        {stage === 2 && (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-gray-600">We just called <b>{phone}</b>. Enter the code you heard, then create your login.</p>
            <input type="text" required placeholder="4-digit code" value={code} onChange={e => setCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="password" required placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="text" inputMode="numeric" maxLength={4} placeholder="Optional 4-digit phone PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="text-xs text-gray-400">The PIN lets you call in and hear your balance by phone. Leave blank to skip.</p>
            <button disabled={loading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Verifying…' : 'Create my account'}
            </button>
            <button type="button" onClick={() => setStage(1)} className="w-full text-gray-500 text-sm">← back</button>
          </form>
        )}

        {stage === 3 && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Account created!</h2>
            <Link href="/customer/login" className="inline-block mt-3 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700">Sign in</Link>
          </div>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">Already have an account? <Link href="/customer/login" className="text-indigo-600 font-semibold hover:underline">Sign in</Link></p>
      </div>
    </div>
  )
}
