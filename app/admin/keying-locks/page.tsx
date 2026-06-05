'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type Lock = {
  id: string
  company_id: string
  lock_name: string
  vendor: string | null
  cost_price: number
  sold_price: number | null
  status: 'in_stock' | 'sold'
  customer: string | null
  purchase_date: string | null
  sale_date: string | null
  notes: string | null
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function KeyingLocksPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [locks, setLocks] = useState<Lock[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'in_stock' | 'sold'>('in_stock')
  const [showAdd, setShowAdd] = useState(false)
  const [sellModal, setSellModal] = useState<Lock | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ lock_name: '', vendor: '', cost_price: '', purchase_date: new Date().toISOString().split('T')[0], notes: '' })
  const [sellForm, setSellForm] = useState({ sold_price: '', sale_date: new Date().toISOString().split('T')[0], customer: '' })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => { load() }, [selectedCompanyId, companies])

  async function load() {
    if (companyIds.length === 0) return
    setLoading(true)
    const { data } = await supabase.from('keying_locks').select('*').in('company_id', companyIds).order('created_at', { ascending: false })
    setLocks((data || []) as Lock[])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('keying_locks').insert([{
        company_id: companyId, lock_name: form.lock_name, vendor: form.vendor || null,
        cost_price: parseFloat(form.cost_price) || 0, purchase_date: form.purchase_date, notes: form.notes || null, status: 'in_stock',
      }])
      if (error) throw error
      setShowAdd(false)
      setForm({ lock_name: '', vendor: '', cost_price: '', purchase_date: new Date().toISOString().split('T')[0], notes: '' })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setSaving(false) }
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault()
    if (!sellModal) return
    setSaving(true); setError(null)
    try {
      const { error } = await supabase.from('keying_locks').update({
        status: 'sold', sold_price: parseFloat(sellForm.sold_price) || 0, sale_date: sellForm.sale_date, customer: sellForm.customer || null,
      }).eq('id', sellModal.id)
      if (error) throw error
      setSellModal(null)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('Delete this lock?')) return
    await supabase.from('keying_locks').delete().eq('id', id)
    setLocks(prev => prev.filter(l => l.id !== id))
  }

  const inStock = locks.filter(l => l.status === 'in_stock')
  const sold = locks.filter(l => l.status === 'sold')
  const stockValue = inStock.reduce((s, l) => s + l.cost_price, 0)
  const totalProfit = sold.reduce((s, l) => s + ((l.sold_price || 0) - l.cost_price), 0)
  const displayed = tab === 'in_stock' ? inStock : sold

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Locks Buy / Sell</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Buy locks from vendors, sell for more</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Lock</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'In Stock', value: inStock.length, color: 'blue' },
          { label: 'Stock Cost', value: fmt(stockValue), color: 'indigo' },
          { label: 'Sold', value: sold.length, color: 'gray' },
          { label: 'Total Profit', value: fmt(totalProfit), color: totalProfit >= 0 ? 'emerald' : 'red' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'indigo' ? 'border-indigo-500' :
            s.color === 'gray' ? 'border-gray-400' : s.color === 'emerald' ? 'border-emerald-500' : 'border-red-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
              s.color === 'gray' ? 'text-gray-600 dark:text-gray-400' : s.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('in_stock')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'in_stock' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>In Stock ({inStock.length})</button>
        <button onClick={() => setTab('sold')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'sold' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Sold ({sold.length})</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div>
          : displayed.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">{tab === 'in_stock' ? 'No locks in stock.' : 'No sold locks yet.'}</p>
              {tab === 'in_stock' && <button onClick={() => setShowAdd(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add a lock</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Lock</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vendor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                    {tab === 'sold' && <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Sold</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Profit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                    </>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {displayed.map(l => {
                    const profit = (l.sold_price || 0) - l.cost_price
                    return (
                      <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{l.lock_name}</p>
                          {l.purchase_date && <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(l.purchase_date).toLocaleDateString()}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{l.vendor || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(l.cost_price)}</td>
                        {tab === 'sold' && <>
                          <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{fmt(l.sold_price || 0)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(profit)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{l.customer || '—'}</td>
                        </>}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {tab === 'in_stock' && (
                              <button onClick={() => { setSellModal(l); setSellForm({ sold_price: '', sale_date: new Date().toISOString().split('T')[0], customer: '' }) }}
                                className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-lg hover:bg-green-100 font-medium">Sell</button>
                            )}
                            <button onClick={() => del(l.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500">
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

      {/* Add Lock Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Lock</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <input type="text" placeholder="Lock name / model *" required value={form.lock_name}
                onChange={e => setForm({ ...form, lock_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Vendor (where you bought it)" value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cost Price *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={form.cost_price}
                    onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Add Lock'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setError(null) }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Sell Lock</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{sellModal.lock_name} — Cost: {fmt(sellModal.cost_price)}</p>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSell} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sold Price *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={sellForm.sold_price}
                    onChange={e => setSellForm({ ...sellForm, sold_price: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sale Date</label>
                  <input type="date" value={sellForm.sale_date} onChange={e => setSellForm({ ...sellForm, sale_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {sellForm.sold_price && (
                <div className={`p-2.5 rounded-lg text-sm font-medium ${parseFloat(sellForm.sold_price) - sellModal.cost_price >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  Profit: {fmt(parseFloat(sellForm.sold_price) - sellModal.cost_price)}
                </div>
              )}
              <input type="text" placeholder="Customer" value={sellForm.customer} onChange={e => setSellForm({ ...sellForm, customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Record Sale'}</button>
                <button type="button" onClick={() => { setSellModal(null); setError(null) }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
