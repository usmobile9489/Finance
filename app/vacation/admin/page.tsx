'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllowedEmail {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'employee'
  vacation_days_allowed: number
  created_at: string
}

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'employee'
  vacation_days_allowed: number
  department: string | null
  hire_date: string | null
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

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'requests' | 'invite'

function Sidebar({ tab, setTab, onSignOut }: { tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Manage Users', icon: '👥' },
    { id: 'requests', label: 'All Requests', icon: '📋' },
    { id: 'invite', label: 'Add / Invite User', icon: '➕' },
  ]
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: '#0A2342', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <Logo size={36} />
        <div>
          <div className="text-white font-bold text-sm">Mister Abstract</div>
          <div className="text-xs" style={{ color: '#C9A84C' }}>Admin Panel</div>
        </div>
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

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    employee: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([])
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'employee'>('employee')
  const [inviteDays, setInviteDays] = useState('15')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Edit-days inline state
  const [editingDays, setEditingDays] = useState<{ id: string; value: string } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: profs }, { data: emails }, { data: reqs }] = await Promise.all([
      supabase.from('vacation_profiles').select('*').order('full_name'),
      supabase.from('vacation_allowed_emails').select('*').order('created_at', { ascending: false }),
      supabase
        .from('vacation_requests')
        .select('*, vacation_profiles(full_name, email)')
        .order('created_at', { ascending: false }),
    ])
    setProfiles(profs ?? [])
    setAllowedEmails(emails ?? [])
    setRequests(reqs ?? [])
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

  const handleRoleChange = async (profileId: string, newRole: string) => {
    setActionLoading(profileId)
    const { error } = await supabase
      .from('vacation_profiles')
      .update({ role: newRole })
      .eq('id', profileId)
    if (error) showToast('Failed to update role', 'error')
    else { showToast('Role updated'); loadData() }
    setActionLoading(null)
  }

  const handleDaysSave = async (profileId: string, days: string) => {
    const d = parseFloat(days)
    if (isNaN(d) || d < 0) { showToast('Invalid number of days', 'error'); return }
    setActionLoading(profileId)
    const { error } = await supabase
      .from('vacation_profiles')
      .update({ vacation_days_allowed: d })
      .eq('id', profileId)
    if (error) showToast('Failed to update days', 'error')
    else { showToast('Days updated'); setEditingDays(null); loadData() }
    setActionLoading(null)
  }

  const handleRequest = async (reqId: string, status: 'approved' | 'rejected', note: string = '') => {
    setActionLoading(reqId)
    const { data: me } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('vacation_requests')
      .update({ status, reviewed_by: me.user?.id, reviewed_at: new Date().toISOString(), review_notes: note || null })
      .eq('id', reqId)
    if (error) showToast('Failed to update request', 'error')
    else { showToast(`Request ${status}`); loadData() }
    setActionLoading(null)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    const { error } = await supabase.from('vacation_allowed_emails').insert({
      email: inviteEmail.toLowerCase(),
      full_name: inviteName,
      role: inviteRole,
      vacation_days_allowed: parseFloat(inviteDays) || 15,
    })
    if (error) showToast(error.message, 'error')
    else {
      showToast(`${inviteName} added — they can now sign up`)
      setInviteEmail(''); setInviteName(''); setInviteRole('employee'); setInviteDays('15')
      loadData()
    }
    setInviteLoading(false)
  }

  const handleRemoveInvite = async (id: string) => {
    const { error } = await supabase.from('vacation_allowed_emails').delete().eq('id', id)
    if (error) showToast('Failed to remove', 'error')
    else { showToast('Removed'); loadData() }
  }

  // ── Stats ──
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const totalUsers = profiles.length

  const usersWithBalance = profiles.map(p => {
    const approved = requests
      .filter(r => r.user_id === p.id && r.status === 'approved')
      .reduce((sum, r) => sum + r.total_days, 0)
    return { ...p, days_used: approved, days_remaining: p.vacation_days_allowed - approved }
  })

  // ─── Render panels ─────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: totalUsers, color: '#0A2342', icon: '👥' },
          { label: 'Pending Requests', value: pendingCount, color: '#C9A84C', icon: '⏳' },
          { label: 'Authorized Emails', value: allowedEmails.length, color: '#1a3a5c', icon: '📧' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="text-3xl">{stat.icon}</div>
            <div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending requests summary */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Pending Requests</h3>
        {requests.filter(r => r.status === 'pending').length === 0 ? (
          <p className="text-sm text-gray-400">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.filter(r => r.status === 'pending').map(req => (
              <div key={req.id} className="flex items-center justify-between bg-yellow-50 rounded-lg px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">
                    {req.vacation_profiles?.full_name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {req.start_date} → {req.end_date} · {req.total_days}d / {req.total_hours}h
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

  const renderUsers = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>Manage Users</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name / Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Allowed Days</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Used</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : usersWithBalance.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No users yet.</td></tr>
              ) : (
                usersWithBalance.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{p.full_name}</div>
                      <div className="text-xs text-gray-400">{p.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={p.role}
                        onChange={e => handleRoleChange(p.id, e.target.value)}
                        disabled={actionLoading === p.id}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      {editingDays?.id === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={editingDays.value}
                            onChange={e => setEditingDays({ id: p.id, value: e.target.value })}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
                            min="0"
                            step="0.5"
                          />
                          <button
                            onClick={() => handleDaysSave(p.id, editingDays.value)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                          >✓</button>
                          <button
                            onClick={() => setEditingDays(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs"
                          >✗</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingDays({ id: p.id, value: String(p.vacation_days_allowed) })}
                          className="flex items-center gap-1 text-sm font-semibold hover:underline"
                          style={{ color: '#0A2342' }}
                        >
                          {p.vacation_days_allowed}d
                          <span className="text-gray-400 text-xs">✏️</span>
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.days_used.toFixed(1)}d</td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold text-sm ${p.days_remaining < 3 ? 'text-red-500' : 'text-green-600'}`}>
                        {p.days_remaining.toFixed(1)}d
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time Off</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No requests yet.</td></tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{req.vacation_profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{req.vacation_profiles?.email}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {req.start_date} → {req.end_date}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {req.total_days}d / {req.total_hours}h
                    </td>
                    <td className="px-5 py-3 capitalize text-gray-600">{req.request_type}</td>
                    <td className="px-5 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-5 py-3">
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRequest(req.id, 'approved')}
                            disabled={actionLoading === req.id}
                            className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                          >Approve</button>
                          <button
                            onClick={() => handleRequest(req.id, 'rejected')}
                            disabled={actionLoading === req.id}
                            className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                          >Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderInvite = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold" style={{ color: '#0A2342' }}>Add / Invite User</h2>

      {/* Invite form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Authorize New Account</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                required
                placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                placeholder="jane@misterabstract.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'manager' | 'employee')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vacation Days Allowed</label>
              <input
                type="number"
                value={inviteDays}
                onChange={e => setInviteDays(e.target.value)}
                min="0"
                step="0.5"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={inviteLoading}
            className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: '#0A2342' }}
          >
            {inviteLoading ? 'Adding…' : '+ Add User'}
          </button>
        </form>
      </div>

      {/* Authorized emails list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Authorized Sign-ups ({allowedEmails.length})</h3>
        </div>
        {allowedEmails.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No authorized emails yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {allowedEmails.map(ae => {
              const hasAccount = profiles.some(p => p.email === ae.email)
              return (
                <div key={ae.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{ae.full_name}</span>
                      <RoleBadge role={ae.role} />
                      {hasAccount && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                          ✓ Signed Up
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{ae.email} · {ae.vacation_days_allowed}d allowed</div>
                  </div>
                  {!hasAccount && (
                    <button
                      onClick={() => handleRemoveInvite(ae.id)}
                      className="text-red-400 hover:text-red-600 text-xs px-3 py-1 rounded hover:bg-red-50 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar tab={tab} setTab={setTab} onSignOut={handleSignOut} />

      <main className="flex-1 p-8 overflow-auto">
        {tab === 'overview' && renderOverview()}
        {tab === 'users' && renderUsers()}
        {tab === 'requests' && renderRequests()}
        {tab === 'invite' && renderInvite()}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 transition ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
