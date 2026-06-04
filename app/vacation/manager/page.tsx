'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  vacation_days_allowed: number
}

interface VacationRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  total_days: number
  total_hours: number
  request_type: string
  status: string
  notes: string | null
  review_notes: string | null
  created_at: string
  vacation_profiles: { full_name: string; email: string } | null
}

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="12" fill="#0A2342"/>
      <path d="M18 75 L18 30 L35 30 L50 58 L65 30 L82 30 L82 75 L70 75 L70 50 L55 75 L45 75 L30 50 L30 75 Z" fill="#C9A84C"/>
      <path d="M20 82 L80 82" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

type Tab = 'overview' | 'requests' | 'team'

function Sidebar({ tab, setTab, name, onSignOut }: { tab: Tab; setTab: (t: Tab) => void; name: string; onSignOut: () => void }) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'team', label: 'My Team', icon: '👥' },
    { id: 'requests', label: 'Requests', icon: '📋' },
  ]
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: '#0A2342', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <Logo size={36} />
        <div>
          <div className="text-white font-bold text-sm">Mister Abstract</div>
          <div className="text-xs" style={{ color: '#C9A84C' }}>Manager Panel</div>
        </div>
      </div>
      <div className="px-6 py-3 border-b border-white/10">
        <div className="text-xs text-blue-300">Signed in as</div>
        <div className="text-sm text-white font-medium truncate">{name}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition"
            style={{
              background: tab === item.id ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: tab === item.id ? '#C9A84C' : 'rgba(255,255,255,0.7)',
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-900/20 transition"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${s[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

export default function ManagerPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [team, setTeam] = useState<Profile[]>([])
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('vacation_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setMyProfile(profile)

    // All team members + all requests (managers can see all)
    const [{ data: allProfiles }, { data: allRequests }] = await Promise.all([
      supabase.from('vacation_profiles').select('*').order('full_name'),
      supabase.from('vacation_requests').select('*, vacation_profiles(full_name, email)').order('created_at', { ascending: false }),
    ])

    setTeam(allProfiles?.filter(p => p.role === 'employee') ?? [])
    setRequests(allRequests ?? [])
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

  const handleRequest = async (reqId: string, status: 'approved' | 'rejected') => {
    setActionLoading(reqId)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('vacation_requests')
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', reqId)
    if (error) showToast('Failed to update', 'error')
    else { showToast(`Request ${status}`); loadData() }
    setActionLoading(null)
  }

  const teamWithBalance = team.map(p => {
    const used = requests
      .filter(r => r.user_id === p.id && r.status === 'approved')
      .reduce((s, r) => s + r.total_days, 0)
    return { ...p, days_used: used, days_remaining: p.vacation_days_allowed - used }
  })

  const pendingRequests = requests.filter(r => r.status === 'pending')

  const renderOverview = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>Team Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Team Members', value: team.length, icon: '👥' },
          { label: 'Pending Requests', value: pendingRequests.length, icon: '⏳' },
          { label: 'Approved This Month', value: requests.filter(r => r.status === 'approved' && r.start_date.startsWith(new Date().toISOString().slice(0,7))).length, icon: '✅' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="text-3xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-bold" style={{ color: '#0A2342' }}>{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Pending Approvals</h3>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-400">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-yellow-50 rounded-lg px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">{req.vacation_profiles?.full_name ?? '—'}</div>
                  <div className="text-xs text-gray-500">
                    {req.start_date} → {req.end_date} · {req.total_days}d / {req.total_hours}h · {req.request_type}
                  </div>
                  {req.notes && <div className="text-xs text-gray-400 italic mt-0.5">&quot;{req.notes}&quot;</div>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRequest(req.id, 'approved')}
                    disabled={actionLoading === req.id}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                  >✓ Approve</button>
                  <button
                    onClick={() => handleRequest(req.id, 'rejected')}
                    disabled={actionLoading === req.id}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                  >✗ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderTeam = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>My Team</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Allowed</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Used</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : teamWithBalance.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-800">{p.full_name}</div>
                  <div className="text-xs text-gray-400">{p.email}</div>
                </td>
                <td className="px-5 py-3 text-gray-600">{p.vacation_days_allowed}d</td>
                <td className="px-5 py-3 text-gray-600">{p.days_used.toFixed(1)}d</td>
                <td className="px-5 py-3">
                  <span className={`font-semibold ${p.days_remaining < 3 ? 'text-red-500' : 'text-green-600'}`}>
                    {p.days_remaining.toFixed(1)}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderRequests = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>All Requests</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-800">{req.vacation_profiles?.full_name ?? '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{req.start_date} → {req.end_date}</td>
                  <td className="px-5 py-3 text-gray-600">{req.total_days}d / {req.total_hours}h</td>
                  <td className="px-5 py-3 capitalize text-gray-600">{req.request_type}</td>
                  <td className="px-5 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-5 py-3">
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleRequest(req.id, 'approved')} disabled={actionLoading === req.id}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">Approve</button>
                        <button onClick={() => handleRequest(req.id, 'rejected')} disabled={actionLoading === req.id}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar tab={tab} setTab={setTab} name={myProfile?.full_name ?? '…'} onSignOut={handleSignOut} />
      <main className="flex-1 p-8 overflow-auto">
        {tab === 'overview' && renderOverview()}
        {tab === 'team' && renderTeam()}
        {tab === 'requests' && renderRequests()}
      </main>
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
