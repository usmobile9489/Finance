'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const BRANDS = ['Schlage', 'UD', 'ZB', 'Kwikset', 'Arrow', 'Other'] as const
const CYLINDER_TYPES = ['Mortise', 'Rim', 'Regular', 'Dead bolt', 'Pad Locks', 'Lever', 'Combo']
const KEYING_OPTIONS = ['Key Alike', 'MK-KA', 'MK-KD']

interface BrandOrder {
  brand: string
  enabled: boolean
  cylinder_type: string
  key_condition: 'New' | 'Used'
  keying_option: string
  key_number: string
  chart_name: string
  quantity: number
}

const defaultBrandOrder = (brand: string): BrandOrder => ({
  brand, enabled: false, cylinder_type: '', key_condition: 'New',
  keying_option: 'Key Alike', key_number: '', chart_name: '', quantity: 1,
})

export default function KeyingOrderPage() {
  const [customer, setCustomer] = useState({ first_name: '', last_name: '', email: '', phone: '', order_number: '', company: '', address: '' })
  const [brands, setBrands] = useState<BrandOrder[]>(BRANDS.map(b => defaultBrandOrder(b)))
  const [cutKeys, setCutKeys] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [orderNum, setOrderNum] = useState('')
  const [error, setError] = useState<string | null>(null)

  const updateBrand = (index: number, updates: Partial<BrandOrder>) => {
    setBrands(bs => bs.map((b, i) => i === index ? { ...b, ...updates } : b))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeBrands = brands.filter(b => b.enabled)
    if (activeBrands.length === 0) { setError('Please select at least one brand.'); return }
    setSubmitting(true); setError(null)

    const num = 'KY-' + String(Math.floor(Math.random() * 9000) + 1000)
    const brandsJson = activeBrands.map(b => ({
      brand: b.brand,
      condition: b.key_condition,
      cylinder_type: b.cylinder_type,
      keying_option: b.keying_option,
      key_number: b.key_number,
      chart_name: b.chart_name,
      quantity: b.quantity,
      subtotal: 0,
    }))

    try {
      const { error } = await supabase.from('keying_orders').insert([{
        order_number: num,
        status: 'new',
        company_name: customer.company || `${customer.first_name} ${customer.last_name}`.trim(),
        contact_name: `${customer.first_name} ${customer.last_name}`.trim(),
        email: customer.email,
        phone: customer.phone || null,
        address: customer.address || null,
        customer_ref: customer.order_number || null,
        notes: notes || null,
        brands_json: brandsJson,
        cut_keys: cutKeys,
        total: 0,
        company_id: null,
      }])
      if (error) throw error
      setOrderNum(num)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Order Received!</h1>
          <p className="text-3xl font-bold text-indigo-600 my-4">{orderNum}</p>
          <p className="text-gray-600 mb-6">Your keying order has been submitted. We&apos;ll process it shortly.</p>
          <button onClick={() => { setSubmitted(false); setBrands(BRANDS.map(b => defaultBrandOrder(b))); setCustomer({ first_name: '', last_name: '', email: '', phone: '', order_number: '', company: '', address: '' }); setNotes(''); setCutKeys(false) }}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-medium">New Order</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8 pb-6 border-b border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900">🗝️ Key Order Form</h1>
            <p className="text-gray-500 mt-1">Select what you need — just order, no pricing required</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Customer Info */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">Your Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" required value={customer.first_name} onChange={e => setCustomer({ ...customer, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" required value={customer.last_name} onChange={e => setCustomer({ ...customer, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" required value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input type="text" value={customer.company} onChange={e => setCustomer({ ...customer, company: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Ref / PO #</label>
                  <input type="text" value={customer.order_number} onChange={e => setCustomer({ ...customer, order_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                  <input type="text" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            {/* Brand Sections */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">Key Types</h2>
              <div className="space-y-3">
                {brands.map((brand, i) => (
                  <div key={brand.brand} className={`border rounded-xl transition-all ${brand.enabled ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
                    <button type="button" onClick={() => updateBrand(i, { enabled: !brand.enabled })}
                      className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={brand.enabled} onChange={() => {}} className="rounded border-gray-300 text-indigo-600 pointer-events-none" />
                        <span className="font-semibold text-gray-800">{brand.brand}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${brand.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        {brand.enabled ? 'Selected' : 'Click to add'}
                      </span>
                    </button>

                    {brand.enabled && (
                      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-indigo-100 pt-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Cylinder Type *</label>
                          <select required value={brand.cylinder_type} onChange={e => updateBrand(i, { cylinder_type: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Select...</option>
                            {CYLINDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Key Condition *</label>
                          <div className="flex gap-4 pt-1">
                            {(['New', 'Used'] as const).map(cond => (
                              <label key={cond} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name={`condition-${i}`} value={cond} checked={brand.key_condition === cond}
                                  onChange={() => updateBrand(i, { key_condition: cond })} className="text-indigo-600" />
                                {cond}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Keying Option *</label>
                          <div className="flex flex-wrap gap-3 pt-1">
                            {KEYING_OPTIONS.map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name={`keying-${i}`} value={opt} checked={brand.keying_option === opt}
                                  onChange={() => updateBrand(i, { keying_option: opt })} className="text-indigo-600" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                          <input type="number" min="1" required={brand.enabled} value={brand.quantity}
                            onChange={e => updateBrand(i, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Key Number</label>
                          <input type="text" value={brand.key_number} onChange={e => updateBrand(i, { key_number: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Chart Name</label>
                          <input type="text" value={brand.chart_name} onChange={e => updateBrand(i, { chart_name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cut Keys checkbox */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={cutKeys} onChange={e => setCutKeys(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <span className="font-semibold text-gray-800">Please cut keys for me</span>
                  <p className="text-xs text-gray-500">Check this if you would like us to cut the keys for this order.</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold text-lg">
              {submitting ? 'Submitting Order...' : 'Submit Order'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/admin" className="hover:text-gray-600">Admin login</Link>
        </p>
      </div>
    </div>
  )
}
