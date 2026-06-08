'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/customer')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Customer Sign In</h1>
        <p className="text-gray-500 text-sm mb-6">View your invoices &amp; balance.</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={login} className="space-y-4">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button disabled={loading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-gray-500 text-sm mt-6">New here? <Link href="/customer/signup" className="text-indigo-600 font-semibold hover:underline">Create an account</Link></p>
      </div>
    </div>
  )
}
