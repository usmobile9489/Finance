'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getKeyingPrices, KeyingPrice } from '@/lib/api'
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
  const [customer, setCustomer] = useState({ first_name: '', last_name: '', email: '', order_number: '', company: '', address: '' })
  const [brands, setBrands] = useState<BrandOrder[]>(BRANDS.map(b => defaultBrandOrder(b)))
  const [notes, setNotes] = useState('')
  const [prices, setPrices] = useState<KeyingPrice[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load prices from the first company (or logged-in user's company)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (company) {
        const ps = await getKeyingPrices(company.id)
        setPrices(ps)
      }
    })
  }, [])

  const getPriceForBrand = (brand: string, cylinderType: string): number | null => {
    // Exact match first
    const exact = prices.find(p => p.brand === brand && p.cylinder_type === cylinderType)
    if (exact) return Number(exact.price_per_key)
    // Fall back to "Any" cylinder type
    const any = prices.find(p => p.brand === brand && (p.cylinder_type === 'Any' || !p.cylinder_type))
    if (any) return Number(any.price_per_key)
    return null
  }

  const getLineSubtotal = (brand: BrandOrder): number => {
    if (!brand.enabled || !brand.cylinder_type) return 0
    const price = getPriceForBrand(brand.brand, brand.cylinder_type)
    if (price === null) return 0
    return brand.quantity * price
  }

  const updateBrand = (index: number, updates: Partial<BrandOrder>) => {
    setBrands(bs => bs.map((b, i) => i === index ? { ...b, ...updates } : b))
  }

  const total = brands.filter(b => b.enabled).reduce((s, b) => s + getLineSubtotal(b), 0)
  const hasPrices = prices.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeBrands = brands.filter(b => b.enabled)
    if (activeBrands.length === 0) { setError('Please select at least one brand.'); return }

    setSubmitting(true); setError(null)
    const formData: Record<string, unknown> = {
      'Customer Name': `${customer.first_name} ${customer.last_name}`.trim(),
      'Email': customer.email,
      'Order Number': customer.order_number,
      'Company': customer.company,
      'Address': customer.address,
      'Notes': notes,
      'Total': `$${total.toFixed(2)}`,
    }
    activeBrands.forEach(b => {
      const price = getPriceForBrand(b.brand, b.cylinder_type)
      const sub = getLineSubtotal(b)
      formData[`${b.brand} - Cylinder Type`] = b.cylinder_type
      formData[`${b.brand} - Condition`] = b.key_condition
      formData[`${b.brand} - Keying Option`] = b.keying_option
      formData[`${b.brand} - Key Number`] = b.key_number
      formData[`${b.brand} - Chart Name`] = b.chart_name
      formData[`${b.brand} - Quantity`] = String(b.quantity)
      formData[`${b.brand} - Price Per Key`] = price != null ? `$${price.toFixed(2)}` : 'N/A'
      formData[`${b.brand} - Subtotal`] = `$${sub.toFixed(2)}`
    })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1).single()
        if (company) {
          // Find or create keying order form
          let { data: forms } = await supabase.from('forms').select('id').eq('company_id', company.id).eq('name', 'Keying Order Form').limit(1)
          let formId = forms?.[0]?.id
          if (!formId) {
            const { data: newForm } = await supabase.from('forms')
              .insert([{ company_id: company.id, name: 'Keying Order Form', description: 'Key orders', is_published: true }])
              .select().single()
            formId = newForm?.id
          }
          if (formId) {
            await supabase.from('form_submissions').insert([{ form_id: formId, data: formData }])
          }
        }
      }
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Received!</h1>
          <p className="text-gray-600 mb-4">Your keying order has been submitted. We&apos;ll process it shortly.</p>
          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setBrands(BRANDS.map(b => defaultBrandOrder(b))); setCustomer({ first_name: '', last_name: '', email: '', order_number: '', company: '', address: '' }); setNotes('') }}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">New Order</button>
            <Link href="/admin" className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium text-center">Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Key Order Form</h1>
              <p className="text-gray-500 mt-1">Select the keys you need — totals calculate automatically</p>
            </div>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          </div>

          {!hasPrices && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-700">
              <strong>No prices configured.</strong> Go to{' '}
              <Link href="/admin/keying-prices" className="underline font-medium">Admin → Key Prices</Link>
              {' '}to set prices per brand. Totals will calculate automatically once prices are set.
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Customer Info */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">Customer Information</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                  <input type="text" value={customer.order_number} onChange={e => setCustomer({ ...customer, order_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input type="text" value={customer.company} onChange={e => setCustomer({ ...customer, company: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            {/* Brand Sections */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">Key Types</h2>
              <div className="space-y-3">
                {brands.map((brand, i) => {
                  const linePrice = brand.cylinder_type ? getPriceForBrand(brand.brand, brand.cylinder_type) : null
                  const lineSubtotal = getLineSubtotal(brand)
                  return (
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
                        <div className="px-4 pb-4 space-y-4 border-t border-indigo-100 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Cylinder Type *</label>
                              <select required value={brand.cylinder_type} onChange={e => updateBrand(i, { cylinder_type: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">Select...</option>
                                {CYLINDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              {brand.cylinder_type && linePrice !== null && (
                                <p className="text-xs text-indigo-600 mt-1 font-medium">Price: ${linePrice.toFixed(2)} per key</p>
                              )}
                              {brand.cylinder_type && linePrice === null && hasPrices && (
                                <p className="text-xs text-amber-600 mt-1">No price set for this type — <Link href="/admin/keying-prices" className="underline">add it</Link></p>
                              )}
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
                              <label className="block text-xs font-medium text-gray-600 mb-1">Key Number *</label>
                              <input type="text" required={brand.enabled} value={brand.key_number}
                                onChange={e => updateBrand(i, { key_number: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Chart Name *</label>
                              <input type="text" required={brand.enabled} value={brand.chart_name}
                                onChange={e => updateBrand(i, { chart_name: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                              <input type="number" min="1" required={brand.enabled} value={brand.quantity}
                                onChange={e => updateBrand(i, { quantity: parseInt(e.target.value) || 1 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                          </div>
                          {/* Auto-calculated subtotal */}
                          {brand.cylinder_type && (
                            <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${linePrice !== null ? 'bg-green-50' : 'bg-gray-50'}`}>
                              <span className="text-gray-600">Subtotal ({brand.quantity} × {linePrice != null ? `$${linePrice.toFixed(2)}` : 'price not set'})</span>
                              <span className={`font-bold ${linePrice !== null ? 'text-green-700' : 'text-gray-400'}`}>
                                {linePrice !== null ? `$${lineSubtotal.toFixed(2)}` : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            {/* Total */}
            <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-lg font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-indigo-600">${total.toFixed(2)}</span>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold text-lg">
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
