'use client'

import { useState, useContext } from 'react'
import Image from 'next/image'
import { CompanyContext } from '../layout'
import { updateCompany, uploadCompanyLogo } from '@/lib/api'

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
    </div>
  )
}
