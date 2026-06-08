'use client'

import { useState } from 'react'
import { useCompany } from './layout'
import { supabase } from '@/lib/supabase'

// Floating "+" quick-entry: pick scope, amount, type → saved in 2 taps.
export default function QuickAdd() {
  const { companies, user } = useCompany()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<string>('personal') // 'personal' | company.id
  const [type, setType] = useState<'income' | 'expense' | 'donation'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPersonal = scope === 'personal'

  const reset = () => { setAmount(''); setDescription(''); setType('expense'); setDone(false); setError(null) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter an amount'); return }
    setSaving(true); setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      if (isPersonal) {
        const { error } = await supabase.from('personal_transactions').insert([{
          user_id: user.id, date: today, amount: amt, type,
          category: 'Quick Add', description: description || 'Quick add', tags: [],
        }])
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').insert([{
          company_id: scope, amount: amt, type: type === 'donation' ? 'expense' : type,
          description: description || 'Quick add', transaction_date: today, tags: [],
        }])
        if (error) throw error
      }
      setDone(true)
      setAmount(''); setDescription('')
      setTimeout(() => { setOpen(false); setDone(false) }, 1100)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <>
      {/* Floating button */}
      <button onClick={() => { reset(); setOpen(true) }}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 flex items-center justify-center text-3xl leading-none print:hidden"
        title="Quick add">
        +
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 py-6" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick Add</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            {done ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-gray-700 dark:text-gray-200 font-medium">Saved!</p>
              </div>
            ) : (
              <form onSubmit={save} className="space-y-3">
                {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Add to</label>
                  <select value={scope} onChange={e => { setScope(e.target.value); if (e.target.value !== 'personal' && type === 'donation') setType('expense') }}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="personal">💳 Personal</option>
                    {companies.filter(c => c.kind !== 'personal').map(c => <option key={c.id} value={c.id}>🏢 {c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <div className="flex gap-2">
                    {(isPersonal ? ['expense', 'income', 'donation'] : ['expense', 'income'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setType(t as typeof type)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
                          type === t
                            ? t === 'income' ? 'bg-green-600 border-green-600 text-white' : t === 'expense' ? 'bg-red-500 border-red-500 text-white' : 'bg-purple-600 border-purple-600 text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount *</label>
                  <input type="number" step="0.01" min="0" autoFocus placeholder="0.00" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <input type="text" placeholder="Optional" value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <button type="submit" disabled={saving}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
