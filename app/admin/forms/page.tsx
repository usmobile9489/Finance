'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { getForms, createForm, updateForm, deleteForm, getFormSubmissions, toggleFormPublished } from '@/lib/api'
import { Form } from '@/types/database'

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox'] as const
type FieldType = typeof FIELD_TYPES[number]

interface DraftField { label: string; type: FieldType; required: boolean; options: string }
const emptyDraftField = (): DraftField => ({ label: '', type: 'text', required: false, options: '' })

export default function FormsPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Form | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [draftFields, setDraftFields] = useState<DraftField[]>([emptyDraftField()])
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [viewingSubmissions, setViewingSubmissions] = useState<Form | null>(null)
  const [submissions, setSubmissions] = useState<Array<{ id: string; submitted_at: string; data: Record<string, unknown> }>>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [previewForm, setPreviewForm] = useState<Form | null>(null)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  const load = async () => {
    if (companyIds.length === 0) return
    setLoading(true)
    try {
      const all = await Promise.all(companyIds.map(id => getForms(id)))
      setForms(all.flat())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCompanyId])

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormDesc(''); setDraftFields([emptyDraftField()]); setModalError(null); setShowModal(true)
  }

  const openEdit = (f: Form) => {
    setEditing(f); setFormName(f.name); setFormDesc(f.description || '')
    setDraftFields((f.fields || []).length > 0 ? f.fields.map(field => ({
      label: field.label, type: field.type as FieldType, required: field.required, options: (field.options || []).join(', ')
    })) : [emptyDraftField()])
    setModalError(null); setShowModal(true)
  }

  const openSubmissions = async (f: Form) => {
    setViewingSubmissions(f); setSubsLoading(true)
    try { setSubmissions((await getFormSubmissions(f.id) || []) as Array<{ id: string; submitted_at: string; data: Record<string, unknown> }>) }
    catch (e) { console.error(e) }
    finally { setSubsLoading(false) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = selectedCompanyId === 'all' ? companies[0]?.id : selectedCompanyId
    if (!companyId || !formName.trim()) return
    setSaving(true); setModalError(null)
    const fields = draftFields.filter(f => f.label.trim()).map((f, i) => ({
      label: f.label.trim(), type: f.type, required: f.required,
      options: f.type === 'select' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : [],
      field_order: i,
    }))
    try {
      if (editing) { await updateForm(editing.id, { name: formName, description: formDesc || undefined }, fields) }
      else { await createForm({ company_id: companyId, name: formName, description: formDesc || undefined }, fields) }
      await load(); setShowModal(false)
    } catch (err: unknown) { setModalError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this form and all its submissions?')) return
    try { await deleteForm(id); setForms(fs => fs.filter(f => f.id !== id)) }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  const handleTogglePublish = async (f: Form) => {
    try {
      await toggleFormPublished(f.id, !f.is_published)
      setForms(fs => fs.map(form => form.id === f.id ? { ...form, is_published: !f.is_published } : form))
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed') }
  }

  const publicUrl = (f: Form) => `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${f.id}`

  const updateDraftField = (index: number, updates: Partial<DraftField>) =>
    setDraftFields(fields => fields.map((f, i) => i === index ? { ...f, ...updates } : f))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Custom Forms</h2>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">+ Create Form</button>
      </div>

      {loading ? <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
        : forms.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-400 mb-4">No forms yet.</p>
            <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">Create your first form</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map(f => (
              <div key={f.id} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{f.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${f.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {f.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{f.description}</p>}
                <p className="text-xs text-gray-400 mb-3">{(f.fields || []).length} field{(f.fields || []).length !== 1 ? 's' : ''}</p>

                {f.is_published && (
                  <div className="bg-indigo-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                    <span className="text-xs text-indigo-700 truncate flex-1">{publicUrl(f)}</span>
                    <button onClick={() => navigator.clipboard.writeText(publicUrl(f))}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0">Copy</button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openEdit(f)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  <button onClick={() => setPreviewForm(f)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Preview</button>
                  <button onClick={() => openSubmissions(f)} className="text-sm text-green-600 hover:text-green-800 font-medium">Submissions</button>
                  <button onClick={() => handleTogglePublish(f)} className={`text-sm font-medium ${f.is_published ? 'text-yellow-600 hover:text-yellow-800' : 'text-purple-600 hover:text-purple-800'}`}>
                    {f.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDelete(f.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Form Builder Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 my-auto">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Edit Form' : 'Create Form'}</h3>
            {modalError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{modalError}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              <input type="text" placeholder="Form name *" required value={formName} onChange={e => setFormName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Fields</span>
                  <button type="button" onClick={() => setDraftFields(fs => [...fs, emptyDraftField()])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add Field</button>
                </div>
                <div className="space-y-3">
                  {draftFields.map((field, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Field label *" value={field.label} onChange={e => updateDraftField(i, { label: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <select value={field.type} onChange={e => updateDraftField(i, { type: e.target.value as FieldType })}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {draftFields.length > 1 && (
                          <button type="button" onClick={() => setDraftFields(fs => fs.filter((_, fi) => fi !== i))} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                        )}
                      </div>
                      {field.type === 'select' && (
                        <input type="text" placeholder="Options (comma-separated)" value={field.options} onChange={e => updateDraftField(i, { options: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      )}
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateDraftField(i, { required: e.target.checked })} className="rounded" />
                        Required
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Form'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{previewForm.name} — Preview</h3>
              <button onClick={() => setPreviewForm(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            {previewForm.description && <p className="text-gray-500 text-sm mb-4">{previewForm.description}</p>}
            <div className="space-y-4">
              {(previewForm.fields || []).map((field, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" disabled />
                    : field.type === 'select' ? (
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" disabled>
                        <option>Select...</option>
                        {(field.options || []).map((o, j) => <option key={j}>{o}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled />{field.label}</label>
                    ) : (
                      <input type={field.type} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" disabled />
                    )}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
              <button className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium opacity-50" disabled>Submit (Preview)</button>
              {!previewForm.is_published ? (
                <button onClick={() => { handleTogglePublish(previewForm); setPreviewForm(null) }} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">Publish This Form</button>
              ) : (
                <button onClick={() => navigator.clipboard.writeText(publicUrl(previewForm))} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700">Copy Public Link</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {viewingSubmissions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Submissions — {viewingSubmissions.name}</h3>
              <button onClick={() => setViewingSubmissions(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            {subsLoading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
              : submissions.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No submissions yet.</p>
              : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {submissions.map(sub => (
                    <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-2">{new Date(sub.submitted_at).toLocaleString()}</p>
                      <div className="space-y-1">
                        {Object.entries(sub.data || {}).map(([key, val]) => (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className="font-medium text-gray-700 min-w-24">{key}:</span>
                            <span className="text-gray-600">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
