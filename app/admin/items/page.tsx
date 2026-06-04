'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getItems, createItem, updateItem, deleteItem, getContacts, getItemPricing, upsertItemPricing, deleteItemPricing } from '@/lib/api'
import { Item, Contact, ItemCustomerPrice } from '@/types/database'

const emptyForm = { name: '', description: '', base_price: '', cost_price: '', tags: '' }

export default function ItemsPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [items, setItems] = useState<Item[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Customer pricing
  const [pricingItem, setPricingItem] = useState<Item | null>(null)
  const [customerPrices, setCustomerPrices] = useState<(ItemCustomerPrice & { contacts?: { name: string } | null })[]>([])
  const [newCPrice, setNewCPrice] = useState({ contact_id: '', price: '' })
  const [pricingSaving, setPricingSaving] = useState(false)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  const load = async () => {
    if (companyIds.length === 0) return
    setLoading(true)
    try {
      const [allItems, allContacts] = await Promise.all([
        Promise.all(companyIds.map(id => getItems(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getContacts(id))).then(r => r.flat()),
      ])
      setItems(allItems)
      setContacts(allContacts)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(null); setShowModal(true) }
  const openEdit = (item: Item) => {
    setEditing(item)
    setForm({ name: item.name, description: item.description || '', base_price: String(item.base_price), cost_price: item.cost_price != null ? String(item.cost_price) : '', tags: (item.tags || []).join(', ') })
    setError(null); setShowModal(true)
  }

  const openPricing = async (item: Item) => {
    setPricingItem(item)
    const prices = await getItemPricing(item.id)
    setCustomerPrices(prices)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId
    if (!companyId) return
    setSaving(true); setError(null)
    const payload = {
      company_id: companyId, name: form.name, description: form.description || null,
      base_price: parseFloat(form.base_price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }
    try {
      if (editing) {
        const updated = await updateItem(editing.id, payload)
        setItems(is => is.map(i => i.id === editing.id ? updated : i))
      } else {
        const created = await createItem(payload)
        setItems(is => [...is, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setShowModal(false)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    try { await deleteItem(id); setItems(is => is.filter(i => i.id !== id)) }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  const handleAddCustomerPrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pricingItem || !newCPrice.contact_id || !newCPrice.price) return
    setPricingSaving(true)
    try {
      await upsertItemPricing(pricingItem.id, newCPrice.contact_id, parseFloat(newCPrice.price))
      const updated = await getItemPricing(pricingItem.id)
      setCustomerPrices(updated)
      setNewCPrice({ contact_id: '', price: '' })
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setPricingSaving(false) }
  }

  const handleDeleteCustomerPrice = async (id: string) => {
    await deleteItemPricing(id)
    setCustomerPrices(ps => ps.filter(p => p.id !== id))
  }

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  const profit = (item: Item) => {
    if (item.cost_price == null || item.cost_price === 0) return null
    return item.base_price - item.cost_price
  }
  const margin = (item: Item) => {
    if (item.cost_price == null || item.cost_price === 0) return null
    return ((item.base_price - item.cost_price) / item.base_price * 100).toFixed(1)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Items &amp; Services</h2>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">+ Add Item</button>
      </div>
      <div className="mb-4">
        <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
          : filtered.length === 0 ? <p className="text-center text-gray-400 py-12 text-sm">No items found.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sell Price</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cost Price</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Profit</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(item => {
                    const p = profit(item)
                    const m = margin(item)
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-400 truncate max-w-xs">{item.description}</p>}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">${Number(item.base_price).toFixed(2)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{item.cost_price != null ? `$${Number(item.cost_price).toFixed(2)}` : '—'}</td>
                        <td className="px-5 py-4 text-sm">
                          {p != null ? (
                            <span className={`font-semibold ${p >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${p.toFixed(2)} <span className="font-normal text-gray-400">({m}%)</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {(item.tags || []).map((tag, i) => <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{tag}</span>)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm flex gap-3 flex-wrap">
                          <button onClick={() => openEdit(item)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                          <button onClick={() => openPricing(item)} className="text-green-600 hover:text-green-800 font-medium">Pricing</button>
                          <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Edit Item' : 'Add Item'}</h3>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Item name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sell Price *</label>
                  <input type="number" step="0.01" min="0" required value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cost Price (what you paid)</label>
                  <input type="number" step="0.01" min="0" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {form.base_price && form.cost_price && (
                <div className="bg-green-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-600">Profit: </span>
                  <span className="font-bold text-green-700">${(parseFloat(form.base_price) - parseFloat(form.cost_price)).toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">({((parseFloat(form.base_price) - parseFloat(form.cost_price)) / parseFloat(form.base_price) * 100).toFixed(1)}% margin)</span>
                </div>
              )}
              <input type="text" placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Pricing Modal */}
      {pricingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Customer Pricing — {pricingItem.name}</h3>
              <button onClick={() => setPricingItem(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Base sell price: <strong>${Number(pricingItem.base_price).toFixed(2)}</strong>. Set custom prices per customer below.</p>
            <form onSubmit={handleAddCustomerPrice} className="flex gap-2 mb-4">
              <select value={newCPrice.contact_id} onChange={e => setNewCPrice({ ...newCPrice, contact_id: e.target.value })} required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select customer...</option>
                {contacts.filter(c => c.contact_type === 'customer').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" step="0.01" min="0" placeholder="Price" value={newCPrice.price} onChange={e => setNewCPrice({ ...newCPrice, price: e.target.value })} required
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={pricingSaving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">Add</button>
            </form>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customerPrices.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">No custom prices set.</p>
                : customerPrices.map(cp => (
                  <div key={cp.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">{cp.contacts?.name || 'Unknown'}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-indigo-600">${Number(cp.custom_price).toFixed(2)}</span>
                      <button onClick={() => handleDeleteCustomerPrice(cp.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
