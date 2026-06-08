'use client'

/**
 * PBX Contacts / Settings Page — for Finance project
 * ====================================================
 * Copy to: Finance/app/admin/pbx-contacts/page.tsx
 *
 * Contact directory with per-contact balance announcement toggle,
 * global toggle, add/edit/delete, CSV import.
 */

import { useEffect, useState, useRef } from 'react'
import { pbx, PbxContact, fmtPhone } from '@/lib/pbx'

type ContactForm = Record<string, string | boolean>

const EMPTY: ContactForm = {
  phone: '', name: '', hebrew_name: '', email: '', mobile2: '', home_phone: '',
  work_phone: '', address: '', city: '', state: '', zip: '', notes: '',
  spouse_name: '', spouse_hebrew_name: '', spouse_phone: '', announce_balance: false,
}

const FIELDS: [string, string][] = [
  ['phone', 'Mobile Phone *'], ['name', 'English Name'], ['hebrew_name', 'Hebrew Name'],
  ['home_phone', 'Home Phone'], ['mobile2', '2nd Mobile'], ['work_phone', 'Work Phone'],
  ['email', 'Email'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['zip', 'Zip'],
  ['spouse_name', 'Spouse Name'], ['spouse_hebrew_name', 'Spouse Hebrew Name'], ['spouse_phone', 'Spouse Phone'],
  ['notes', 'Notes'],
]

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return n.length === 10 ? `+1${n}` : raw
}

