'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type Expense = {
  id: string
  company_id: string
  description: string
  vendor: string | null
  amount: number
  expense_date: string | null
  notes: string | null
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function KeyingExpensesPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', vendor: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => { load() }, [selectedCompanyId, companies])

  async function load() {
    if (companyIds.length === 0) return
    setLoading(true)
    const { data } = await supabase.from('keying_expenses').select('*').in('company_id', companyIds).order('expense_date', { ascending: false })
    setExpenses((data || []) as Expense[])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('keying_expenses').insert([{
        company_id: companyId, description: form.description, vendor: form.vendor || null,
        amount: parseFloat(form.amount) || 0, expense_date: form.expense_date, notes: form.notes || null,
      }])
      if (error) throw error
      setShowAdd(false)
      setForm({ description: '', vendor: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('keying_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(x => x.id !== id))
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pins, tools & supplies — deducted from your profit</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Expense</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Total Expenses</p>
          <p className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">{fmt(total)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 border-gray-400">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Entries</p>
          <p className="text-xl font-bold mt-1 text-gray-600 dark:text-gray-400">{expenses.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div>
          : expenses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">No expenses yet.</p>
              <button onClick={() => setShowAdd(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add first expense</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Date', 'Description', 'Vendor', 'Amount', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{e.description}</p>
                        {e.notes && <p className="text-xs text-gray-400 dark:text-gray-500">{e.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.vendor || '—'}</td>
                      <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">{fmt(e.amount)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => del(e.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Business Expense</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <input type="text" placeholder="What did you buy? (pins, tools...) *" required value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Vendor" value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Add Expense'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setError(null) }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
