'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type PhoneRental = {
  id: string
  company_id: string
  device_name: string
  imei: string | null
  customer: string
  rental_start: string
  rental_end: string | null
  rental_amount: number
  deposit: number
  notes: string | null
  status: 'active' | 'returned' | 'overdue'
  paid: boolean
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getRentalStatus(rental: PhoneRental): 'active' | 'returned' | 'overdue' {
  if (rental.status === 'returned') return 'returned'
  if (!rental.rental_end) return 'active'
  const today = new Date().toISOString().split('T')[0]
  if (rental.rental_end < today) return 'overdue'
  return 'active'
}

export default function PhoneRentalPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [rentals, setRentals] = useState<PhoneRental[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'returned' | 'all'>('active')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = {
    device_name: '', imei: '', customer: '', rental_start: new Date().toISOString().split('T')[0],
    rental_end: '', rental_amount: '', deposit: '', notes: '', paid: false,
  }
  const [form, setForm] = useState(emptyForm)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) return
    loadRentals()
  }, [selectedCompanyId, companies])

  async function loadRentals() {
    setLoading(true)
    const { data } = await supabase.from('phone_rentals').select('*').in('company_id', companyIds).order('rental_start', { ascending: false })
    const records = (data || []) as PhoneRental[]
    const updated = records.map(r => ({ ...r, status: getRentalStatus(r) }))
    setRentals(updated)
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const fields = {
        device_name: form.device_name,
        imei: form.imei || null,
        customer: form.customer,
        rental_start: form.rental_start,
        rental_end: form.rental_end || null,
        rental_amount: parseFloat(form.rental_amount),
        deposit: parseFloat(form.deposit) || 0,
        notes: form.notes || null,
        paid: form.paid,
      }
      if (editingId) {
        const { error } = await supabase.from('phone_rentals').update(fields).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('phone_rentals').insert([{ company_id: companyId, status: 'active', ...fields }])
        if (error) throw error
      }
      closeForm()
      await loadRentals()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rental')
    } finally {
      setSaving(false)
    }
  }

  function closeForm() { setShowForm(false); setEditingId(null); setError(null); setForm(emptyForm) }
  function openCreate() { closeForm(); setShowForm(true) }
  function openEdit(r: PhoneRental) {
    setEditingId(r.id)
    setForm({
      device_name: r.device_name, imei: r.imei || '', customer: r.customer,
      rental_start: r.rental_start, rental_end: r.rental_end || '',
      rental_amount: String(r.rental_amount ?? ''), deposit: String(r.deposit ?? ''),
      notes: r.notes || '', paid: r.paid,
    })
    setError(null); setShowForm(true)
  }

  async function togglePaid(r: PhoneRental) {
    await supabase.from('phone_rentals').update({ paid: !r.paid }).eq('id', r.id)
    setRentals(prev => prev.map(x => x.id === r.id ? { ...x, paid: !x.paid } : x))
  }

  async function handleReturn(id: string) {
    await supabase.from('phone_rentals').update({ status: 'returned' }).eq('id', id)
    setRentals(prev => prev.map(r => r.id === id ? { ...r, status: 'returned' } : r))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rental?')) return
    await supabase.from('phone_rentals').delete().eq('id', id)
    setRentals(prev => prev.filter(r => r.id !== id))
  }

  const active = rentals.filter(r => r.status === 'active')
  const overdue = rentals.filter(r => r.status === 'overdue')
  const returned = rentals.filter(r => r.status === 'returned')
  const totalRentalIncome = returned.reduce((s, r) => s + r.rental_amount, 0)

  const displayed = tab === 'active' ? [...overdue, ...active] : tab === 'returned' ? returned : rentals

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Phone Rental</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage device rentals and track income</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Rental
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Rentals', value: active.length, color: 'blue' },
          { label: 'Overdue', value: overdue.length, color: 'red' },
          { label: 'Returned', value: returned.length, color: 'gray' },
          { label: 'Total Income', value: fmt(totalRentalIncome), color: 'green' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'red' ? 'border-red-500' :
            s.color === 'gray' ? 'border-gray-400' : 'border-green-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'red' ? 'text-red-600 dark:text-red-400' :
              s.color === 'gray' ? 'text-gray-600 dark:text-gray-400' : 'text-green-600 dark:text-green-400'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {(['active', 'returned', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t === 'active' ? `Active${overdue.length > 0 ? ` (${overdue.length} overdue)` : ''}` : t === 'returned' ? `Returned (${returned.length})` : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
          : displayed.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">No rentals found.</p>
              <button onClick={openCreate} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Create first rental</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Device', 'Customer', 'Start', 'End', 'Amount', 'Deposit', 'Status', 'Paid', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {displayed.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{r.device_name}</p>
                        {r.imei && <p className="text-xs font-mono text-gray-400 dark:text-gray-500">IMEI: {r.imei}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.customer}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(r.rental_start).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{r.rental_end ? new Date(r.rental_end).toLocaleDateString() : <span className="text-gray-300 dark:text-gray-600">Open</span>}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{fmt(r.rental_amount)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.deposit > 0 ? fmt(r.deposit) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          r.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => togglePaid(r)} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.paid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        }`}>{r.paid ? 'paid' : 'unpaid'}</button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.status !== 'returned' && (
                            <button onClick={() => handleReturn(r.id)} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">Return</button>
                          )}
                          <button onClick={() => openEdit(r)} className="text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Rental' : 'New Rental'}</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Device name *" required value={form.device_name}
                  onChange={e => setForm({ ...form, device_name: e.target.value })}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" placeholder="IMEI" value={form.imei}
                  onChange={e => setForm({ ...form, imei: e.target.value })}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <input type="text" placeholder="Customer name *" required value={form.customer}
                onChange={e => setForm({ ...form, customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date *</label>
                  <input type="date" required value={form.rental_start} onChange={e => setForm({ ...form, rental_start: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input type="date" value={form.rental_end} onChange={e => setForm({ ...form, rental_end: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rental Amount *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={form.rental_amount}
                    onChange={e => setForm({ ...form, rental_amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Deposit</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={form.deposit}
                    onChange={e => setForm({ ...form, deposit: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} className="rounded" />
                Customer has paid
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save'}</button>
                <button type="button" onClick={closeForm}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
