'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type PersonalTx = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'donation'
  category: string
  tags: string[]
  notes: string | null
  description: string
  attachment_url: string | null
  is_subscription: boolean
  subscription_frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null
  subscription_note: string | null
}

const PRESET_CATEGORIES = ['Food', 'Gas', 'Rent', 'Utilities', 'Entertainment', 'Healthcare', 'Clothing', 'Education', 'Travel', 'Donation', 'Other']

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PersonalFinancePage() {
  const { user } = useContext(CompanyContext)
  const [transactions, setTransactions] = useState<PersonalTx[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'donation',
    category: 'Food',
    customCategory: '',
    tags: '',
    notes: '',
    description: '',
    is_subscription: false,
    subscription_frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    subscription_note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    loadTransactions()
  }, [user])

  async function loadTransactions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('personal_transactions')
      .select('*')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
    if (!error) setTransactions((data || []) as PersonalTx[])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const category = form.category === 'Other' ? form.customCategory : form.category
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const { error } = await supabase.from('personal_transactions').insert([{
        user_id: user.id,
        date: form.date,
        amount: parseFloat(form.amount),
        type: form.type,
        category,
        tags,
        notes: form.notes || null,
        description: form.description,
        attachment_url: null,
        is_subscription: form.is_subscription,
        subscription_frequency: form.is_subscription ? form.subscription_frequency : null,
        subscription_note: form.is_subscription ? (form.subscription_note || null) : null,
      }])
      if (error) throw error
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], amount: '', type: 'expense', category: 'Food', customCategory: '', tags: '', notes: '', description: '', is_subscription: false, subscription_frequency: 'monthly', subscription_note: '' })
      await loadTransactions()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('personal_transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    if (filterTag && !t.tags?.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase()))) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    return true
  })

  function exportCSV() {
    const head = ['Date', 'Description', 'Type', 'Category', 'Tags', 'Amount', 'Notes']
    const rows = filtered.map(t => [t.date, t.description, t.type, t.category, (t.tags || []).join('; '), t.amount, t.notes || ''])
    const csv = [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `personal-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalDonations = filtered.filter(t => t.type === 'donation').reduce((s, t) => s + Number(t.amount), 0)
  const allCategories = [...new Set(transactions.map(t => t.category))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Personal Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track your income, expenses and donations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
            CSV
          </button>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Income', value: totalIncome, color: 'green' },
          { label: 'Expenses', value: totalExpenses, color: 'red' },
          { label: 'Donations', value: totalDonations, color: 'purple' },
          { label: 'Net', value: totalIncome - totalExpenses - totalDonations, color: totalIncome - totalExpenses - totalDonations >= 0 ? 'blue' : 'orange' },
        ].map(card => (
          <div key={card.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            card.color === 'green' ? 'border-green-500' :
            card.color === 'red' ? 'border-red-500' :
            card.color === 'purple' ? 'border-purple-500' :
            card.color === 'blue' ? 'border-blue-500' : 'border-orange-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              card.color === 'green' ? 'text-green-600 dark:text-green-400' :
              card.color === 'red' ? 'text-red-600 dark:text-red-400' :
              card.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
              card.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
            }`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
          <option value="donation">Donations</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Filter by tag..." value={filterTag} onChange={e => setFilterTag(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {(filterType !== 'all' || filterCategory !== 'all' || filterTag || dateFrom || dateTo) && (
          <button onClick={() => { setFilterType('all'); setFilterCategory('all'); setFilterTag(''); setDateFrom(''); setDateTo('') }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading transactions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-3">No transactions found.</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add your first transaction</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Date', 'Description', 'Category', 'Tags', 'Type', 'Amount', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{tx.description}</p>
                        {tx.is_subscription && (
                          <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded text-xs font-medium capitalize">
                            🔄 {tx.subscription_frequency}
                          </span>
                        )}
                      </div>
                      {tx.subscription_note && <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">{tx.subscription_note}</p>}
                      {tx.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">{tx.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-medium">{tx.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {tx.tags?.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        tx.type === 'expense' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${
                      tx.type === 'income' ? 'text-green-600 dark:text-green-400' :
                      tx.type === 'expense' ? 'text-red-600 dark:text-red-400' :
                      'text-purple-600 dark:text-purple-400'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(tx.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Transaction</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date *</label>
                  <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type *</label>
                <div className="flex gap-2">
                  {(['expense', 'income', 'donation'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                        form.type === t
                          ? t === 'income' ? 'bg-green-600 border-green-600 text-white' : t === 'expense' ? 'bg-red-500 border-red-500 text-white' : 'bg-purple-600 border-purple-600 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description *</label>
                <input type="text" required placeholder="What was this for?" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {form.category === 'Other' && (
                  <input type="text" placeholder="Custom category name" value={form.customCategory}
                    onChange={e => setForm({ ...form, customCategory: e.target.value })}
                    className="w-full mt-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tags (comma separated)</label>
                <input type="text" placeholder="e.g. groceries, weekly" value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              {/* Subscription toggle */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${form.is_subscription ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setForm({ ...form, is_subscription: !form.is_subscription })}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_subscription ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring Subscription</span>
                </label>
                {form.is_subscription && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Renewal Frequency</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(f => (
                          <button key={f} type="button" onClick={() => setForm({ ...form, subscription_frequency: f })}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                              form.subscription_frequency === f
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subscription Note</label>
                      <input type="text" placeholder="e.g. Netflix, gym membership..." value={form.subscription_note}
                        onChange={e => setForm({ ...form, subscription_note: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : 'Save Transaction'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
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
