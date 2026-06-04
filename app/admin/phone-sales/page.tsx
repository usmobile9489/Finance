'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type PhoneDevice = {
  id: string
  device_name: string
  imei: string | null
  serial_number: string | null
  purchase_price: number
  purchase_date: string
  seller: string | null
  notes: string | null
  status: 'in_stock' | 'sold'
  sale_price: number | null
  sale_date: string | null
  customer: string | null
  sale_notes: string | null
  company_id: string
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PhoneSalesPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [devices, setDevices] = useState<PhoneDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'inventory' | 'sold'>('inventory')
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showSellModal, setShowSellModal] = useState<PhoneDevice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceForm, setDeviceForm] = useState({
    device_name: '', imei: '', serial_number: '', purchase_price: '',
    purchase_date: new Date().toISOString().split('T')[0], seller: '', notes: '',
  })
  const [saleForm, setSaleForm] = useState({
    sale_price: '', sale_date: new Date().toISOString().split('T')[0], customer: '', sale_notes: '',
  })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) return
    loadDevices()
  }, [selectedCompanyId, companies])

  async function loadDevices() {
    setLoading(true)
    const { data } = await supabase.from('phone_inventory').select('*').in('company_id', companyIds).order('purchase_date', { ascending: false })
    setDevices((data || []) as PhoneDevice[])
    setLoading(false)
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceForm.device_name || companyIds.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('phone_inventory').insert([{
        company_id: companyId,
        device_name: deviceForm.device_name,
        imei: deviceForm.imei || null,
        serial_number: deviceForm.serial_number || null,
        purchase_price: parseFloat(deviceForm.purchase_price),
        purchase_date: deviceForm.purchase_date,
        seller: deviceForm.seller || null,
        notes: deviceForm.notes || null,
        status: 'in_stock',
      }])
      if (error) throw error
      setShowAddDevice(false)
      setDeviceForm({ device_name: '', imei: '', serial_number: '', purchase_price: '', purchase_date: new Date().toISOString().split('T')[0], seller: '', notes: '' })
      await loadDevices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add device')
    } finally {
      setSaving(false)
    }
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault()
    if (!showSellModal) return
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('phone_inventory').update({
        status: 'sold',
        sale_price: parseFloat(saleForm.sale_price),
        sale_date: saleForm.sale_date,
        customer: saleForm.customer || null,
        sale_notes: saleForm.sale_notes || null,
      }).eq('id', showSellModal.id)
      if (error) throw error
      setShowSellModal(null)
      setSaleForm({ sale_price: '', sale_date: new Date().toISOString().split('T')[0], customer: '', sale_notes: '' })
      await loadDevices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record sale')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this device?')) return
    await supabase.from('phone_inventory').delete().eq('id', id)
    setDevices(prev => prev.filter(d => d.id !== id))
  }

  const inStock = devices.filter(d => d.status === 'in_stock')
  const sold = devices.filter(d => d.status === 'sold')
  const totalProfit = sold.reduce((s, d) => s + ((d.sale_price || 0) - d.purchase_price), 0)
  const totalRevenue = sold.reduce((s, d) => s + (d.sale_price || 0), 0)
  const inventoryValue = inStock.reduce((s, d) => s + d.purchase_price, 0)
  const displayed = tab === 'inventory' ? inStock : sold

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Phone Buy / Sell</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track phone inventory, sales and profit</p>
        </div>
        <button onClick={() => setShowAddDevice(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Device
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'In Stock', value: inStock.length, unit: 'devices', color: 'blue' },
          { label: 'Inventory Value', value: fmt(inventoryValue), color: 'indigo' },
          { label: 'Total Revenue', value: fmt(totalRevenue), color: 'green' },
          { label: 'Total Profit', value: fmt(totalProfit), color: totalProfit >= 0 ? 'emerald' : 'red' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'indigo' ? 'border-indigo-500' :
            s.color === 'green' ? 'border-green-500' : s.color === 'emerald' ? 'border-emerald-500' : 'border-red-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
              s.color === 'green' ? 'text-green-600 dark:text-green-400' : s.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('inventory')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'inventory' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          In Stock ({inStock.length})
        </button>
        <button onClick={() => setTab('sold')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'sold' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          Sold ({sold.length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-3">{tab === 'inventory' ? 'No devices in stock.' : 'No sold devices yet.'}</p>
            {tab === 'inventory' && <button onClick={() => setShowAddDevice(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add a device</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">IMEI / Serial</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Purchased</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost</th>
                  {tab === 'sold' && <>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sale Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Profit</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customer</th>
                  </>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {displayed.map(d => {
                  const profit = (d.sale_price || 0) - d.purchase_price
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{d.device_name}</p>
                        {d.seller && <p className="text-xs text-gray-400 dark:text-gray-500">From: {d.seller}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {d.imei && <p className="text-xs font-mono">IMEI: {d.imei}</p>}
                        {d.serial_number && <p className="text-xs font-mono">SN: {d.serial_number}</p>}
                        {!d.imei && !d.serial_number && <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(d.purchase_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(d.purchase_price)}</td>
                      {tab === 'sold' && <>
                        <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{fmt(d.sale_price || 0)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(profit)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.customer || '—'}</td>
                      </>}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {tab === 'inventory' && (
                            <button onClick={() => { setShowSellModal(d); setSaleForm({ sale_price: '', sale_date: new Date().toISOString().split('T')[0], customer: '', sale_notes: '' }) }}
                              className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 font-medium">
                              Sell
                            </button>
                          )}
                          <button onClick={() => handleDelete(d.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Device to Inventory</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleAddDevice} className="space-y-3">
              <input type="text" placeholder="Device name *" required value={deviceForm.device_name}
                onChange={e => setDeviceForm({ ...deviceForm, device_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="IMEI" value={deviceForm.imei}
                  onChange={e => setDeviceForm({ ...deviceForm, imei: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" placeholder="Serial number" value={deviceForm.serial_number}
                  onChange={e => setDeviceForm({ ...deviceForm, serial_number: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Purchase Price *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={deviceForm.purchase_price}
                    onChange={e => setDeviceForm({ ...deviceForm, purchase_price: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Purchase Date *</label>
                  <input type="date" required value={deviceForm.purchase_date}
                    onChange={e => setDeviceForm({ ...deviceForm, purchase_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <input type="text" placeholder="Seller / Source" value={deviceForm.seller}
                onChange={e => setDeviceForm({ ...deviceForm, seller: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Notes" value={deviceForm.notes} onChange={e => setDeviceForm({ ...deviceForm, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Add Device'}</button>
                <button type="button" onClick={() => { setShowAddDevice(false); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Record Sale</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{showSellModal.device_name} — Cost: {fmt(showSellModal.purchase_price)}</p>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSell} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sale Price *</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00" value={saleForm.sale_price}
                    onChange={e => setSaleForm({ ...saleForm, sale_price: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sale Date *</label>
                  <input type="date" required value={saleForm.sale_date}
                    onChange={e => setSaleForm({ ...saleForm, sale_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {saleForm.sale_price && (
                <div className={`p-3 rounded-lg text-sm font-medium ${parseFloat(saleForm.sale_price) - showSellModal.purchase_price >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  Profit: {fmt(parseFloat(saleForm.sale_price) - showSellModal.purchase_price)}
                </div>
              )}
              <input type="text" placeholder="Customer name" value={saleForm.customer}
                onChange={e => setSaleForm({ ...saleForm, customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Notes" value={saleForm.sale_notes} onChange={e => setSaleForm({ ...saleForm, sale_notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Recording...' : 'Record Sale'}</button>
                <button type="button" onClick={() => { setShowSellModal(null); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
