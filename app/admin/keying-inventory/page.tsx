'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type InvItem = {
  id: string
  company_id: string
  name: string
  size: string | null
  quantity: number
  unit: string
  low_threshold: number
  notes: string | null
}

export default function KeyingInventoryPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [items, setItems] = useState<InvItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ size: '', quantity: '', low_threshold: '', notes: '' })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => { load() }, [selectedCompanyId, companies])

  async function load() {
    if (companyIds.length === 0) return
    setLoading(true)
    const { data } = await supabase.from('keying_inventory').select('*').in('company_id', companyIds).order('name')
    setItems((data || []) as InvItem[])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('keying_inventory').insert([{
        company_id: companyId, name: form.size, size: form.size, quantity: parseInt(form.quantity) || 0,
        unit: 'pcs', low_threshold: parseInt(form.low_threshold) || 0, notes: form.notes || null,
      }])
      if (error) throw error
      setShowAdd(false)
      setForm({ size: '', quantity: '', low_threshold: '', notes: '' })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setSaving(false) }
  }

  async function adjust(item: InvItem, delta: number) {
    const newQty = Math.max(0, item.quantity + delta)
    await supabase.from('keying_inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i))
  }

  async function setQty(item: InvItem, value: number) {
    const q = Math.max(0, value)
    await supabase.from('keying_inventory').update({ quantity: q }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: q } : i))
  }

  async function del(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('keying_inventory').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const lowStock = items.filter(i => i.low_threshold > 0 && i.quantity <= i.low_threshold)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pins Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track how many pins you have on hand</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Pin Type</button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 mb-6 text-sm text-blue-700 dark:text-blue-300">
        💡 When you buy pins: add the quantity here <b>and</b> record the cost separately in <Link href="/admin/keying-expenses" className="underline font-medium">Expenses</Link>.
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 mb-6 text-sm text-amber-700 dark:text-amber-400">
          ⚠️ Low stock: {lowStock.map(i => i.name).join(', ')}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div>
          : items.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">No pins tracked yet.</p>
              <button onClick={() => setShowAdd(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add first pin type</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {items.map(item => {
                const low = item.low_threshold > 0 && item.quantity <= item.low_threshold
                return (
                  <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Size {item.size || item.name}</p>
                      {item.notes && <p className="text-xs text-gray-400 dark:text-gray-500">{item.notes}</p>}
                    </div>
                    {low && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium shrink-0">Low</span>}
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => adjust(item, -1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-lg leading-none">−</button>
                      <input type="number" value={item.quantity} onChange={e => setQty(item, parseInt(e.target.value) || 0)}
                        className="w-16 text-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-8">{item.unit}</span>
                      <button onClick={() => adjust(item, 1)} className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 font-bold text-lg leading-none">+</button>
                      <button onClick={() => del(item.id)} className="ml-2 text-gray-300 dark:text-gray-600 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Pin Type</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Size *</label>
                  <input type="text" required placeholder="e.g. 240B" value={form.size}
                    onChange={e => setForm({ ...form, size: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount *</label>
                  <input type="number" min="0" required placeholder="e.g. 10" value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Low-stock alert at (optional)</label>
                <input type="number" min="0" placeholder="e.g. 20" value={form.low_threshold}
                  onChange={e => setForm({ ...form, low_threshold: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <input type="text" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Add'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setError(null) }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
