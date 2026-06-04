'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getHolidaysForRange, countWorkingDays, type JewishHoliday } from '@/lib/jewish-holidays'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  vacation_days_allowed: number
}

interface VacationRequest {
  id: string
  start_date: string
  end_date: string
  total_days: number
  total_hours: number
  request_type: string
  status: string
  notes: string | null
  created_at: string
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="12" fill="#0A2342"/>
      <path d="M18 75 L18 30 L35 30 L50 58 L65 30 L82 30 L82 75 L70 75 L70 50 L55 75 L45 75 L30 50 L30 75 Z" fill="#C9A84C"/>
      <path d="M20 82 L80 82" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${s[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

interface CalendarDay {
  dateStr: string
  date: Date
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  holiday: JewishHoliday | null
  requestStatus: 'approved' | 'pending' | 'rejected' | null
}

function buildCalendar(year: number, month: number, holidays: JewishHoliday[], requests: VacationRequest[]): CalendarDay[][] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()

  const days: CalendarDay[] = []

  // Pad start
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i))
    days.push(makeDay(d, false, today, holidays, requests))
  }
  // Month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(makeDay(new Date(year, month, d), true, today, holidays, requests))
  }
  // Pad end to complete last week
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date
    const next = new Date(last)
    next.setDate(next.getDate() + 1)
    days.push(makeDay(next, false, today, holidays, requests))
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

function makeDay(date: Date, inMonth: boolean, today: Date, holidays: JewishHoliday[], requests: VacationRequest[]): CalendarDay {
  const dateStr = date.toISOString().split('T')[0]
  const holiday = holidays.find(h => h.date === dateStr) ?? null
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6

  let requestStatus: CalendarDay['requestStatus'] = null
  for (const req of requests) {
    if (dateStr >= req.start_date && dateStr <= req.end_date) {
      requestStatus = req.status as CalendarDay['requestStatus']
      break
    }
  }

  return {
    dateStr,
    date,
    inMonth,
    isToday: date.getTime() === today.getTime(),
    isWeekend,
    holiday,
    requestStatus,
  }
}

