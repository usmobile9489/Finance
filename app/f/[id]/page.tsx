'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { getPublicFormById, submitForm } from '@/lib/api'
import { Form } from '@/types/database'

type FormWithCompany = Form & { companies?: { name: string; logo_url: string | null } | null }

export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<FormWithCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getPublicFormById(id)
      .then(data => { setForm(data as FormWithCompany); setLoading(false) })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSubmitting(true); setError(null)
    try {
      await submitForm(form.id, values)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading form...</p>
      </div>
    )
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Form Not Found</h1>
          <p className="text-gray-500">This form is not available or has been unpublished.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">Your submission has been received. We&apos;ll be in touch soon.</p>
          {form.companies?.name && <p className="text-sm text-gray-400 mt-4">{form.companies.name}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Company header */}
          {form.companies && (
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
              {form.companies.logo_url && (
                <Image src={form.companies.logo_url} alt={form.companies.name} width={48} height={48} className="rounded object-contain" />
              )}
              <p className="font-semibold text-gray-700">{form.companies.name}</p>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{form.name}</h1>
          {form.description && <p className="text-gray-500 text-sm mb-6">{form.description}</p>}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            {(form.fields || []).map((field, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea rows={4} required={field.required}
                    value={values[field.label] || ''}
                    onChange={e => setValues({ ...values, [field.label]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                ) : field.type === 'select' ? (
                  <select required={field.required} value={values[field.label] || ''}
                    onChange={e => setValues({ ...values, [field.label]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select...</option>
                    {(field.options || []).map((o, j) => <option key={j} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox"
                      checked={values[field.label] === 'true'}
                      onChange={e => setValues({ ...values, [field.label]: e.target.checked ? 'true' : 'false' })}
                      className="rounded border-gray-300 text-indigo-600" />
                    {field.label}
                  </label>
                ) : (
                  <input type={field.type} required={field.required}
                    value={values[field.label] || ''}
                    onChange={e => setValues({ ...values, [field.label]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
              </div>
            ))}
            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium mt-2">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
