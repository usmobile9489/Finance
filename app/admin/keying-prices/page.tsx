'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getKeyingPrices, upsertKeyingPrice, deleteKeyingPrice, KeyingPrice } from '@/lib/api'

const BRANDS = ['Schlage', 'UD', 'ZB', 'Kwikset', 'Arrow', 'Other']
const CYLINDER_TYPES = ['Mortise', 'Rim', 'Regular', 'Dead bolt', 'Pad Locks', 'Lever', 'Combo', 'Any']

export default function KeyingPricesPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [prices, setPrices] = useState<KeyingPrice[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState({ brand: 'Schlage', cylinder_type: 'Any', price: '' })
  const [addError, setAddError] = useState<string | null>(null)

  const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try { setPrices(await getKeyingPrices(companyId)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !newPrice.price) return
    setSaving('new'); setAddError(null)
    try {
      await upsertKeyingPrice(companyId, newPrice.brand, newPrice.cylinder_type, parseFloat(newPrice.price))
      await load()
      setNewPrice({ brand: 'Schlage', cylinder_type: 'Any', price: '' })
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(null) }
  }

  const handleDelete = async (id: string) => {
    try { await deleteKeyingPrice(id); setPrices(ps => ps.filter(p => p.id !== id)) }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  // Group by brand
  const grouped = BRANDS.map(brand => ({
    brand,
    prices: prices.filter(p => p.brand === brand),
  })).filter(g => g.prices.length > 0)

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Keying Order Prices</h2>
        <p className="text-gray-500 text-sm mt-1">
          Set your price per key for each brand and cylinder type. These prices are used to auto-calculate totals on the keying order form.
        </p>
      </div>

      {/* Add new price */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add / Update Price</h3>
        {addError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
            <select value={newPrice.brand} onChange={e => setNewPrice({ ...newPrice, brand: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cylinder Type</label>
            <select value={newPrice.cylinder_type} onChange={e => setNewPrice({ ...newPrice, cylinder_type: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CYLINDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Price Per Key ($)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" required
              value={newPrice.price} onChange={e => setNewPrice({ ...newPrice, price: e.target.value })}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" disabled={saving === 'new'}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            {saving === 'new' ? 'Saving...' : 'Save Price'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">Use <strong>Any</strong> as cylinder type to set a default price for all cylinders of that brand.</p>
      </div>

      {/* Price list */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : prices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm mb-2">No prices set yet.</p>
          <p className="text-gray-400 text-xs">Add prices above — they will be used to auto-calculate totals on the keying order form.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ brand, prices: brandPrices }) => (
            <div key={brand} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h4 className="font-semibold text-gray-800">{brand}</h4>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-5 py-2 text-left">Cylinder Type</th>
                    <th className="px-5 py-2 text-right">Price Per Key</th>
                    <th className="px-5 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {brandPrices.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-700">{p.cylinder_type || 'Any'}</td>
                      <td className="px-5 py-3 text-sm font-bold text-indigo-600 text-right">${Number(p.price_per_key).toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm">
                        <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
