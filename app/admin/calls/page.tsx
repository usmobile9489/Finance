'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { pbx, MissedCall, getVoicemailUrl, fmtPhone, fmtDate, fmtTime, fmtDuration } from '@/lib/pbx'

type Filter = 'all' | 'unread' | 'voicemail'

export default function CallsPage() {
  const [calls, setCalls] = useState<MissedCall[]>([])
  const [filtered, setFiltered] = useState<MissedCall[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [parsha, setParsha] = useState('all')
  const [parshas, setParshas] = useState<string[]>([])
  const [playing, setPlaying] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await pbx.from('missed_calls').select('*').order('call_datetime', { ascending: false }).limit(500)
    const d = (data || []) as MissedCall[]
    setCalls(d)
    setParshas([...new Set(d.map(c => c.parsha_name).filter(Boolean))] as string[])
    setSelected(new Set())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let r = [...calls]
    if (filter === 'unread') r = r.filter(c => !c.is_read)
    if (filter === 'voicemail') r = r.filter(c => c.has_voicemail && !c.voicemail_deleted)
    if (parsha !== 'all') r = r.filter(c => c.parsha_name === parsha)
    if (search) {
      const s = search.replace(/\D/g, '')
      r = r.filter(c => c.caller_number.includes(s) || (c.caller_name || '').toLowerCase().includes(search.toLowerCase()))
    }
    if (dateFrom) r = r.filter(c => new Date(c.call_datetime) >= new Date(dateFrom))
    if (dateTo) r = r.filter(c => new Date(c.call_datetime) <= new Date(dateTo + 'T23:59:59'))
    setFiltered(r)
    setSelected(new Set())
  }, [calls, filter, parsha, search, dateFrom, dateTo])

  async function markRead(ids: string[]) {
    await pbx.from('missed_calls').update({ is_read: true, status: 'handled', handled_at: new Date().toISOString() }).in('id', ids)
    setCalls(prev => prev.map(c => ids.includes(c.id) ? { ...c, is_read: true } : c))
    setSelected(new Set())
  }

  async function deleteVoicemail(call: MissedCall) {
    if (!confirm('Delete this voicemail?')) return
    if (playing === call.id) { audioRef.current?.pause(); setPlaying(null) }
    await pbx.from('missed_calls').update({ voicemail_deleted: true, has_voicemail: false, voicemail_file: null, voicemail_duration: null }).eq('id', call.id)
    setCalls(prev => prev.map(c => c.id === call.id ? { ...c, has_voicemail: false, voicemail_deleted: true, voicemail_file: null, voicemail_duration: null } : c))
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function playVM(call: MissedCall) {
    if (!call.voicemail_file) return
    if (playing === call.id) { audioRef.current?.pause(); setPlaying(null); return }
    audioRef.current?.pause()
    const url = getVoicemailUrl(call)
    if (!url) return
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlaying(null)
    audio.onerror = () => { setPlaying(null); alert('Cannot play voicemail.') }
    audio.play()
    setPlaying(call.id)
  }

  function exportCSV() {
    const headers = ['Phone', 'Name', 'Date', 'Time', 'Voicemail', 'Duration', 'Parsha']
    const rows = filtered.map(c => [
      c.caller_number, c.caller_name || '', fmtDate(c.call_datetime), fmtTime(c.call_datetime),
      c.has_voicemail && !c.voicemail_deleted ? 'Yes' : 'No',
      c.voicemail_duration ? fmtDuration(c.voicemail_duration) : '', c.parsha_name || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `missed_calls_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const unread = calls.filter(c => !c.is_read).length
  const withVm = calls.filter(c => c.has_voicemail && !c.voicemail_deleted).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Missed Calls</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filtered.length} call{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
            Export
          </button>
          <button onClick={load} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: calls.length, active: filter === 'all', onClick: () => setFilter('all') },
          { label: 'Unread', value: unread, active: filter === 'unread', onClick: () => setFilter('unread') },
          { label: 'Voicemails', value: withVm, active: filter === 'voicemail', onClick: () => setFilter('voicemail') },
        ].map(s => (
          <button key={s.label} onClick={s.onClick}
            className={`text-left rounded-xl border p-4 transition-colors ${
              s.active
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              s.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'
            }`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search number or name..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {parshas.length > 0 && (
            <select value={parsha} onChange={e => setParsha(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Parshas</option>
              {parshas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date"
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date"
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-2 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{selected.size} selected</span>
          <button onClick={() => markRead([...selected])} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Mark Read</button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">Cancel</button>
        </div>
      )}

      {/* Call List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="ml-3 text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📵</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No calls found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(call => {
            const hasVm = call.has_voicemail && !call.voicemail_deleted
            const isPlaying = playing === call.id
            const isSel = selected.has(call.id)
            const isExpanded = expanded === call.id

            return (
              <div key={call.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border transition-colors ${
                  isSel ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
                  : !call.is_read ? 'border-blue-200 dark:border-blue-800/50'
                  : 'border-gray-200 dark:border-gray-700'
                }`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : call.id)}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSel}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleSelect(call.id)}
                    className="rounded shrink-0" />

                  {/* Unread dot */}
                  <div className="w-2 shrink-0">
                    {!call.is_read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>

                  {/* Caller info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a href={`tel:${call.caller_number}`}
                        onClick={e => e.stopPropagation()}
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 font-mono">
                        {fmtPhone(call.caller_number)}
                      </a>
                      {hasVm && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 uppercase">
                          vm{call.voicemail_duration ? ` ${fmtDuration(call.voicemail_duration)}` : ''}
                        </span>
                      )}
                    </div>
                    {call.caller_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{call.caller_name.replace(/^MC\s*-\s*/, '')}</p>
                    )}
                  </div>

                  {/* Date/time + parsha */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{fmtDate(call.call_datetime)}</p>
                    <p className="text-xs text-gray-400 font-mono">{fmtTime(call.call_datetime)}</p>
                  </div>
                  <div className="text-right shrink-0 sm:hidden">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(call.call_datetime)}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{fmtTime(call.call_datetime)}</p>
                  </div>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700/50">
                    <div className="flex flex-wrap items-center gap-2 pt-3">
                      {/* Parsha badge */}
                      {call.parsha_name && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {call.parsha_name}
                        </span>
                      )}

                      {/* Notes */}
                      {call.notes && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">{call.notes}</span>
                      )}

                      <div className="flex-1" />

                      {/* Action buttons */}
                      <a href={`tel:${call.caller_number}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                        📞 Call Back
                      </a>

                      {hasVm && (
                        <button onClick={() => playVM(call)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium ${
                            isPlaying
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          }`}>
                          {isPlaying ? '■ Stop' : '▶ Play VM'}
                        </button>
                      )}

                      {hasVm && (
                        <button onClick={() => deleteVoicemail(call)} title="Delete voicemail"
                          className="px-2 py-1.5 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          🗑
                        </button>
                      )}

                      {!call.is_read && (
                        <button onClick={() => markRead([call.id])}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">
                          ✓ Read
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
