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

export default function VacationSignupPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Check if email is pre-authorized
      const { data: allowed, error: allowedErr } = await supabase
        .from('vacation_allowed_emails')
        .select('role, vacation_days_allowed, full_name')
        .eq('email', email.toLowerCase())
        .single()

      if (allowedErr || !allowed) {
        setError('This email is not authorized to create an account. Contact your administrator.')
        return
      }

      // Sign up with Supabase Auth
      const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password })
      if (signupError) { setError(signupError.message); return }
      if (!signupData.user) { setError('Signup failed. Please try again.'); return }

      // Create vacation_profile
      const { error: profileError } = await supabase.from('vacation_profiles').insert({
        id: signupData.user.id,
        email: email.toLowerCase(),
        full_name: fullName || allowed.full_name,
        role: allowed.role,
        vacation_days_allowed: allowed.vacation_days_allowed,
      })

      if (profileError) { setError('Profile creation failed: ' + profileError.message); return }

      if (allowed.role === 'admin') router.push('/vacation/admin')
      else if (allowed.role === 'manager') router.push('/vacation/manager')
      else router.push('/vacation/employee')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0A2342 0%, #1a3a5c 60%, #0A2342 100%)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10">
        <div className="flex items-center gap-3 mb-8">
          <MisterAbstractLogo size={44} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#0A2342' }}>Mister Abstract</h1>
            <p className="text-xs text-gray-500">Create Your Account</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ color: '#0A2342' }}>Create Account</h2>
        <p className="text-gray-500 text-sm mb-8">Use your company-approved email address</p>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@misterabstract.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white text-sm transition hover:opacity-90 disabled:opacity-50"
            style={{ background: '#0A2342' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/vacation/login" className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
