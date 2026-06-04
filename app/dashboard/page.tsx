'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getCompanies, createCompany,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
} from '@/lib/api'
import { Transaction } from '@/types/database'

const emptyForm = {
  description: '', amount: '', type: 'income' as 'income' | 'expense',
  date: new Date().toISOString().split('T')[0], tags: '', notes: '',
}

export default function PersonalDashboard() {
  const [personalCompanyId, setPersonalCompanyId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: currentUser } }) => {
      if (!currentUser) { router.push('/auth/login'); return }

      // Get or create a "Personal Finance" company for this user
      const companies = await getCompanies(currentUser.id)
      let personal = companies.find(c => c.name === 'Personal Finance')
      if (!personal) {
        personal = await createCompany({ user_id: currentUser.id, name: 'Personal Finance', email: currentUser.email || '' })
      }
      setPersonalCompanyId(personal.id)

      const txs = await getTransactions(personal.id)
      setTransactions(txs)
      setLoading(false)
    })
  }, [router])

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 })

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setForm({
      description: tx.description,
      amount: String(tx.amount),
      type: tx.type,
      date: tx.transaction_date,
      tags: (tx.tags || []).join(', '),
      notes: tx.notes || '',
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!personalCompanyId) return
    setSaving(true)
    setFormError(null)
    const payload = {
      company_id: personalCompanyId,
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      transaction_date: form.date,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes || null,
      contact_id: null,
    }
    try {
      if (editing) {
        const updated = await updateTransaction(editing.id, payload)
        setTransactions(ts => ts.map(t => t.id === editing.id ? updated : t))
      } else {
        const created = await createTransaction(payload)
        setTransactions(ts => [created, ...ts])
      }
      setShowForm(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    try {
      await deleteTransaction(id)
      setTransactions(ts => ts.filter(t => t.id !== id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading your dashboard...</p>
      </div>
    )
  }

  const allTags = Array.from(new Set(transactions.flatMap(t => t.tags || [])))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Personal Finance</h1>
          <div className="flex gap-3 items-center">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100">
              Business
            </Link>
            <button onClick={handleLogout} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Income</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-red-500">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalExpense)}</p>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${balance >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
            <p className="text-xs text-gray-500 uppercase font-medium">Balance</p>
            <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(balance)}</p>
          </div>
        </div>

        {/* Tabs + Add button */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1 border-b border-gray-200">
            {(['overview', 'transactions'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab}
              </button>
            ))}
          </div>
          <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
            + Add Transaction
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
              {transactions.length === 0 ? (
                <p className="text-gray-400 text-sm">No transactions yet. Add your first one.</p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 8).map(tx => (
                    <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                        <p className="text-xs text-gray-400">{tx.transaction_date}</p>
                      </div>
                      <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Tags Used</h2>
              {allTags.length === 0 ? (
                <p className="text-gray-400 text-sm">No tags yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <span key={tag} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                      {tag} ({transactions.filter(t => (t.tags || []).includes(tag)).length})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {transactions.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{tx.transaction_date}</td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">{tx.description}</td>
                        <td className="px-5 py-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {(tx.tags || []).map((tag, i) => (
                              <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-5 py-4 text-sm font-bold text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                        </td>
                        <td className="px-5 py-4 text-sm flex gap-3">
                          <button onClick={() => openEdit(tx)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                          <button onClick={() => handleDelete(tx.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Edit Transaction' : 'Add Transaction'}</h3>
            {formError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <input
                type="text" placeholder="Description *" required
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" step="0.01" min="0" placeholder="Amount *" required
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <input
                type="date" required
                value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text" placeholder="Tags (comma-separated)"
                value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Notes (optional)"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
