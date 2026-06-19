'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type PhoneService = {
  id: string
  company_id: string
  customer: string
  service_type: string
  cost_to_business: number
  price_charged: number
  service_date: string
  notes: string | null
  status: 'pending' | 'completed' | 'cancelled'
  paid: boolean
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SERVICE_TYPES = ['Monthly Plan', 'Prepaid Plan', 'SIM Card', 'eSIM', 'Data Plan', 'Activation', 'Port-In', 'Plan Renewal', 'Hotspot / Data', 'Add-On', 'Other']

export default function PhoneServicePage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [services, setServices] = useState<PhoneService[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = {
    customer: '', service_type: 'Monthly Plan', cost_to_business: '',
    price_charged: '', service_date: new Date().toISOString().split('T')[0], notes: '', status: 'completed' as PhoneService['status'], paid: false,
  }
  const [form, setForm] = useState(emptyForm)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) return
    loadServices()
  }, [selectedCompanyId, companies])

  async function loadServices() {
    setLoading(true)
    const { data } = await supabase.from('phone_services').select('*').in('company_id', companyIds).order('service_date', { ascending: false })
    setServices((data || []) as PhoneService[])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const payload = {
        company_id: companyId,
        customer: form.customer,
        service_type: form.service_type,
        cost_to_business: parseFloat(form.cost_to_business) || 0,
        price_charged: parseFloat(form.price_charged),
        service_date: form.service_date,
        notes: form.notes || null,
        status: form.status,
        paid: form.paid,
      }
      if (editingId) {
        const { error } = await supabase.from('phone_services').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('phone_services').insert([payload])
        if (error) throw error
      }
      closeForm()
      await loadServices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  function closeForm() { setShowForm(false); setEditingId(null); setError(null); setForm(emptyForm) }
  function openCreate() { closeForm(); setShowForm(true) }
  function openEdit(s: PhoneService) {
    setEditingId(s.id)
    setForm({
      customer: s.customer, service_type: s.service_type,
      cost_to_business: String(s.cost_to_business ?? ''), price_charged: String(s.price_charged ?? ''),
      service_date: s.service_date, notes: s.notes || '', status: s.status, paid: s.paid,
    })
    setError(null); setShowForm(true)
  }

  async function togglePaid(s: PhoneService) {
    await supabase.from('phone_services').update({ paid: !s.paid }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, paid: !x.paid } : x))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this service record?')) return
    await supabase.from('phone_services').delete().eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const totalRevenue = services.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.price_charged, 0)
  const totalCost = services.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.cost_to_business, 0)
  const totalProfit = totalRevenue - totalCost

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cellular Service</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track cellular plans sold — buy price, sell price and profit</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Sale
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: services.filter(s => s.status === 'completed').length, isMoney: false, color: 'blue' },
          { label: 'Revenue', value: totalRevenue, isMoney: true, color: 'green' },
          { label: 'Costs', value: totalCost, isMoney: true, color: 'red' },
          { label: 'Profit', value: totalProfit, isMoney: true, color: totalProfit >= 0 ? 'emerald' : 'orange' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'green' ? 'border-green-500' :
            s.color === 'red' ? 'border-red-500' : s.color === 'emerald' ? 'border-emerald-500' : 'border-orange-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'green' ? 'text-green-600 dark:text-green-400' :
              s.color === 'red' ? 'text-red-600 dark:text-red-400' : s.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'
            }`}>{s.isMoney ? fmt(s.value as number) : s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
          : services.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">No service records yet.</p>
              <button onClick={openCreate} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add first sale</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Date', 'Customer', 'Plan / Service', 'Buy', 'Sell', 'Profit', 'Status', 'Paid', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {services.map(s => {
                    const profit = s.price_charged - s.cost_to_business
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(s.service_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.customer}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.service_type}</td>
                        <td className="px-4 py-3 text-red-600 dark:text-red-400">{fmt(s.cost_to_business)}</td>
                        <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">{fmt(s.price_charged)}</td>
                        <td className={`px-4 py-3 font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(profit)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            s.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                            s.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => togglePaid(s)} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            s.paid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          }`}>{s.paid ? 'paid' : 'unpaid'}</button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(s)} className="text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Cellular Sale' : 'New Cellular Sale'}</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Customer name *" required value={form.customer}
                onChange={e => setForm({ ...form, customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buy Price</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={form.cost_to_business}
                    onChange={e => setForm({ ...form, cost_to_business: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sell Price *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={form.price_charged}
                    onChange={e => setForm({ ...form, price_charged: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {form.cost_to_business && form.price_charged && (
                <div className={`p-2.5 rounded-lg text-sm font-medium ${parseFloat(form.price_charged) - parseFloat(form.cost_to_business) >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  Profit: {fmt(parseFloat(form.price_charged) - parseFloat(form.cost_to_business))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Service Date</label>
                  <input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PhoneService['status'] })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
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