export default function PbxContactsPage() {
  const [contacts, setContacts] = useState<PbxContact[]>([])
  const [globalOn, setGlobalOn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ContactForm>(EMPTY)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<ContactForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load(q?: string) {
    setLoading(true)
    let query = pbx.from('pbx_contacts').select('*').order('name').limit(1000)
    if (q && q.length >= 2) {
      const d = q.replace(/\D/g, '')
      query = d.length >= 4
        ? pbx.from('pbx_contacts').select('*').or(`phone.ilike.%${d}%,home_phone.ilike.%${d}%,spouse_phone.ilike.%${d}%,mobile2.ilike.%${d}%`).order('name').limit(200)
        : pbx.from('pbx_contacts').select('*').or(`name.ilike.%${q}%,hebrew_name.ilike.%${q}%,city.ilike.%${q}%,spouse_name.ilike.%${q}%,email.ilike.%${q}%`).order('name').limit(200)
    }
    const [{ data: c }, { data: s }] = await Promise.all([
      query,
      pbx.from('settings').select('value').eq('key', 'announce_balance').single(),
    ])
    setContacts(c || [])
    setGlobalOn(s?.value === 'true')
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const timer = setTimeout(() => { load(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function toggleGlobal() {
    const nv = !globalOn; setGlobalOn(nv)
    await pbx.from('settings').update({ value: nv ? 'true' : 'false' }).eq('key', 'announce_balance')
  }

  async function toggleAnnounce(c: PbxContact) {
    const nv = !c.announce_balance
    await pbx.from('pbx_contacts').update({ announce_balance: nv }).eq('id', c.id)
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, announce_balance: nv } : x))
  }

  function buildPayload(form: ContactForm) {
    return {
      phone: normalizePhone(String(form.phone)),
      name: form.name || null, hebrew_name: form.hebrew_name || null,
      email: form.email || null, mobile2: form.mobile2 || null,
      home_phone: form.home_phone || null, work_phone: form.work_phone || null,
      address: form.address || null, city: form.city || null,
      state: form.state || null, zip: form.zip || null, notes: form.notes || null,
      spouse_name: form.spouse_name || null, spouse_hebrew_name: form.spouse_hebrew_name || null,
      spouse_phone: form.spouse_phone || null, announce_balance: form.announce_balance,
    }
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await pbx.from('pbx_contacts').update({ ...buildPayload(editForm), updated_at: new Date().toISOString() }).eq('id', editId)
    setSaving(false)
    if (error) { setMsg({ text: `Save failed: ${error.message}`, ok: false }); return }
    setEditId(null); load()
  }

  async function saveAdd() {
    if (!addForm.phone) return
    setSaving(true)
    const { error } = await pbx.from('pbx_contacts').insert(buildPayload(addForm))
    setSaving(false)
    if (error) {
      if (error.code === '23505') setMsg({ text: 'Phone number already exists.', ok: false })
      else setMsg({ text: error.message, ok: false })
      return
    }
    setMsg({ text: 'Contact added.', ok: true }); setShowAdd(false); setAddForm(EMPTY); load()
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await pbx.from('pbx_contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setMsg(null)
    const text = await file.text()
    const lines = text.split('\n')
    const headers = lines[0].split(',').map(h => h.replace(/^﻿/, '').replace(/"/g, '').trim())
    const col = (name: string) => headers.indexOf(name)
    const cell = (row: string[], name: string) => {
      const i = col(name); if (i < 0 || i >= row.length) return ''
      return row[i].replace(/^"|"$/g, '').trim()
    }
    const idLookup: Record<string, string[]> = {}
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(','); const id = cell(row, 'ID')
      if (id) idLookup[id] = row
    }
    const batch: ReturnType<typeof buildPayload>[] = []
    const seen = new Set<string>()
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',')
      const gender = cell(row, 'Gender').toLowerCase()
      if (gender !== 'm' && gender !== 'male') continue
      const mobile = normalizePhone(cell(row, 'Mobile'))
      const home = normalizePhone(cell(row, 'Home'))
      const primary = (mobile.startsWith('+1') ? mobile : '') || (home.startsWith('+1') ? home : '')
      if (!primary || seen.has(primary)) continue
      seen.add(primary)
      const name = [cell(row, 'English Title'), cell(row, 'First Name'), cell(row, 'Last Name')].filter(Boolean).join(' ') || null
      const hname = [cell(row, 'Hebrew First'), cell(row, 'Hebrew Last')].filter(Boolean).join(' ') || null
      const sid = cell(row, 'Spouse ID'); const srow = sid ? idLookup[sid] : null
      let spouse_name: string | null = null, spouse_phone: string | null = null
      if (srow) {
        spouse_name = [cell(srow, 'First Name'), cell(srow, 'Last Name')].filter(Boolean).join(' ') || null
        const sp = normalizePhone(cell(srow, 'Mobile')) || normalizePhone(cell(srow, 'Home'))
        spouse_phone = sp.startsWith('+1') ? sp : null
      }
      const address = [cell(row, 'Street #'), cell(row, 'Street')].filter(Boolean).join(' ') || null
      batch.push({
        phone: primary, name, hebrew_name: hname, email: cell(row, 'Email 1') || null,
        mobile2: null, home_phone: mobile.startsWith('+1') ? (home.startsWith('+1') ? home : null) : null,
        work_phone: null, address, city: cell(row, 'City') || null,
        state: cell(row, 'State') || null, zip: cell(row, 'Zip') || null, notes: null,
        spouse_name, spouse_hebrew_name: null, spouse_phone, announce_balance: false,
      })
    }
    let imported = 0
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50)
      const { error } = await pbx.from('pbx_contacts').upsert(chunk, { onConflict: 'phone' })
      if (!error) imported += chunk.length
    }
    setMsg({ text: `Imported ${imported} of ${batch.length} contacts.`, ok: true })
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📞 PBX Contacts</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Contact directory and balance announcement settings</p>
      </div>

      {/* Global toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Global Balance Announcement</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Callers with an unpaid balance hear it before voicemail</p>
        </div>
        <button onClick={toggleGlobal}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${globalOn ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${globalOn ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
          {msg.ok ? '✓ ' : ''}{msg.text}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search contacts..."
          className="flex-1 min-w-[220px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={() => { setShowAdd(!showAdd); setMsg(null) }}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">+ Add Contact</button>
        <label className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
          {importing ? 'Importing...' : '↑ Import CSV'}
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" disabled={importing} />
        </label>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Contact</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {FIELDS.map(([k, l]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{l}</label>
                <input value={String(addForm[k] || '')} onChange={e => setAddForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!addForm.announce_balance} onChange={e => setAddForm(p => ({ ...p, announce_balance: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Announce balance</span>
            </label>
            <button onClick={saveAdd} disabled={saving || !addForm.phone}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowAdd(false); setAddForm(EMPTY); setMsg(null) }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="ml-3 text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_100px_60px] px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <div>Name</div><div>Phone / Spouse</div><div>City</div><div>Announce</div><div />
          </div>

          {contacts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-gray-500 dark:text-gray-400">{search ? 'No matches' : 'No contacts yet'}</p>
            </div>
          )}

          {contacts.map(c => (
            <div key={c.id}>
              {editId === c.id ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {FIELDS.map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{l}</label>
                        <input value={String(editForm[k] || '')} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded px-2 py-1 text-sm" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!editForm.announce_balance} onChange={e => setEditForm(p => ({ ...p, announce_balance: e.target.checked }))} className="rounded" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Announce balance</span>
                    </label>
                    <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_1fr_1fr_100px_60px] px-4 py-3 items-center border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name || <span className="text-gray-400">—</span>}</p>
                    {c.hebrew_name && <p className="text-xs text-gray-400">{c.hebrew_name}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300">{fmtPhone(c.phone)}</p>
                    {c.home_phone && <p className="text-xs font-mono text-gray-400">🏠 {fmtPhone(c.home_phone)}</p>}
                    {c.spouse_name && (
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        👩 {c.spouse_name}{c.spouse_phone && <span className="font-mono ml-1">{fmtPhone(c.spouse_phone)}</span>}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{c.city || '—'}</div>
                  <div>
                    <button onClick={() => toggleAnnounce(c)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.announce_balance ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${c.announce_balance ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => { setEditId(c.id); setEditForm({ ...c } as unknown as ContactForm); setShowAdd(false) }}
                      className="w-7 h-7 rounded flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">✎</button>
                    <button onClick={() => deleteContact(c.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {contacts.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 text-right">
              {contacts.length.toLocaleString()} contacts{search && ' (filtered)'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
