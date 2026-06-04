'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, getContacts } from '@/lib/api'
import { Transaction, Contact } from '@/types/database'

const emptyForm = {
  description: '', amount: '', type: 'income' as 'income' | 'expense',
  transaction_date: new Date().toISOString().split('T')[0],
  tags: '', notes: '', contact_id: '',
}

export default function TransactionsPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [transactions, setTransactions] = useState<(Transaction & { contacts?: { name: string } | null })[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  const load = async () => {
    if (companyIds.length === 0) return
    setLoading(true)
    try {
      const [txs, ctcs] = await Promise.all([
        Promise.all(companyIds.map(id => getTransactions(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getContacts(id))).then(r => r.flat()),
      ])
      setTransactions(txs)
      setContacts(ctcs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(null); setShowModal(true) }
  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setForm({
      description: tx.description, amount: String(tx.amount), type: tx.type,
      transaction_date: tx.transaction_date, tags: tx.tags?.join(', ') || '',
      notes: tx.notes || '', contact_id: tx.contact_id || '',
    })
    setError(null); setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId
    if (!companyId) return
    setSaving(true); setError(null)
    const payload = {
      company_id: companyId, description: form.description,
      amount: parseFloat(form.amount), type: form.type,
      transaction_date: form.transaction_date,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes || null, contact_id: form.contact_id || null,
    }
    try {
      if (editing) {
        const updated = await updateTransaction(editing.id, payload)
        setTransactions(ts => ts.map(t => t.id === editing.id ? { ...updated, contacts: t.contacts } : t))
      } else {
        const created = await createTransaction(payload)
        setTransactions(ts => [{ ...created, contacts: null }, ...ts])
      }
      setShowModal(false)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    try { await deleteTransaction(id); setTransactions(ts => ts.filter(t => t.id !== id)) }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  // Filter + search
  const filtered = transactions.filter(tx => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false
    if (dateFrom && tx.transaction_date < dateFrom) return false
    if (dateTo && tx.transaction_date > dateTo) return false
    if (search) {
      const q = search.toLowerCase()
      const matchDesc = tx.description.toLowerCase().includes(q)
      const matchContact = tx.contacts?.name?.toLowerCase().includes(q)
      const matchTags = tx.tags?.some(tag => tag.toLowerCase().includes(q))
      const matchNotes = tx.notes?.toLowerCase().includes(q)
      if (!matchDesc && !matchContact && !matchTags && !matchNotes) return false
    }
    return true
  })

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
          + Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase">Income</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
          <p className="text-xs text-gray-500 uppercase">Expenses</p>
          <p className="text-xl font-bold text-red-600">{fmt(totalExpense)}</p>
        </div>
        <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${totalIncome - totalExpense >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
          <p className="text-xs text-gray-500 uppercase">Net</p>
          <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(totalIncome - totalExpense)}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-48">
            <input
              type="text" placeholder="Search description, contact, tags, notes..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {/* Type filter */}
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize ${typeFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
          {/* Clear */}
          {(search || dateFrom || dateTo || typeFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setTypeFilter('all') }}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100">
              Clear
            </button>
          )}
        </div>
        {filtered.length !== transactions.length && (
          <p className="text-xs text-gray-400 mt-2">Showing {filtered.length} of {transactions.length} transactions</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {transactions.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{tx.transaction_date}</td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{tx.description}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{tx.contacts?.name || '—'}</td>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Edit Transaction' : 'Add Transaction'}</h3>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Description *" required value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" min="0" placeholder="Amount *" required value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" required value={form.transaction_date}
                  onChange={e => setForm({ ...form, transaction_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No contact</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input type="text" placeholder="Tags (comma-separated)" value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Transaction'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
