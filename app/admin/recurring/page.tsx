'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type Recur = { id: string; label: string; sub: string; amount: number; freq: string; kind: 'personal' | 'invoice' }

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// normalise any frequency to a per-month figure for the combined estimate
const monthly = (amount: number, freq: string) => {
  switch (freq) {
    case 'weekly': return amount * 52 / 12
    case 'monthly': return amount
    case 'quarterly': return amount / 3
    case 'yearly': return amount / 12
    default: return amount
  }
}

export default function RecurringPage() {
  const { companies, user } = useContext(CompanyContext)
  const [items, setItems] = useState<Recur[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companies])

  async function load() {
    setLoading(true)
    const companyIds = companies.map(c => c.id)
    const [subs, recInv] = await Promise.all([
      supabase.from('personal_transactions').select('id, description, amount, type, subscription_frequency, subscription_note')
        .eq('user_id', user!.id).eq('is_subscription', true),
      companyIds.length
        ? supabase.from('invoices').select('id, invoice_number, total, recurring_frequency, company_id, contacts(name)')
            .in('company_id', companyIds).eq('is_recurring', true)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    const list: Recur[] = []
    ;(subs.data || []).forEach((s: { id: string; description: string; amount: number; type: string; subscription_frequency: string | null; subscription_note: string | null }) => {
      list.push({
        id: 's' + s.id, label: s.description || s.subscription_note || 'Subscription',
        sub: 'Personal · ' + (s.type || ''), amount: Number(s.amount) || 0,
        freq: s.subscription_frequency || 'monthly', kind: 'personal',
      })
    })
    type RecInvRow = { id: string; invoice_number: string; total: number; recurring_frequency: string | null; company_id: string; contacts?: { name: string } | null }
    ;((recInv.data || []) as RecInvRow[]).forEach((r) => {
      const co = companies.find(c => c.id === r.company_id)
      list.push({
        id: 'i' + r.id, label: r.invoice_number, sub: (co?.name || 'Business') + (r.contacts?.name ? ' · ' + r.contacts.name : ''),
        amount: Number(r.total) || 0, freq: r.recurring_frequency || 'monthly', kind: 'invoice',
      })
    })
    setItems(list)
    setLoading(false)
  }

  const groups: { key: string; title: string }[] = [
    { key: 'weekly', title: 'Weekly' },
    { key: 'monthly', title: 'Monthly' },
    { key: 'quarterly', title: 'Quarterly' },
    { key: 'yearly', title: 'Yearly' },
  ]

  const totalMonthly = items.reduce((s, i) => s + monthly(i.amount, i.freq), 0)
  const totalYearly = totalMonthly * 12

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All your repeating subscriptions & invoices, by frequency</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 border-indigo-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Est. per month</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{loading ? '—' : fmt(totalMonthly)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 border-purple-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Est. per year</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{loading ? '—' : fmt(totalYearly)}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 dark:text-gray-500">No recurring items yet.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Mark a personal transaction as a subscription, or set an invoice to recurring.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => {
            const rows = items.filter(i => i.freq === g.key)
            if (rows.length === 0) return null
            const tot = rows.reduce((s, i) => s + i.amount, 0)
            return (
              <div key={g.key} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{g.title}</h3>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{fmt(tot)} <span className="text-xs font-normal text-gray-400">/ {g.title.toLowerCase()}</span></span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {rows.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{r.sub}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0 ml-3">{fmt(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
