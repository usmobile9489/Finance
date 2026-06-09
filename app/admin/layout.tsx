'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getCompanies, createCompany, updateCompany, uploadCompanyLogo } from '@/lib/api'
import { Company, CompanyKind } from '@/types/database'
import type { User } from '@supabase/supabase-js'
import QuickAdd from './QuickAdd'

// ─── Company Context ──────────────────────────────────────────────────────────
interface CompanyContextType {
  selectedCompanyId: string
  setSelectedCompanyId: (id: string) => void
  companies: Company[]
  refreshCompanies: () => Promise<void>
  user: User | null
  selectedCompany: Company | null
}

export const CompanyContext = createContext<CompanyContextType>({
  selectedCompanyId: '',
  setSelectedCompanyId: () => {},
  companies: [],
  refreshCompanies: async () => {},
  user: null,
  selectedCompany: null,
})

export function useCompany() {
  return useContext(CompanyContext)
}

// ─── Dark Mode ────────────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }
  return { dark, toggle }
}

// ─── Modules per company kind ─────────────────────────────────────────────────
type Mod = { label: string; href: string; icon: string }

const MODULES_BY_KIND: Record<CompanyKind, Mod[]> = {
  phone: [
    { label: 'Buy / Sell', href: '/admin/phone-sales', icon: '📱' },
    { label: 'Service', href: '/admin/phone-service', icon: '🔧' },
    { label: 'Rental', href: '/admin/phone-rental', icon: '📲' },
    { label: 'Contacts', href: '/admin/customers', icon: '👥' },
    { label: 'Items', href: '/admin/items', icon: '📦' },
    { label: 'Invoices', href: '/admin/invoices', icon: '🧾' },
    { label: 'Reports', href: '/admin/reports', icon: '📈' },
  ],
  keying: [
    { label: 'Master Key Orders', href: '/admin/keying-orders', icon: '🗝️' },
    { label: 'Items', href: '/admin/items', icon: '📦' },
    { label: 'Pins Inventory', href: '/admin/keying-inventory', icon: '📌' },
    { label: 'Expenses', href: '/admin/keying-expenses', icon: '🧰' },
    { label: 'Forms', href: '/admin/forms', icon: '📋' },
    { label: 'Contacts', href: '/admin/customers', icon: '👥' },
    { label: 'Invoices', href: '/admin/invoices', icon: '🧾' },
    { label: 'Reports', href: '/admin/reports', icon: '📈' },
  ],
  general: [
    { label: 'Transactions', href: '/admin/transactions', icon: '💰' },
    { label: 'Contacts', href: '/admin/customers', icon: '👥' },
    { label: 'Items', href: '/admin/items', icon: '📦' },
    { label: 'Invoices', href: '/admin/invoices', icon: '🧾' },
    { label: 'Forms', href: '/admin/forms', icon: '📋' },
    { label: 'Reports', href: '/admin/reports', icon: '📈' },
  ],
  personal: [
    { label: 'Transactions', href: '/admin/personal', icon: '💳' },
    { label: 'Categories', href: '/admin/personal/categories', icon: '🏷️' },
  ],
}

const KIND_ICON: Record<CompanyKind, string> = {
  phone: '📱', keying: '🗝️', general: '🏢', personal: '💳',
}

