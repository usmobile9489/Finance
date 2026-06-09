'use client'

import { useState, useEffect, useContext } from 'react'
import Image from 'next/image'
import { CompanyContext } from '../layout'
import { updateCompany, uploadCompanyLogo } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const { selectedCompany, companies, refreshCompanies, setSelectedCompanyId } = useContext(CompanyContext)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: selectedCompany?.name || '',
    email: selectedCompany?.email || '',
    phone: selectedCompany?.phone || '',
    address: selectedCompany?.address || '',
  })

  // Update form when company changes
  const handleSelectCompany = (id: string) => {
    setSelectedCompanyId(id)
    const c = companies.find(co => co.id === id)
    if (c) setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '' })
    setLogoFile(null); setLogoPreview(null); setSuccess(false); setError(null)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany) return
    setSaving(true); setError(null); setSuccess(false)
    try {
      let logoUrl = selectedCompany.logo_url
      if (logoFile) {
        logoUrl = await uploadCompanyLogo(selectedCompany.id, logoFile)
      }
      await updateCompany(selectedCompany.id, { ...form, logo_url: logoUrl })
      await refreshCompanies()
      setSuccess(true)
      setLogoFile(null)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  // ── Add login user ──
  const { user } = useContext(CompanyContext)
  const [isMember, setIsMember] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', mode: 'member' as 'member' | 'tenant' })
  const [userSaving, setUserSaving] = useState(false)
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Detect whether the current user is a sub-user (member of someone else's account)
  useEffect(() => {
    if (!user) return
    supabase.from('account_members').select('owner_id').eq('member_id', user.id).maybeSingle()
      .then(({ data }) => setIsMember(!!data))
  }, [user])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserSaving(true); setUserMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      setUserMsg({ ok: true, text: newUser.mode === 'member'
        ? `${newUser.email} added to your account — they share your companies & data.`
        : `${newUser.email} created as a separate account with their own empty workspace.` })
      setNewUser({ email: '', password: '', mode: 'member' })
    } catch (err: unknown) {
      setUserMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed' })
    } finally { setUserSaving(false) }
  }

  // ── SignalWire / phone settings (incl. call-in 2FA) ──
  const [sw, setSw] = useState({ space_url: '', project_id: '', api_token: '', phone_number: '', owner_ivr_pin: '', owner_phone: '', require_2fa: false })
  const [swSaving, setSwSaving] = useState(false)
  const [swMsg, setSwMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    supabase.from('signalwire_settings').select('*').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setSw({ space_url: data.space_url || '', project_id: data.project_id || '', api_token: data.api_token || '', phone_number: data.phone_number || '', owner_ivr_pin: data.owner_ivr_pin || '', owner_phone: data.owner_phone || '', require_2fa: !!data.require_2fa }) })
  }, [user])
  const saveSw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSwSaving(true); setSwMsg(null)
    const { error } = await supabase.from('signalwire_settings').upsert({ owner_id: user.id, ...sw, updated_at: new Date().toISOString() })
    setSwMsg(error ? error.message : 'Saved ✓')
    setSwSaving(false)
  }

  // ── SMTP (email sending) ──
  const [smtp, setSmtp] = useState({ host: '', port: '587', username: '', password: '', from_email: '', from_name: '', secure: false })
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpMsg, setSmtpMsg] = useState<string | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (!user) return
    supabase.from('smtp_settings').select('*').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setSmtp({ host: data.host || '', port: String(data.port || 587), username: data.username || '', password: data.password || '', from_email: data.from_email || '', from_name: data.from_name || '', secure: !!data.secure }) })
  }, [user])
  const saveSmtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSmtpSaving(true); setSmtpMsg(null)
    const { error } = await supabase.from('smtp_settings').upsert({ owner_id: user.id, ...smtp, port: parseInt(smtp.port) || 587, updated_at: new Date().toISOString() })
    setSmtpMsg(error ? error.message : 'Saved ✓')
    setSmtpSaving(false)
  }
  const sendTest = async () => {
    setTesting(true); setSmtpMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ to: testTo }) })
      const data = await res.json()
      setSmtpMsg(res.ok ? 'Test email sent ✓' : (data.error || 'Send failed'))
    } catch { setSmtpMsg('Send failed') } finally { setTesting(false) }
  }

  const [callTesting, setCallTesting] = useState(false)
  const sendTestCall = async () => {
    setCallTesting(true); setSwMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/phone/test-call', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token || ''}` } })
      const data = await res.json()
      setSwMsg(res.ok ? 'Test call placed ✓ — your phone should ring.' : (data.error || 'Call failed'))
    } catch { setSwMsg('Call failed') } finally { setCallTesting(false) }
  }

  // ── Full JSON backup ──
  const [backingUp, setBackingUp] = useState(false)
  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const tables = ['companies','contacts','items','item_pricing','transactions','invoices','invoice_items',
        'forms','form_fields','form_submissions','personal_transactions','personal_categories',
        'phone_inventory','phone_services','phone_rentals','keying_orders','keying_locks','keying_expenses',
        'keying_inventory','keying_prices','locksmith_projects','locksmith_inventory']
      const dump: Record<string, unknown> = { exported_at: new Date().toISOString() }
      for (const t of tables) {
        const { data } = await supabase.from(t).select('*')
        dump[t] = data || []
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }))
      a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
    } finally { setBackingUp(false) }
  }

  const currentLogo = logoPreview || selectedCompany?.logo_url

  if (!selectedCompany && companies.length === 0) {
    return <p className="text-gray-500 text-center py-12">No companies yet. Create one first.</p>
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Company Settings</h2>

      {/* Company picker if multiple */}
      {companies.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Editing company</label>
          <select
            value={selectedCompany?.id || ''}
            onChange={e => handleSelectCompany(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">✓ Saved successfully</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Logo</h3>
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              {currentLogo ? (
                <Image src={currentLogo} alt="Company logo" width={100} height={100}
                  className="rounded-xl object-contain border border-gray-200 p-2 bg-white" />
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                  <span className="text-gray-400 text-xs text-center">No logo</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {currentLogo ? 'Replace logo' : 'Upload logo'}
              </label>
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleLogoChange}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP — max 2MB. Appears on invoices and forms.</p>
            </div>
          </div>
        </div>

        {/* Company info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* SignalWire / Phone & Call-in */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Phone &amp; Call-in (SignalWire)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Powers customer phone verification and the keypad call-in (IVR). Get these from your SignalWire dashboard.
          In SignalWire, set your number&apos;s inbound voice webhook to <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/ivr/voice</code>
        </p>
        {swMsg && <div className={`px-4 py-2 rounded-lg mb-3 text-sm ${swMsg.includes('✓') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>{swMsg}</div>}
        <form onSubmit={saveSw} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Space URL (e.g. you.signalwire.com)" value={sw.space_url} onChange={e => setSw({ ...sw, space_url: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Project ID" value={sw.project_id} onChange={e => setSw({ ...sw, project_id: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="API Token" value={sw.api_token} onChange={e => setSw({ ...sw, api_token: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="SignalWire phone number (+1...)" value={sw.phone_number} onChange={e => setSw({ ...sw, phone_number: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Your call-in PIN (e.g. 1234)" value={sw.owner_ivr_pin} onChange={e => setSw({ ...sw, owner_ivr_pin: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Your phone number for 2FA (+1...)" value={sw.owner_phone} onChange={e => setSw({ ...sw, owner_phone: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {/* 2FA toggle */}
          <label className="sm:col-span-2 flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer">
            <input type="checkbox" checked={sw.require_2fa} onChange={e => setSw({ ...sw, require_2fa: e.target.checked })} className="mt-0.5 rounded" />
            <span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Require a phone-call code at login (2FA)</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">When on, after your password you&apos;ll get a call with a 4-digit code. Needs the fields above filled + your phone number. Turn on only after testing your number works.</span>
            </span>
          </label>
          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={swSaving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
              {swSaving ? 'Saving…' : 'Save SignalWire & 2FA settings'}
            </button>
            <button type="button" onClick={sendTestCall} disabled={callTesting} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
              {callTesting ? 'Calling…' : '📞 Send test call'}
            </button>
          </div>
          <p className="sm:col-span-2 text-xs text-gray-400 dark:text-gray-500">Save first, then send a test call to confirm your number works before turning on 2FA.</p>
        </form>
      </div>

      {/* SMTP / Email */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Email (SMTP)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter your email provider&apos;s SMTP details to send emails from the app (e.g. invoices). Get these from your email host (Gmail, Outlook, your domain, etc.).</p>
        {smtpMsg && <div className={`px-4 py-2 rounded-lg mb-3 text-sm ${smtpMsg.includes('✓') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>{smtpMsg}</div>}
        <form onSubmit={saveSmtp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="SMTP host (e.g. smtp.gmail.com)" value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Port (587 or 465)" value={smtp.port} onChange={e => setSmtp({ ...smtp, port: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Username" value={smtp.username} onChange={e => setSmtp({ ...smtp, username: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="password" placeholder="Password / app password" value={smtp.password} onChange={e => setSmtp({ ...smtp, password: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="From email (e.g. you@yourdomain.com)" value={smtp.from_email} onChange={e => setSmtp({ ...smtp, from_email: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="From name (e.g. Your Business)" value={smtp.from_name} onChange={e => setSmtp({ ...smtp, from_name: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={smtp.secure} onChange={e => setSmtp({ ...smtp, secure: e.target.checked })} className="rounded" />
            Use SSL (tick for port 465)
          </label>
          <button type="submit" disabled={smtpSaving} className="sm:col-span-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            {smtpSaving ? 'Saving…' : 'Save SMTP settings'}
          </button>
        </form>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
          <input type="email" placeholder="Send a test email to…" value={testTo} onChange={e => setTestTo(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={sendTest} disabled={testing || !testTo} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
            {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </div>

      {/* Data & Backup */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Data &amp; Backup</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Download a full copy of all your data as a JSON file. Keep it somewhere safe.</p>
        <button onClick={handleBackup} disabled={backingUp}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
          {backingUp ? 'Preparing…' : '⬇ Download full backup (JSON)'}
        </button>
      </div>

      {/* Login Users */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Login Users</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Public sign-up is <b>disabled</b>. Create logins here when you need to.
        </p>
        {userMsg && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${userMsg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>{userMsg.text}</div>
        )}
        <form onSubmit={handleAddUser} className="space-y-3">
          {/* Mode choice */}
          <div className={`grid grid-cols-1 ${isMember ? '' : 'sm:grid-cols-2'} gap-3`}>
            <button type="button" onClick={() => setNewUser({ ...newUser, mode: 'member' })}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${newUser.mode === 'member' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">👥 User on my account</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Shares your companies & data (e.g. an employee/partner).</p>
            </button>
            {!isMember && (
              <button type="button" onClick={() => setNewUser({ ...newUser, mode: 'tenant' })}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${newUser.mode === 'tenant' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">🏢 Separate tenant</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Brand-new isolated account — their own empty workspace, can&apos;t see your data.</p>
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="email" required placeholder="Email" value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="text" required placeholder="Temp password (min 6)" value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={userSaving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
              {userSaving ? 'Adding...' : 'Create Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
