'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../../layout'
import { supabase } from '@/lib/supabase'

type Category = { id: string; name: string; type: 'income' | 'expense' | 'donation' | 'all'; color: string }

const COLORS = ['#6366f1','#22c55e','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b']

export default function CategoriesPage() {
  const { user } = useContext(CompanyContext)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'all' as Category['type'], color: COLORS[0] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('personal_categories').select('*').eq('user_id', user.id).order('name')
      .then(({ data }) => { setCategories((data || []) as Category[]); setLoading(false) })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { data, error } = await supabase.from('personal_categories').insert([{ ...form, user_id: user.id }]).select().single()
    if (!error && data) setCategories(prev => [...prev, data as Category])
    setShowForm(false)
    setForm({ name: '', type: 'all', color: COLORS[0] })
    setSaving(false)
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage custom categories for personal transactions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Category
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {['Food','Gas','Rent','Utilities','Entertainment','Healthcare','Clothing','Education','Travel','Donation'].map(name => (
            <div key={name} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-100 dark:border-gray-700">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <span className="text-lg">
                  {name === 'Food' ? '🍽️' : name === 'Gas' ? '⛽' : name === 'Rent' ? '🏠' : name === 'Utilities' ? '💡' :
                   name === 'Entertainment' ? '🎬' : name === 'Healthcare' ? '🏥' : name === 'Clothing' ? '👕' :
                   name === 'Education' ? '📚' : name === 'Travel' ? '✈️' : '🙏'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Built-in</p>
              </div>
            </div>
          ))}
          {categories.map(cat => (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-100 dark:border-gray-700 group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '30' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cat.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{cat.type}</p>
              </div>
              <button onClick={() => handleDelete(cat.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Category</h2>
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
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
