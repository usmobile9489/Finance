'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type Inv = { id: string; invoice_number: string; total: number; status: string; issue_date: string; due_date: string | null; notes: string | null }

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const STATUS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  pending_approval: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700',
}

export default function CustomerPortal() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [invoices, setInvoices] = useState<Inv[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/customer/login'); return }
      setUser(user)
      const { data } = await supabase.from('invoices')
        .select('id, invoice_number, total, status, issue_date, due_date, notes')
        .order('issue_date', { ascending: false })
      setInvoices((data || []) as Inv[])
      setLoading(false)
    })
  }, [router])

  const logout = async () => { await supabase.auth.signOut(); router.push('/customer/login') }

  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total), 0)
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-indigo-600">Your Account</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border-l-4 border-red-500">
            <p className="text-xs text-gray-500 font-medium uppercase">Outstanding</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{loading ? '—' : fmt(outstanding)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-500 font-medium uppercase">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{loading ? '—' : fmt(paid)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Your Invoices</h2></div>
          {loading ? <p className="p-8 text-center text-gray-400 text-sm">Loading…</p>
            : invoices.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">No invoices yet.</p>
            : (
              <div className="divide-y divide-gray-50">
                {invoices.map(i => (
                  <div key={i.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{i.invoice_number}</p>
                      <p className="text-xs text-gray-400">Issued {i.issue_date}{i.due_date ? ` · Due ${i.due_date}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS[i.status] || 'bg-gray-100 text-gray-600'}`}>{i.status.replace('_', ' ')}</span>
                      <span className="text-sm font-bold text-gray-900">{fmt(i.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </main>
    </div>
  )
}
