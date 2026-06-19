'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'
import { getContacts } from '@/lib/api'
import { Contact } from '@/types/database'

type Bill = {
  id: string
  company_id: string
  vendor: string
  amount: number
  invoice_date: string
  paid: boolean
  file_path: string | null
  file_name: string | null
  notes: string | null
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function BillsPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [bills, setBills] = useState<Bill[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    vendor: '', amount: '', invoice_date: new Date().toISOString().split('T')[0], paid: false, notes: '',
  })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) { setLoading(false); return }
    loadBills()
    loadContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, companies])

  async function loadContacts() {
    const lists = await Promise.all(companyIds.map(id => getContacts(id, 'vendor')))
    setContacts(lists.flat())
  }

  const vendorNames = Array.from(new Set(contacts.map(c => c.name))).sort((a, b) => a.localeCompare(b))

  async function loadBills() {
    setLoading(true)
    const { data } = await supabase.from('received_invoices').select('*').in('company_id', companyIds).order('invoice_date', { ascending: false })
    setBills((data || []) as Bill[])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      let file_path: string | null = null
      let file_name: string | null = null
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${companyId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        file_path = path
        file_name = file.name
      }
      const { error: insErr } = await supabase.from('received_invoices').insert([{
        company_id: companyId,
        vendor: form.vendor,
        amount: parseFloat(form.amount) || 0,
        invoice_date: form.invoice_date,
        paid: form.paid,
        file_path, file_name,
        notes: form.notes || null,
      }])
      if (insErr) throw insErr
      setShowForm(false); setFile(null)
      setForm({ vendor: '', amount: '', invoice_date: new Date().toISOString().split('T')[0], paid: false, notes: '' })
      await loadBills()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save bill')
    } finally {
      setSaving(false)
    }
  }

  async function viewFile(path: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function togglePaid(b: Bill) {
    await supabase.from('received_invoices').update({ paid: !b.paid }).eq('id', b.id)
    setBills(prev => prev.map(x => x.id === b.id ? { ...x, paid: !x.paid } : x))
  }

  async function handleDelete(b: Bill) {
    if (!confirm('Delete this bill?')) return
    if (b.file_path) await supabase.storage.from('documents').remove([b.file_path])
    await supabase.from('received_invoices').delete().eq('id', b.id)
    setBills(prev => prev.filter(x => x.id !== b.id))
  }

  const total = bills.reduce((s, b) => s + Number(b.amount), 0)
  const unpaid = bills.filter(b => !b.paid).reduce((s, b) => s + Number(b.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bills</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Invoices you receive — upload &amp; keep a copy of each one</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Bill
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Bills', value: bills.length, isMoney: false, color: 'blue' },
          { label: 'Total', value: total, isMoney: true, color: 'gray' },
          { label: 'Unpaid', value: unpaid, isMoney: true, color: unpaid > 0 ? 'orange' : 'green' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'green' ? 'border-green-500' :
            s.color === 'orange' ? 'border-orange-500' : 'border-gray-400'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">{s.isMoney ? fmt(s.value as number) : s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
          : bills.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-3">No bills yet.</p>
              <button onClick={() => setShowForm(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add your first bill</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Date', 'Vendor', 'Amount', 'File', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {bills.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(b.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{b.vendor}{b.notes && <span className="block text-xs text-gray-400 font-normal">{b.notes}</span>}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{fmt(Number(b.amount))}</td>
                      <td className="px-4 py-3">
                        {b.file_path
                          ? <button onClick={() => viewFile(b.file_path!)} className="text-indigo-600 dark:text-indigo-400 hover:underline">📎 View</button>
                          : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => togglePaid(b)} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.paid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        }`}>{b.paid ? 'paid' : 'unpaid'}</button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(b)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Bill</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              {vendorNames.length > 0 ? (
                <select required value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select vendor *</option>
                  {(form.vendor && !vendorNames.includes(form.vendor) ? [form.vendor, ...vendorNames] : vendorNames).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="Vendor / who it's from * (add Contacts to pick from a list)" required value={form.vendor}
                  onChange={e => setForm({ ...form, vendor: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                  <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Upload file (PDF or photo)</label>
                <input type="file" accept="application/pdf,image/*"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300" />
              </div>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} className="rounded" />
                Already paid
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(null); setFile(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
