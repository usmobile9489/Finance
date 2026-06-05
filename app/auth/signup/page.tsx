'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Public sign-up is disabled. Redirect anyone who lands here to the login page.
export default function SignupDisabledPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/auth/login') }, [router])
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign-up is closed</h1>
        <p className="text-gray-600 text-sm">Accounts are created by the administrator. Redirecting to sign in…</p>
      </div>
    </div>
  )
}
