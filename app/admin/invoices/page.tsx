'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getInvoices, createInvoice, updateInvoice, updateInvoiceWithItems, deleteInvoice, getContacts, getItems } from '@/lib/api'
import { InvoiceWithContact } from '@/lib/api'
import { Contact, InvoiceItem, Item } from '@/types/database'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  line_total: number
  cost?: number // per-unit purchase cost, pulled from the catalog item
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}
const STATUS_OPTIONS = ['draft', 'pending_approval', 'sent', 'paid'] as const

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function InvoicesPage() {
  const { selectedCompanyId, selectedCompany, companies } = useContext(CompanyContext)
  const [invoices, setInvoices] = useState<InvoiceWithContact[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [catalogItems, setCatalogItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithContact | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    contact_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax: '0',
    cost: '0',
    notes: '',
    status: 'draft' as typeof STATUS_OPTIONS[number],
    is_recurring: false,
    recurring_frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    from_name: '',
    from_address: '',
    from_email: '',
    from_phone: '',
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, line_total: 0 }])

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  const load = async () => {
    if (companyIds.length === 0) return
    setLoading(true)
    try {
      const [invs, ctcs, itms] = await Promise.all([
        Promise.all(companyIds.map(id => getInvoices(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getContacts(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getItems(id))).then(r => r.flat()),
      ])
      setInvoices(invs)
      setContacts(ctcs)
      setCatalogItems(itms)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const generateInvoiceNumber = () => {
    const d = new Date()
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  }

  const openCreate = () => {
    const co = selectedCompany ?? companies[0]
    setEditingId(null)
    setForm({
      contact_id: '', invoice_number: generateInvoiceNumber(),
      issue_date: new Date().toISOString().split('T')[0], due_date: '',
      tax: '0', cost: '0', notes: '', status: 'draft', is_recurring: false, recurring_frequency: 'monthly',
      from_name: co?.name || '', from_address: co?.address || '', from_email: co?.email || '', from_phone: co?.phone || '',
    })
    setLineItems([{ description: '', quantity: 1, unit_price: 0, line_total: 0 }])
    setError(null)
    setShowModal(true)
  }

  const openEdit = (inv: InvoiceWithContact) => {
    setEditingId(inv.id)
    setForm({
      contact_id: inv.contact_id, invoice_number: inv.invoice_number,
      issue_date: inv.issue_date, due_date: inv.due_date || '',
      tax: String(inv.subtotal ? (Number(inv.tax) / inv.subtotal * 100).toFixed(2) : '0'),
      cost: String(inv.cost ?? 0), notes: inv.notes || '', status: inv.status,
      is_recurring: inv.is_recurring, recurring_frequency: inv.recurring_frequency || 'monthly',
      from_name: inv.from_name || '', from_address: inv.from_address || '', from_email: inv.from_email || '', from_phone: inv.from_phone || '',
    })
    const its = (inv.invoice_items || []) as InvoiceItem[]
    setLineItems(its.length > 0
      ? its.map(it => ({ description: it.description || '', quantity: it.quantity, unit_price: it.unit_price, line_total: it.line_total }))
      : [{ description: '', quantity: 1, unit_price: 0, line_total: 0 }])
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
  // Auto cost from catalog item purchase prices × quantity
  const itemsCost = lineItems.reduce((s, li) => s + (Number(li.cost) || 0) * (Number(li.quantity) || 0), 0)

  // When catalog items with a purchase cost are added, auto-fill the invoice cost
  useEffect(() => {
    if (!showModal) return
    if (itemsCost > 0) setForm(f => ({ ...f, cost: itemsCost.toFixed(2) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsCost, showModal])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId
    if (!companyId || !form.contact_id) { setError('Please select a customer.'); return }
    setSaving(true); setError(null)
    const payload = {
      company_id: companyId, contact_id: form.contact_id, invoice_number: form.invoice_number,
      issue_date: form.issue_date, due_date: form.due_date || form.issue_date,
      subtotal, tax: taxAmount, total, cost: parseFloat(form.cost) || 0, status: form.status, notes: form.notes || null,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      from_name: form.from_name || null, from_address: form.from_address || null,
      from_email: form.from_email || null, from_phone: form.from_phone || null,
    }
    const cleanItems = lineItems.filter(li => li.description)
    try {
      if (editingId) {
        await updateInvoiceWithItems(editingId, payload, cleanItems)
        await load()
      } else {
        const inv = await createInvoice(payload, cleanItems)
        const contact = contacts.find(c => c.id === form.contact_id)
        setInvoices(invs => [{ ...inv, contacts: contact ? { name: contact.name, email: contact.email } : null, invoice_items: cleanItems.map(ci => ({ ...ci, id: '', invoice_id: inv.id })) }, ...invs])
      }
      setShowModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice')
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (id: string, status: typeof STATUS_OPTIONS[number]) => {
    try {
      await updateInvoice(id, { status })
      setInvoices(invs => invs.map(i => i.id === id ? { ...i, status } : i))
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Update failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    try {
      await deleteInvoice(id)
      setInvoices(invs => invs.filter(i => i.id !== id))
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  const handlePrint = () => {
    if (!previewInvoice) return
    const originalTitle = document.title
    // Browser print header shows the document title — set it to the invoice number
    document.title = previewInvoice.invoice_number
    const restore = () => { document.title = originalTitle; window.removeEventListener('afterprint', restore) }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  const previewCompany = previewInvoice
    ? (companies.find(c => c.id === previewInvoice.company_id) ?? selectedCompany ?? null)
    : null
  const previewContact = previewInvoice ? contacts.find(c => c.id === previewInvoice.contact_id) ?? null : null

  // From details: invoice override → company
  const fromName = previewInvoice?.from_name || previewCompany?.name || 'Your Company'
  const fromAddress = previewInvoice?.from_address || previewCompany?.address || ''
  const fromEmail = previewInvoice?.from_email || previewCompany?.email || ''
  const fromPhone = previewInvoice?.from_phone || previewCompany?.phone || ''
  const logoUrl = previewCompany?.logo_url || null

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create, preview and print invoices</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">+ Create Invoice</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
          : invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">No invoices yet.</p>
              {contacts.length === 0 ? (
                <p className="text-xs text-amber-600">Add a customer first.{' '}<a href="/admin/customers" className="underline">Add a contact →</a></p>
              ) : (
                <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">Create your first invoice</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {['Invoice #', 'Customer', 'Total', 'Cost', 'Profit', 'Status (internal)', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {invoices.map(inv => {
                    const profit = Number(inv.total) - Number(inv.cost || 0)
                    return (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{inv.invoice_number}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{inv.contacts?.name || '—'}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(inv.total)}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{Number(inv.cost) > 0 ? fmt(inv.cost) : '—'}</td>
                      <td className={`px-5 py-4 text-sm font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(profit)}</td>
                      <td className="px-5 py-4 text-sm">
                        <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value as typeof STATUS_OPTIONS[number])}
                          className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${STATUS_COLORS[inv.status] || ''}`}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-sm flex gap-3 flex-wrap items-center">
                        <button onClick={() => setPreviewInvoice(inv)} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Print</button>
                        <button onClick={() => openEdit(inv)} className="text-gray-600 dark:text-gray-300 hover:underline font-medium">Edit</button>
                        <button onClick={() => handleDelete(inv.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-6 my-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingId ? 'Edit Invoice' : 'Create Invoice'}</h3>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              {/* From details (editable) */}
              <details className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Your details on this invoice (From) — click to edit</summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <input type="text" placeholder="Business name" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })}
                    className="col-span-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="text" placeholder="Address" value={form.from_address} onChange={e => setForm({ ...form, from_address: e.target.value })}
                    className="col-span-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="email" placeholder="Email" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="tel" placeholder="Phone" value={form.from_phone} onChange={e => setForm({ ...form, from_phone: e.target.value })}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </details>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invoice Number</label>
                  <input type="text" required value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Customer *</label>
                  <select value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} required
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select customer...</option>
                    {contacts.filter(c => c.contact_type === 'customer').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Issue Date</label>
                  <input type="date" required value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Line Items</label>
                  <div className="flex gap-3 items-center">
                    {catalogItems.length > 0 ? (
                      <select onChange={e => {
                          const item = catalogItems.find(it => it.id === e.target.value)
                          if (item) setLineItems(prev => {
                            const idx = prev.findIndex(li => !li.description)
                            const row = { description: item.name, quantity: 1, unit_price: item.base_price, line_total: item.base_price, cost: Number(item.cost_price) || 0 }
                            if (idx >= 0) { const u = [...prev]; u[idx] = row; return u }
                            return [...prev, row]
                          })
                          e.target.value = ''
                        }}
                        className="text-xs border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg px-2 py-1 focus:outline-none" defaultValue="">
                        <option value="">+ Pick from items</option>
                        {catalogItems.map(item => <option key={item.id} value={item.id}>{item.name} — sell ${item.base_price}{item.cost_price ? ` / cost $${item.cost_price}` : ''}</option>)}
                      </select>
                    ) : (
                      <a href="/admin/items" className="text-xs text-amber-600 hover:underline font-medium">No items — add some →</a>
                    )}
                    <button type="button" onClick={addLineItem} className="text-xs text-indigo-600 hover:underline font-medium">+ Add blank</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input type="text" placeholder="Description" value={li.description} onChange={e => updateLineItem(i, 'description', e.target.value)}
                        className="col-span-5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="number" min="1" placeholder="Qty" value={li.quantity} onChange={e => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="col-span-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="number" min="0" step="0.01" placeholder="Price" value={li.unit_price} onChange={e => updateLineItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="col-span-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <span className="col-span-1 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">{fmt(li.line_total)}</span>
                      <button type="button" onClick={() => removeLineItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Subtotal</span><span className="font-medium text-gray-900 dark:text-gray-100">{fmt(subtotal)}</span></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax (%)</span>
                  <input type="number" min="0" max="100" step="0.01" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })}
                    className="w-20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white">Total (customer pays)</span><span className="text-indigo-600 dark:text-indigo-400">{fmt(total)}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-gray-600 dark:text-gray-400">Your cost <span className="text-xs text-gray-400">{itemsCost > 0 ? '(auto-filled from item costs — editable)' : '(materials/goods — not shown to customer)'}</span></span>
                  <input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })}
                    className="w-24 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700 dark:text-gray-300">Your profit</span>
                  <span className={total - (parseFloat(form.cost) || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{fmt(total - (parseFloat(form.cost) || 0))}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status (internal only)</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as typeof STATUS_OPTIONS[number] })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer pt-6">
                  <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} className="rounded" /> Recurring
                </label>
              </div>

              <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Invoice'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Invoice Preview / Print ───────────────────────────────────────── */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto print:bg-white print:p-0 print:overflow-visible" data-invoice-overlay>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-auto print:shadow-none print:rounded-none print:max-w-none print:my-0">
            {/* Toolbar (hidden when printing) */}
            <div className="px-6 py-4 border-b border-gray-100 no-print">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Invoice {previewInvoice.invoice_number}</h3>
                <div className="flex gap-3">
                  <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">🖨 Print / Save PDF</button>
                  <button onClick={() => setPreviewInvoice(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Close</button>
                </div>
              </div>
            </div>

            {/* Printable area */}
            <div className="p-10 invoice-print text-gray-800">
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-start gap-4">
                  {logoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt="logo" className="h-16 w-auto max-w-[160px] object-contain" />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{fromName}</h1>
                    {fromAddress && <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{fromAddress}</p>}
                    {fromEmail && <p className="text-sm text-gray-500">{fromEmail}</p>}
                    {fromPhone && <p className="text-sm text-gray-500">{fromPhone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold tracking-tight text-gray-900">INVOICE</p>
                  <p className="text-sm text-gray-500 mt-2">{previewInvoice.invoice_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
                  <p className="text-base font-bold text-gray-900">{previewInvoice.contacts?.name || previewContact?.name || '—'}</p>
                  {previewContact?.address && <p className="text-sm text-gray-500 whitespace-pre-line">{previewContact.address}</p>}
                  {previewInvoice.contacts?.email && <p className="text-sm text-gray-500">{previewInvoice.contacts.email}</p>}
                  {previewContact?.phone && <p className="text-sm text-gray-500">{previewContact.phone}</p>}
                </div>
                <div className="text-right text-sm text-gray-600 space-y-1">
                  <p><span className="text-gray-400">Issue Date: </span>{previewInvoice.issue_date}</p>
                  <p><span className="text-gray-400">Due Date: </span>{previewInvoice.due_date || '—'}</p>
                </div>
              </div>

              <table className="w-full mb-8 text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="py-2.5 text-left font-semibold text-gray-700">Description</th>
                    <th className="py-2.5 text-right font-semibold text-gray-700 w-16">Qty</th>
                    <th className="py-2.5 text-right font-semibold text-gray-700 w-28">Unit Price</th>
                    <th className="py-2.5 text-right font-semibold text-gray-700 w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewInvoice.invoice_items || []).length > 0
                    ? (previewInvoice.invoice_items as InvoiceItem[]).map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2.5 text-gray-800">{item.description || `Item ${i + 1}`}</td>
                          <td className="py-2.5 text-right text-gray-700">{item.quantity}</td>
                          <td className="py-2.5 text-right text-gray-700">{fmt(item.unit_price)}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-900">{fmt(item.line_total)}</td>
                        </tr>
                      ))
                    : <tr><td colSpan={4} className="py-4 text-gray-400 text-center">No line items</td></tr>}
                </tbody>
              </table>

              <div className="flex justify-end mb-8">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{fmt(previewInvoice.subtotal)}</span></div>
                  {Number(previewInvoice.tax) > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-medium">{fmt(previewInvoice.tax)}</span></div>}
                  <div className="flex justify-between border-t-2 border-gray-800 pt-2 mt-1">
                    <span className="font-bold text-gray-900">Total Due</span>
                    <span className="text-xl font-extrabold text-gray-900">{fmt(previewInvoice.total)}</span>
                  </div>
                </div>
              </div>

              {previewInvoice.notes && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{previewInvoice.notes}</p>
                </div>
              )}

              <p className="text-center text-xs text-gray-400 mt-10">Thank you for your business!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
