'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function MisterAbstractLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="12" fill="#0A2342"/>
      <path d="M18 75 L18 30 L35 30 L50 58 L65 30 L82 30 L82 75 L70 75 L70 50 L55 75 L45 75 L30 50 L30 75 Z" fill="#C9A84C"/>
      <path d="M20 82 L80 82" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

export default function VacationLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); return }

      // Fetch role and redirect accordingly
      const { data: profile } = await supabase
        .from('vacation_profiles')
        .select('role')
        .single()

      if (!profile) {
        setError('Your account has not been configured. Contact your administrator.')
        await supabase.auth.signOut()
        return
      }

      if (profile.role === 'admin') router.push('/vacation/admin')
      else if (profile.role === 'manager') router.push('/vacation/manager')
      else router.push('/vacation/employee')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0A2342 0%, #1a3a5c 60%, #0A2342 100%)' }}>
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center px-16 text-white">
        <MisterAbstractLogo size={90} />
        <h1 className="mt-6 text-4xl font-bold tracking-tight" style={{ color: '#C9A84C' }}>
          Mister Abstract
        </h1>
        <p className="mt-3 text-lg text-blue-200 text-center max-w-xs">
          Employee Vacation &amp; Time-Off Management
        </p>
        <div className="mt-12 grid grid-cols-1 gap-4 w-full max-w-xs">
          {[
            { icon: '📅', text: 'Jewish Calendar Integration' },
            { icon: '⚖️', text: 'Automatic Day &amp; Hour Calculation' },
            { icon: '✅', text: 'Manager Approval Workflow' },
            { icon: '🛡️', text: 'Role-Based Access Control' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm text-blue-100" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <MisterAbstractLogo size={44} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0A2342' }}>Mister Abstract</h1>
              <p className="text-xs text-gray-500">Vacation Scheduler</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#0A2342' }}>Sign In</h2>
          <p className="text-gray-500 text-sm mb-8">Enter your company email and password</p>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@misterabstract.com"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': '#0A2342' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#0A2342' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            New to the platform?{' '}
            <Link href="/vacation/signup" className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