function MiniCalendar({
  year, month, holidays, requests,
  onDateClick, selectedStart, selectedEnd,
}: {
  year: number; month: number; holidays: JewishHoliday[]; requests: VacationRequest[]
  onDateClick: (d: string) => void; selectedStart: string; selectedEnd: string
}) {
  const weeks = buildCalendar(year, month, holidays, requests)
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const isInSelection = (dateStr: string) => {
    if (!selectedStart) return false
    if (selectedEnd) return dateStr >= selectedStart && dateStr <= selectedEnd
    return dateStr === selectedStart
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-7">
        {DOW.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-t border-gray-50">
          {week.map(day => {
            const inSel = isInSelection(day.dateStr)
            const isStart = day.dateStr === selectedStart
            const isEnd = day.dateStr === selectedEnd

            let bg = ''
            let textColor = day.inMonth ? 'text-gray-700' : 'text-gray-300'

            if (day.isToday) { bg = 'bg-yellow-50'; textColor = 'text-yellow-700 font-bold' }
            if (day.holiday?.isYomTov) { bg = 'bg-blue-50'; textColor = 'text-blue-700' }
            if (day.requestStatus === 'approved') { bg = 'bg-green-100'; textColor = 'text-green-700' }
            if (day.requestStatus === 'pending') { bg = 'bg-yellow-100'; textColor = 'text-yellow-700' }
            if (inSel) { bg = 'bg-indigo-100'; textColor = 'text-indigo-700' }
            if (isStart || isEnd) { bg = 'bg-indigo-600'; textColor = 'text-white' }

            return (
              <button
                key={day.dateStr}
                onClick={() => day.inMonth && onDateClick(day.dateStr)}
                disabled={!day.inMonth}
                title={day.holiday ? day.holiday.name : undefined}
                className={`relative aspect-square flex flex-col items-center justify-center text-xs transition hover:bg-indigo-50 disabled:cursor-default ${bg} ${textColor}`}
              >
                <span className={`font-medium ${day.isWeekend && !inSel && !day.holiday?.isYomTov ? 'text-gray-400' : ''}`}>
                  {day.date.getDate()}
                </span>
                {day.holiday && (
                  <div className="absolute bottom-0.5 left-0 right-0 flex justify-center">
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                  </div>
                )}
                {day.requestStatus && !inSel && (
                  <div className="absolute bottom-0.5 left-0 right-0 flex justify-center">
                    <div className={`w-1 h-1 rounded-full ${day.requestStatus === 'approved' ? 'bg-green-500' : day.requestStatus === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Request Form ─────────────────────────────────────────────────────────────

function RequestForm({
  profileId, holidays, daysRemaining,
  onSuccess, onCancel,
}: {
  profileId: string; holidays: JewishHoliday[]; daysRemaining: number
  onSuccess: () => void; onCancel: () => void
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [requestType, setRequestType] = useState('vacation')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculated = startDate && endDate && endDate >= startDate
    ? countWorkingDays(new Date(startDate), new Date(endDate), holidays, parseFloat(hoursPerDay) || 8)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) { setError('Select start and end dates'); return }
    if (endDate < startDate) { setError('End date must be after start date'); return }
    if (!calculated || calculated.days === 0) { setError('No working days in selected range (weekends/holidays excluded)'); return }
    if (calculated.days > daysRemaining) { setError(`You only have ${daysRemaining.toFixed(1)} days remaining`); return }

    setLoading(true)
    setError(null)
    const { error: dbErr } = await supabase.from('vacation_requests').insert({
      user_id: profileId,
      start_date: startDate,
      end_date: endDate,
      hours_per_day: parseFloat(hoursPerDay) || 8,
      total_days: calculated.days,
      total_hours: calculated.hours,
      request_type: requestType,
      notes: notes || null,
    })
    if (dbErr) setError(dbErr.message)
    else onSuccess()
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-4">New Time-Off Request</h3>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required min={startDate}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hours Per Day</label>
            <select value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
              <option value="8">8 hours (full day)</option>
              <option value="4">4 hours (half day)</option>
              <option value="6">6 hours</option>
              <option value="2">2 hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
            <select value={requestType} onChange={e => setRequestType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Day</option>
            </select>
          </div>
        </div>

        {/* Calculation preview */}
        {calculated && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-800">Working days (excl. weekends &amp; Jewish holidays):</span>
              <span className="text-indigo-900 font-bold text-lg">{calculated.days}d / {calculated.hours}h</span>
            </div>
            {calculated.days > daysRemaining && (
              <div className="text-red-600 text-xs mt-1 font-semibold">
                ⚠ Exceeds your remaining balance ({daysRemaining.toFixed(1)}d)
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional context…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !calculated || calculated.days > daysRemaining}
            className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: '#0A2342' }}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-6 py-2.5 rounded-lg text-gray-600 border border-gray-200 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EmployeePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [holidays, setHolidays] = useState<JewishHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selStart, setSelStart] = useState('')
  const [selEnd, setSelEnd] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: reqs }] = await Promise.all([
      supabase.from('vacation_profiles').select('*').eq('id', user.id).single(),
      supabase.from('vacation_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    setProfile(prof)
    setRequests(reqs ?? [])

    const yr = new Date().getFullYear()
    setHolidays(getHolidaysForRange(yr - 1, yr + 2))
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/vacation/login')
      else loadData()
    })
  }, [router, loadData])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/vacation/login')
  }

  const handleDateClick = (dateStr: string) => {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(dateStr); setSelEnd('')
    } else {
      if (dateStr < selStart) { setSelEnd(selStart); setSelStart(dateStr) }
      else setSelEnd(dateStr)
    }
  }

  const handleRequestSuccess = () => {
    setShowForm(false); setSelStart(''); setSelEnd('')
    showToast('Request submitted — awaiting approval')
    loadData()
  }

  const handleCancel = async (reqId: string) => {
    await supabase.from('vacation_requests').delete().eq('id', reqId)
    showToast('Request cancelled')
    loadData()
  }

  const daysUsed = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.total_days, 0)
  const daysRemaining = (profile?.vacation_days_allowed ?? 0) - daysUsed
  const daysAllowed = profile?.vacation_days_allowed ?? 0

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  // Holidays this month
  const monthHolidays = holidays.filter(h => h.date.startsWith(`${calYear}-${String(calMonth + 1).padStart(2, '0')}`))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f9fa' }}>
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <div>
            <div className="font-bold text-sm" style={{ color: '#0A2342' }}>Mister Abstract</div>
            <div className="text-xs text-gray-400">Vacation Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Welcome, <span className="font-semibold">{profile?.full_name ?? '…'}</span>
          </span>
          <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-red-500 transition">Sign out</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Days Allowed', value: daysAllowed, icon: '📅', color: '#0A2342' },
            { label: 'Days Used', value: daysUsed.toFixed(1), icon: '✅', color: '#1a3a5c' },
            { label: 'Days Remaining', value: daysRemaining.toFixed(1), icon: '🌟', color: daysRemaining < 3 ? '#dc2626' : '#16a34a' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{stat.label}</span>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              {stat.label === 'Days Remaining' && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (daysRemaining / daysAllowed) * 100))}%`,
                      background: daysRemaining < 3 ? '#dc2626' : '#16a34a',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Calendar header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#0A2342' }}>
                {MONTHS[calMonth]} {calYear}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 transition">‹</button>
                <button onClick={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }}
                  className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Today</button>
                <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 transition">›</button>
              </div>
            </div>

            <MiniCalendar
              year={calYear} month={calMonth}
              holidays={holidays} requests={requests}
              onDateClick={handleDateClick}
              selectedStart={selStart} selectedEnd={selEnd}
            />

            {/* Calendar legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {[
                { color: 'bg-blue-500', label: 'Jewish Holiday' },
                { color: 'bg-green-500', label: 'Approved Time Off' },
                { color: 'bg-yellow-500', label: 'Pending Request' },
                { color: 'bg-indigo-600', label: 'Selected Range' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>

            {/* Quick select from calendar hint */}
            {selStart && !selEnd && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700">
                Start: <strong>{selStart}</strong> — click another date to set end, or{' '}
                <button onClick={() => setShowForm(true)} className="underline font-semibold">request this day</button>
              </div>
            )}
            {selStart && selEnd && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700 flex items-center justify-between">
                <span>Range: <strong>{selStart}</strong> → <strong>{selEnd}</strong></span>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-3 py-1 rounded-lg text-white text-xs font-semibold"
                  style={{ background: '#0A2342' }}
                >
                  Request these dates
                </button>
              </div>
            )}

            {/* Request form */}
            {showForm && profile && (
              <RequestForm
                profileId={profile.id}
                holidays={holidays}
                daysRemaining={daysRemaining}
                onSuccess={handleRequestSuccess}
                onCancel={() => setShowForm(false)}
              />
            )}

            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style={{ background: '#0A2342' }}
              >
                + New Time-Off Request
              </button>
            )}
          </div>

          {/* Right column: holidays + requests */}
          <div className="space-y-4">
            {/* Jewish holidays this month */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>✡️</span> Jewish Holidays
                <span className="text-xs text-gray-400 font-normal">{MONTHS[calMonth]}</span>
              </h3>
              {monthHolidays.length === 0 ? (
                <p className="text-xs text-gray-400">No holidays this month.</p>
              ) : (
                <div className="space-y-2">
                  {monthHolidays.map(h => (
                    <div key={h.date} className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-gray-700">{h.name}</div>
                        <div className="text-xs text-gray-400">{h.date}</div>
                      </div>
                      {h.isYomTov && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          No Work
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My requests */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3">My Requests</h3>
              {requests.length === 0 ? (
                <p className="text-xs text-gray-400">No requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests.slice(0, 8).map(req => (
                    <div key={req.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-gray-400 capitalize">{req.request_type}</span>
                      </div>
                      <div className="text-xs text-gray-600 font-medium">
                        {req.start_date} → {req.end_date}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {req.total_days}d / {req.total_hours}h
                      </div>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="mt-2 text-xs text-red-400 hover:text-red-600 hover:underline"
                        >
                          Cancel request
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-5 py-3 rounded-xl bg-green-600 text-white text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
