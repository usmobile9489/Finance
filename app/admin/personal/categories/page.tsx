'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../../layout'
import { supabase } from '@/lib/supabase'

type Category = { id: string; name: string; type: 'income' | 'expense' | 'donation' | 'all'; color: string }

const COLORS = ['#6366f1','#22c55e','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b']

// Default categories seeded once per user — after that they're fully editable rows.
const DEFAULTS: { name: string; type: Category['type']; color: string }[] = [
  { name: 'Food', type: 'expense', color: '#f97316' },
  { name: 'Gas', type: 'expense', color: '#64748b' },
  { name: 'Rent', type: 'expense', color: '#ef4444' },
  { name: 'Utilities', type: 'expense', color: '#f59e0b' },
  { name: 'Entertainment', type: 'expense', color: '#8b5cf6' },
  { name: 'Healthcare', type: 'expense', color: '#14b8a6' },
  { name: 'Clothing', type: 'expense', color: '#ec4899' },
  { name: 'Education', type: 'expense', color: '#6366f1' },
  { name: 'Travel', type: 'expense', color: '#22c55e' },
  { name: 'Donation', type: 'donation', color: '#8b5cf6' },
  { name: 'Other', type: 'all', color: '#64748b' },
]

const emptyForm = { id: '', name: '', type: 'all' as Category['type'], color: COLORS[0] }

export default function CategoriesPage() {
  const { user } = useContext(CompanyContext)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('personal_categories').select('*').eq('user_id', user!.id).order('name')
    let rows = (data || []) as Category[]
    // First visit: seed the built-in categories so they become editable.
    if (rows.length === 0) {
      const { data: seeded } = await supabase.from('personal_categories')
        .insert(DEFAULTS.map(d => ({ ...d, user_id: user!.id }))).select()
      rows = (seeded || []) as Category[]
      rows.sort((a, b) => a.name.localeCompare(b.name))
    }
    setCategories(rows)
    setLoading(false)
  }

  const openCreate = () => { setForm(emptyForm); setShowForm(true) }
  const openEdit = (c: Category) => { setForm({ id: c.id, name: c.name, type: c.type, color: c.color }); setShowForm(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    if (form.id) {
      const { data } = await supabase.from('personal_categories')
        .update({ name: form.name, type: form.type, color: form.color }).eq('id', form.id).select().single()
      if (data) setCategories(prev => prev.map(c => c.id === form.id ? (data as Category) : c).sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      const { data } = await supabase.from('personal_categories')
        .insert([{ name: form.name, type: form.type, color: form.color, user_id: user.id }]).select().single()
      if (data) setCategories(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setShowForm(false); setForm(emptyForm); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    await supabase.from('personal_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Edit, recolor or remove any category — including the built-in ones</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Category
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-100 dark:border-gray-700 group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '30' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cat.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{cat.type}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => openEdit(cat)} className="text-gray-300 dark:text-gray-600 hover:text-indigo-500" title="Edit">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(cat.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500" title="Delete">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{form.id ? 'Edit Category' : 'New Category'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Category name *" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Category['type'] })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">All types</option>
                <option value="income">Income only</option>
                <option value="expense">Expense only</option>
                <option value="donation">Donation only</option>
              </select>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Save'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