// ─── Collapsible group ────────────────────────────────────────────────────────
function CollapsibleGroup({
  title, icon, isOpen, onToggle, isActive, children,
}: {
  title: string; icon: string; isOpen: boolean; onToggle: () => void; isActive: boolean; children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="flex-1 text-left truncate">{title}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {isOpen && <div className="mt-0.5 ml-3 pl-2 border-l border-gray-200 dark:border-gray-700 space-y-0.5">{children}</div>}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  open, onClose, pathname, companies, selectedCompanyId, onSelectCompany, onAddCompany,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  companies: Company[]
  selectedCompanyId: string
  onSelectCompany: (id: string) => void
  onAddCompany: () => void
}) {
  // Which group is expanded — default to the selected company (or 'all')
  const [openGroup, setOpenGroup] = useState<string>(selectedCompanyId)
  useEffect(() => { setOpenGroup(selectedCompanyId) }, [selectedCompanyId])

  const SubLink = ({ mod, companyId }: { mod: Mod; companyId: string }) => {
    const isActive = pathname.startsWith(mod.href) && selectedCompanyId === companyId
    return (
      <Link
        href={mod.href}
        onClick={() => { onSelectCompany(companyId); onClose() }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
      >
        <span className="text-sm leading-none">{mod.icon}</span>
        <span>{mod.label}</span>
      </Link>
    )
  }

  // Personal company gets shown as its own top-level group; business companies grouped below
  const personalCompanies = companies.filter(c => c.kind === 'personal')
  const businessCompanies = companies.filter(c => c.kind !== 'personal')

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed top-0 left-0 h-full w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        flex flex-col z-40 transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <Link href="/admin" className="font-bold text-indigo-600 dark:text-indigo-400 text-base">Finance Manager</Link>
          <button onClick={onClose} className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {/* ALL group */}
          <CollapsibleGroup
            title="All Companies" icon="🗂️"
            isOpen={openGroup === 'all'}
            onToggle={() => setOpenGroup(openGroup === 'all' ? '' : 'all')}
            isActive={selectedCompanyId === 'all'}
          >
            <Link href="/admin" onClick={() => { onSelectCompany('all'); onClose() }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${pathname === '/admin' && selectedCompanyId === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span>📊</span><span>Dashboard</span>
            </Link>
            <Link href="/admin/reports" onClick={() => { onSelectCompany('all'); onClose() }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${pathname.startsWith('/admin/reports') && selectedCompanyId === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span>📈</span><span>Reports</span>
            </Link>
            <Link href="/admin/recurring" onClick={() => { onSelectCompany('all'); onClose() }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${pathname.startsWith('/admin/recurring') ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span>🔄</span><span>Recurring</span>
            </Link>
            <button onClick={() => { onAddCompany(); onClose() }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <span>➕</span><span>Add a Company</span>
            </button>
            <Link href="/admin/settings" onClick={onClose}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${pathname.startsWith('/admin/settings') ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span>⚙️</span><span>Settings</span>
            </Link>
          </CollapsibleGroup>

          {/* Personal */}
          {personalCompanies.map(c => (
            <CollapsibleGroup key={c.id}
              title={c.name} icon={KIND_ICON.personal}
              isOpen={openGroup === c.id}
              onToggle={() => setOpenGroup(openGroup === c.id ? '' : c.id)}
              isActive={selectedCompanyId === c.id}
            >
              {MODULES_BY_KIND.personal.map(m => <SubLink key={m.href} mod={m} companyId={c.id} />)}
            </CollapsibleGroup>
          ))}

          {/* Divider */}
          {businessCompanies.length > 0 && (
            <p className="px-3 mt-3 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Businesses</p>
          )}

          {/* Business companies */}
          {businessCompanies.map(c => (
            <CollapsibleGroup key={c.id}
              title={c.name} icon={KIND_ICON[c.kind] || '🏢'}
              isOpen={openGroup === c.id}
              onToggle={() => setOpenGroup(openGroup === c.id ? '' : c.id)}
              isActive={selectedCompanyId === c.id}
            >
              {(MODULES_BY_KIND[c.kind] || MODULES_BY_KIND.general).map(m => <SubLink key={m.href} mod={m} companyId={c.id} />)}
            </CollapsibleGroup>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">Finance Manager v1.0</p>
        </div>
      </aside>
    </>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCreateCompany, setShowCreateCompany] = useState(false)
  const [showEditCompany, setShowEditCompany] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCompany, setNewCompany] = useState({ name: '', email: '', phone: '', address: '', kind: 'general' as CompanyKind })
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { dark, toggle: toggleDark } = useDarkMode()
  const router = useRouter()
  const pathname = usePathname()

  const loadCompanies = useCallback(async (userId: string) => {
    const data = await getCompanies(userId)
    setCompanies(data)
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null
    if (savedId && (savedId === 'all' || data.find(c => c.id === savedId))) {
      setSelectedCompanyIdState(savedId)
    }
    return data
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      // Enforce call-in 2FA only when it's fully set up (no lock-out otherwise)
      const { data: sw } = await supabase.from('signalwire_settings')
        .select('require_2fa, space_url, api_token, owner_phone').eq('owner_id', user.id).maybeSingle()
      if (sw?.require_2fa && sw.space_url && sw.api_token && sw.owner_phone) {
        const { data: mfa } = await supabase.from('mfa_verifications').select('verified_at').eq('user_id', user.id).maybeSingle()
        const ok = mfa?.verified_at && (Date.now() - new Date(mfa.verified_at).getTime() < 12 * 60 * 60 * 1000)
        if (!ok) { router.push('/auth/verify'); return }
      }
      setUser(user)
      loadCompanies(user.id).finally(() => setLoading(false))
    })
  }, [loadCompanies, router])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSetSelectedCompanyId = (id: string) => {
    setSelectedCompanyIdState(id)
    localStorage.setItem('selectedCompanyId', id)
  }

  const refreshCompanies = useCallback(async () => {
    if (user) await loadCompanies(user.id)
  }, [user, loadCompanies])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    setCreateError(null)
    try {
      const company = await createCompany({ ...newCompany, user_id: user.id })
      let finalCompany = company
      if (logoFile) {
        const logoUrl = await uploadCompanyLogo(company.id, logoFile)
        finalCompany = await updateCompany(company.id, { logo_url: logoUrl })
      }
      setCompanies(prev => [...prev, finalCompany])
      handleSetSelectedCompanyId(finalCompany.id)
      setShowCreateCompany(false)
      setNewCompany({ name: '', email: '', phone: '', address: '', kind: 'general' })
      setLogoFile(null)
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create company')
    } finally {
      setCreating(false)
    }
  }

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCompany) return
    setCreating(true)
    setCreateError(null)
    try {
      let logoUrl = editCompany.logo_url
      if (editLogoFile) logoUrl = await uploadCompanyLogo(editCompany.id, editLogoFile)
      const updated = await updateCompany(editCompany.id, {
        name: editCompany.name, email: editCompany.email, phone: editCompany.phone,
        address: editCompany.address, logo_url: logoUrl, kind: editCompany.kind,
      })
      setCompanies(cs => cs.map(c => c.id === updated.id ? updated : c))
      setShowEditCompany(false)
      setEditLogoFile(null)
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to update company')
    } finally {
      setCreating(false)
    }
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) ?? null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <CompanyContext.Provider value={{ selectedCompanyId, setSelectedCompanyId: handleSetSelectedCompanyId, companies, refreshCompanies, user, selectedCompany }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
        <Sidebar
          open={sidebarOpen} onClose={() => setSidebarOpen(false)} pathname={pathname}
          companies={companies} selectedCompanyId={selectedCompanyId}
          onSelectCompany={handleSetSelectedCompanyId}
          onAddCompany={() => { setShowCreateCompany(true); setCreateError(null) }}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 sticky top-0 z-20 shrink-0">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Current scope label */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedCompany?.logo_url && (
                <Image src={selectedCompany.logo_url} alt={selectedCompany.name} width={24} height={24} className="rounded object-contain shrink-0" />
              )}
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
                {selectedCompanyId === 'all' ? 'All Companies' : (selectedCompany?.name ?? '')}
              </span>
              {selectedCompany && (
                <button onClick={() => { setEditCompany(selectedCompany); setCreateError(null); setShowEditCompany(true) }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
                  Edit
                </button>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                {dark ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M18.364 18.364l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <div ref={userMenuRef} className="relative">
                <button onClick={() => setShowUserMenu(o => !o)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <button onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {companies.length === 0 && (
            <div className="p-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">No Companies Yet</h2>
                <p className="text-amber-700 dark:text-amber-300 mb-6">Create your first company to start tracking finances.</p>
                <button onClick={() => setShowCreateCompany(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
                  Create Company
                </button>
              </div>
            </div>
          )}

          {companies.length > 0 && <main className="flex-1 p-6 overflow-auto">{children}</main>}
        </div>

        {/* Floating quick-add */}
        {companies.length > 0 && <QuickAdd />}

        {/* Create Company Modal */}
        {showCreateCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create Company</h2>
              {createError && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{createError}</p>}
              <form onSubmit={handleCreateCompany} className="space-y-3">
                <input type="text" placeholder="Company name *" required value={newCompany.name}
                  onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Business Type *</label>
                  <select value={newCompany.kind} onChange={e => setNewCompany({ ...newCompany, kind: e.target.value as CompanyKind })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="general">Business</option>
                    <option value="personal">Personal</option>
                  </select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Business gives you transactions, contacts, items, invoices, forms & reports.</p>
                </div>
                <input type="email" placeholder="Email" value={newCompany.email}
                  onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="tel" placeholder="Phone" value={newCompany.phone}
                  onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea placeholder="Address" value={newCompany.address}
                  onChange={e => setNewCompany({ ...newCompany, address: e.target.value })}
                  rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company Logo (shows on invoices)</label>
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" onClick={() => { setShowCreateCompany(false); setCreateError(null) }}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Company Modal */}
        {showEditCompany && editCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Company</h2>
              {createError && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{createError}</p>}
              <form onSubmit={handleEditCompany} className="space-y-3">
                <input type="text" placeholder="Company name *" required value={editCompany.name}
                  onChange={e => setEditCompany({ ...editCompany, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Business Type</label>
                  <select value={editCompany.kind} onChange={e => setEditCompany({ ...editCompany, kind: e.target.value as CompanyKind })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="general">General Business</option>
                    <option value="phone">Phone Business</option>
                    <option value="keying">Keying / Locksmith</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <input type="email" placeholder="Email" value={editCompany.email || ''}
                  onChange={e => setEditCompany({ ...editCompany, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="tel" placeholder="Phone" value={editCompany.phone || ''}
                  onChange={e => setEditCompany({ ...editCompany, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea placeholder="Address" value={editCompany.address || ''}
                  onChange={e => setEditCompany({ ...editCompany, address: e.target.value })}
                  rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company Logo</label>
                  {editCompany.logo_url && (
                    <Image src={editCompany.logo_url} alt="Current logo" width={60} height={60} className="rounded mb-2 object-contain border border-gray-200 dark:border-gray-600 p-1" />
                  )}
                  <input type="file" accept="image/*" onChange={e => setEditLogoFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                    {creating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setShowEditCompany(false); setCreateError(null) }}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CompanyContext.Provider>
  )
}
