'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getContacts, createContact, deleteContact } from '@/lib/api'
import { Contact } from '@/types/database'

export default function CustomersPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor'>('all')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', notes: '', contact_type: 'customer' as 'customer' | 'vendor',
  })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) return
    loadContacts()
  }, [selectedCompanyId, companies])

  async function loadContacts() {
    setLoading(true)
    const all = await Promise.all(companyIds.map(id => getContacts(id)))
    setContacts(all.flat())
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const contact = await createContact({ ...form, company_id: companyId })
      setContacts(prev => [...prev, contact])
      setShowForm(false)
      setForm({ name: '', email: '', phone: '', address: '', notes: '', contact_type: 'customer' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return
    await deleteContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selectedContact?.id === id) setSelectedContact(null)
  }

  const filtered = contacts.filter(c => {
    if (filterType !== 'all' && c.contact_type !== filterType) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.email?.toLowerCase().includes(search.toLowerCase()) &&
        !c.phone?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage customers and vendors</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Contact
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total', value: contacts.length, color: 'indigo' },
          { label: 'Customers', value: contacts.filter(c => c.contact_type === 'customer').length, color: 'blue' },
          { label: 'Vendors', value: contacts.filter(c => c.contact_type === 'vendor').length, color: 'purple' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${s.color === 'indigo' ? 'border-indigo-500' : s.color === 'blue' ? 'border-blue-500' : 'border-purple-500'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' : s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input placeholder="Search by name, email or phone..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {(['all', 'customer', 'vendor'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${filterType === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contact list */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 dark:text-gray-500 mb-3">No contacts found.</p>
                <button onClick={() => setShowForm(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add first contact</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(c => (
                  <div key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex items-center gap-3 ${selectedContact?.id === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.contact_type === 'customer' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'}`}>
                          {c.contact_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.email}</p>
                    </div>
                    <p className="text-sm text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block">{c.phone}</p>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Detail panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
          {!selectedContact ? (
            <div className="text-center py-8">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Select a contact to view details</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{selectedContact.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedContact.name}</h3>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${selectedContact.contact_type === 'customer' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'}`}>
                      {selectedContact.contact_type}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(selectedContact.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Email', value: selectedContact.email, icon: '✉️' },
                  { label: 'Phone', value: selectedContact.phone, icon: '📱' },
                  { label: 'Address', value: selectedContact.address, icon: '📍' },
                  { label: 'Notes', value: selectedContact.notes, icon: '📝' },
                ].map(field => field.value ? (
                  <div key={field.label}>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">{field.icon} {field.label}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                ) : null)}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500">Added {new Date(selectedContact.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Contact</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="flex gap-2">
                {(['customer', 'vendor'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, contact_type: t })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${form.contact_type === t ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="tel" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
