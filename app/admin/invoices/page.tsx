'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import Image from 'next/image'
import { CompanyContext } from '../layout'
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, getContacts } from '@/lib/api'
import { InvoiceWithContact } from '@/lib/api'
import { Contact, InvoiceItem } from '@/types/database'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

const STATUS_OPTIONS = ['draft', 'pending_approval', 'sent', 'paid'] as const

export default function InvoicesPage() {
  const { selectedCompanyId, selectedCompany, companies } = useContext(CompanyContext)
  const [invoices, setInvoices] = useState<InvoiceWithContact[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithContact | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    contact_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax: '0',
    notes: '',
    status: 'draft' as typeof STATUS_OPTIONS[number],
    is_recurring: false,
    recurring_frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, line_total: 0 }])

  const handlePrint = () => {
    if (!printRef.current) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Invoice</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head><body class="p-8">${printRef.current.innerHTML}</body></html>`)
    w.document.close(); w.focus(); w.print(); w.close()
  }

  const previewCompany = previewInvoice
    ? (selectedCompany ?? companies.find(c => c.id === previewInvoice.company_id) ?? null)
    : null

  const previewContact = previewInvoice
    ? contacts.find(c => c.id === previewInvoice.contact_id) ?? null
    : null

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  const load = async () => {
    if (companyIds.length === 0) return
    setLoading(true)
    try {
      const [invs, ctcs] = await Promise.all([
        Promise.all(companyIds.map(id => getInvoices(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getContacts(id))).then(r => r.flat()),
      ])
      setInvoices(invs)
      setContacts(ctcs)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const generateInvoiceNumber = () => {
    const date = new Date()
    return `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  }

  const openCreate = () => {
    setForm({
      contact_id: '',
      invoice_number: generateInvoiceNumber(),
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
      tax: '0',
      notes: '',
      status: 'draft',
      is_recurring: false,
      recurring_frequency: 'monthly',
    })
    setLineItems([{ description: '', quantity: 1, unit_price: 0, line_total: 0 }])
    setError(null)
    setShowModal(true)
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(items => {
      const updated = [...items]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].line_total = Number(updated[index].quantity) * Number(updated[index].unit_price)
      }
      return updated
    })
  }

  const addLineItem = () => setLineItems(items => [...items, { description: '', quantity: 1, unit_price: 0, line_total: 0 }])
  const removeLineItem = (index: number) => setLineItems(items => items.filter((_, i) => i !== index))

  const subtotal = lineItems.reduce((s, li) => s + li.line_total, 0)
  const taxAmount = (subtotal * parseFloat(form.tax || '0')) / 100
  const total = subtotal + taxAmount

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId
    if (!companyId || !form.contact_id) {
      setError('Please select a customer.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const inv = await createInvoice(
        {
          company_id: companyId,
          contact_id: form.contact_id,
          invoice_number: form.invoice_number,
          issue_date: form.issue_date,
          due_date: form.due_date || form.issue_date,
          subtotal,
          tax: taxAmount,
          total,
          status: form.status,
          notes: form.notes || null,
          is_recurring: form.is_recurring,
          recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
        },
        lineItems.filter(li => li.description)
      )
      const contact = contacts.find(c => c.id === form.contact_id)
      setInvoices(invs => [{ ...inv, contacts: contact ? { name: contact.name, email: contact.email } : null }, ...invs])
      setShowModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: string, status: typeof STATUS_OPTIONS[number]) => {
    try {
      await updateInvoice(id, { status })
      setInvoices(invs => invs.map(i => i.id === id ? { ...i, status } : i))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    try {
      await deleteInvoice(id)
      setInvoices(invs => invs.filter(i => i.id !== id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
          + Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm mb-3">No invoices yet.</p>
            {companies.length === 0 ? (
              <p className="text-xs text-gray-400">Create a company first, then add contacts before creating invoices.</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-amber-600">You need at least one contact (customer) before creating an invoice.{' '}
                <a href="/admin/contacts" className="underline">Add a contact →</a>
              </p>
            ) : (
              <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
                Create your first invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{inv.contacts?.name || '—'}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">{fmt(inv.total)}</td>
                    <td className="px-5 py-4 text-sm">
                      <select
                        value={inv.status}
                        onChange={e => handleStatusChange(inv.id, e.target.value as typeof STATUS_OPTIONS[number])}
                        className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${STATUS_COLORS[inv.status] || ''}`}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{inv.due_date || '—'}</td>
                    <td className="px-5 py-4 text-sm flex gap-3 flex-wrap">
                      <button onClick={() => setPreviewInvoice(inv)} className="text-indigo-600 hover:text-indigo-800 font-medium">Preview</button>
                      {inv.is_recurring && <span className="text-xs text-purple-600 font-medium">Recurring</span>}
                      <button onClick={() => handleDelete(inv.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 my-auto">
            <h3 className="text-xl font-bold mb-4">Create Invoice</h3>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Top row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Number</label>
                  <input
                    type="text" required
                    value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
                  <select
                    value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select customer...</option>
                    {contacts.filter(c => c.contact_type === 'customer').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
                  <input type="date" required value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-600">Line Items</label>
                  <button type="button" onClick={addLineItem} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add Line</button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text" placeholder="Description" value={li.description}
                        onChange={e => updateLineItem(i, 'description', e.target.value)}
                        className="col-span-5 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="number" min="1" placeholder="Qty" value={li.quantity}
                        onChange={e => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="number" min="0" step="0.01" placeholder="Price" value={li.unit_price}
                        onChange={e => updateLineItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="col-span-1 text-sm font-medium text-gray-700 text-right">{fmt(li.line_total)}</span>
                      <button type="button" onClick={() => removeLineItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Tax (%)</span>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-indigo-600">{fmt(total)}</span>
                </div>
              </div>

              {/* Extras */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as typeof STATUS_OPTIONS[number] })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
                    <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} className="rounded" />
                    Recurring
                  </label>
                  {form.is_recurring && (
                    <select value={form.recurring_frequency} onChange={e => setForm({ ...form, recurring_frequency: e.target.value as typeof form.recurring_frequency })}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  )}
                </div>
              </div>

              <textarea
                placeholder="Notes (optional)"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Creating...' : 'Create Invoice'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-auto">
            {/* Modal toolbar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Invoice Preview — {previewInvoice.invoice_number}</h3>
              <div className="flex gap-3">
                <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
                  Print / Save PDF
                </button>
                <button onClick={() => setPreviewInvoice(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
                  Close
                </button>
              </div>
            </div>

            {/* Invoice content */}
            <div ref={printRef} className="p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-gray-200">
                <div>
                  {previewCompany?.logo_url && (
                    <Image src={previewCompany.logo_url} alt={previewCompany.name} width={120} height={50} className="mb-3 object-contain" />
                  )}
                  <h1 className="text-2xl font-bold text-gray-900">{previewCompany?.name || 'Your Company'}</h1>
                  {previewCompany?.address && <p className="text-gray-500 text-sm mt-1">{previewCompany.address}</p>}
                  {previewCompany?.email && <p className="text-gray-500 text-sm">{previewCompany.email}</p>}
                  {previewCompany?.phone && <p className="text-gray-500 text-sm">{previewCompany.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-indigo-600 mb-3">INVOICE</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-semibold">Invoice #:</span> {previewInvoice.invoice_number}</p>
                    <p><span className="font-semibold">Issue Date:</span> {previewInvoice.issue_date}</p>
                    <p><span className="font-semibold">Due Date:</span> {previewInvoice.due_date || '—'}</p>
                    <div className="mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[previewInvoice.status] || ''}`}>
                        {previewInvoice.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
                <p className="text-lg font-bold text-gray-900">{previewInvoice.contacts?.name || previewContact?.name || '—'}</p>
                {previewContact?.address && <p className="text-gray-500 text-sm">{previewContact.address}</p>}
                {previewInvoice.contacts?.email && <p className="text-gray-500 text-sm">{previewInvoice.contacts.email}</p>}
              </div>

              {/* Line Items */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="bg-gray-50 border-t-2 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-16">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-28">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewInvoice.invoice_items || []).length > 0
                    ? (previewInvoice.invoice_items as InvoiceItem[]).map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-800">{item.description || `Item ${i + 1}`}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(item.unit_price)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(item.line_total)}</td>
                        </tr>
                      ))
                    : (
                      <tr className="border-b border-gray-100">
                        <td colSpan={4} className="px-4 py-4 text-sm text-gray-400 text-center">No line items</td>
                      </tr>
                    )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{fmt(previewInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-gray-200 pb-2">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{fmt(previewInvoice.tax)}</span>
                  </div>
                  <div className="flex justify-between bg-indigo-50 px-3 py-2 rounded-lg">
                    <span className="font-bold text-gray-900">Total Due</span>
                    <span className="text-xl font-bold text-indigo-600">{fmt(previewInvoice.total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {previewInvoice.notes && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{previewInvoice.notes}</p>
                </div>
              )}

              {previewInvoice.is_recurring && (
                <p className="text-xs text-purple-600 mt-4">
                  Recurring — {previewInvoice.recurring_frequency}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
