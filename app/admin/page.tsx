'use client'

import { useState, useEffect, useContext } from 'react'
import Link from 'next/link'
import { CompanyContext } from './layout'
import { getTransactions, getInvoices } from '@/lib/api'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ModuleStat = { label: string; value: string | number; sub?: string; href: string; color: string; icon: string }

export default function AdminDashboard() {
  const { selectedCompanyId, companies, user } = useContext(CompanyContext)
  const [loading, setLoading] = useState(true)

  // Business stats
  const [bizIncome, setBizIncome] = useState(0)
  const [bizExpenses, setBizExpenses] = useState(0)
  const [pendingInvoices, setPendingInvoices] = useState(0)

  // Personal stats
  const [personalIncome, setPersonalIncome] = useState(0)
  const [personalExpenses, setPersonalExpenses] = useState(0)

  // Module stats
  const [phoneSalesProfit, setPhoneSalesProfit] = useState(0)
  const [phoneSalesStock, setPhoneSalesStock] = useState(0)
  const [phoneServiceProfit, setPhoneServiceProfit] = useState(0)
  const [activeRentals, setActiveRentals] = useState(0)
  const [overdueRentals, setOverdueRentals] = useState(0)
  const [locksmithProfit, setLocksmithProfit] = useState(0)
  const [activeProjects, setActiveProjects] = useState(0)

  const [recentTx, setRecentTx] = useState<Array<{ id: string; description: string; amount: number; type: string; company?: string }>>([])
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; order_number: string; company_name: string; contact_name: string; status: string; cut_keys: boolean; created_at: string }>>([])

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0 || !user) return
    loadAll()
  }, [selectedCompanyId, companies, user])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([
        loadBusinessStats(),
        loadPersonalStats(),
        loadModuleStats(),
        loadKeyingOrders(),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadKeyingOrders() {
    const { data } = await supabase
      .from('keying_orders')
      .select('id, order_number, company_name, contact_name, status, cut_keys, created_at')
      .order('created_at', { ascending: false })
      .limit(6)
    setRecentOrders((data || []) as typeof recentOrders)
  }

  async function loadBusinessStats() {
    const results = await Promise.all(companyIds.map(cid =>
      Promise.all([getTransactions(cid), getInvoices(cid)])
    ))
    let income = 0, expenses = 0, pending = 0
    const allTx: typeof recentTx = []
    results.forEach(([txs, invs], i) => {
      income += txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      expenses += txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      pending += invs.filter(i => i.status === 'sent' || i.status === 'pending_approval').length
      allTx.push(...txs.map(t => ({ id: t.id, description: t.description, amount: Number(t.amount), type: t.type, company: companies[i]?.name })))
    })
    setBizIncome(income)
    setBizExpenses(expenses)
    setPendingInvoices(pending)
    setRecentTx(allTx.slice(0, 5))
  }

  async function loadPersonalStats() {
    if (!user) return
    const { data } = await supabase.from('personal_transactions').select('type, amount').eq('user_id', user.id)
    const d = data || []
    setPersonalIncome(d.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0))
    setPersonalExpenses(d.filter(r => r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0))
  }

  async function loadModuleStats() {
    if (companyIds.length === 0) return
    const [ps, psvc, pr, lp] = await Promise.all([
      supabase.from('phone_inventory').select('purchase_price, sale_price, status').in('company_id', companyIds),
      supabase.from('phone_services').select('price_charged, cost_to_business, status').in('company_id', companyIds),
      supabase.from('phone_rentals').select('rental_start, rental_end, status').in('company_id', companyIds),
      supabase.from('locksmith_projects').select('invoice_amount, material_cost, labor_cost, status').in('company_id', companyIds),
    ])

    const phones = ps.data || []
    setPhoneSalesStock(phones.filter(p => p.status === 'in_stock').length)
    setPhoneSalesProfit(phones.filter(p => p.status === 'sold').reduce((s, p) => s + (Number(p.sale_price || 0) - Number(p.purchase_price)), 0))

    const svcs = psvc.data || []
    setPhoneServiceProfit(svcs.filter(s => s.status === 'completed').reduce((s, r) => s + Number(r.price_charged) - Number(r.cost_to_business), 0))

    const rentals = pr.data || []
    const today = new Date().toISOString().split('T')[0]
    setActiveRentals(rentals.filter(r => r.status === 'active').length)
    setOverdueRentals(rentals.filter(r => r.status !== 'returned' && r.rental_end && r.rental_end < today).length)

    const projs = lp.data || []
    setActiveProjects(projs.filter(p => p.status === 'active').length)
    setLocksmithProfit(projs.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.invoice_amount) - Number(p.material_cost) - Number(p.labor_cost), 0))
  }

  const netBusiness = bizIncome - bizExpenses
  const netPersonal = personalIncome - personalExpenses

  const moduleCards: ModuleStat[] = [
    { label: 'Phone Buy/Sell', value: fmt(phoneSalesProfit), sub: `${phoneSalesStock} in stock`, href: '/admin/phone-sales', color: 'blue', icon: '📱' },
    { label: 'Phone Service', value: fmt(phoneServiceProfit), sub: 'total profit', href: '/admin/phone-service', color: 'teal', icon: '🔧' },
    { label: 'Phone Rental', value: activeRentals, sub: overdueRentals > 0 ? `${overdueRentals} overdue!` : 'active rentals', href: '/admin/phone-rental', color: overdueRentals > 0 ? 'red' : 'purple', icon: '📲' },
    { label: 'Locksmith', value: fmt(locksmithProfit), sub: `${activeProjects} active projects`, href: '/admin/locksmith', color: 'amber', icon: '🔑' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {selectedCompanyId === 'all' ? 'All companies overview' : (companies.find(c => c.id === selectedCompanyId)?.name ?? 'Overview')}
        </p>
      </div>

      {/* Top summary: Personal + Business */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Business Income', value: bizIncome, color: 'green', sub: 'all companies' },
          { label: 'Business Expenses', value: bizExpenses, color: 'red', sub: 'all companies' },
          { label: 'Business Net', value: netBusiness, color: netBusiness >= 0 ? 'blue' : 'orange', sub: 'profit/loss' },
          { label: 'Pending Invoices', value: pendingInvoices, color: 'yellow', sub: 'awaiting payment', isMoney: false },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'green' ? 'border-green-500' : s.color === 'red' ? 'border-red-500' :
            s.color === 'blue' ? 'border-blue-500' : s.color === 'orange' ? 'border-orange-500' : 'border-yellow-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              s.color === 'green' ? 'text-green-600 dark:text-green-400' : s.color === 'red' ? 'text-red-600 dark:text-red-400' :
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400'
            }`}>{loading ? '—' : s.isMoney === false ? s.value : fmt(s.value as number)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Personal Finance summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Personal Finance</h2>
          <Link href="/admin/personal" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Income', value: personalIncome, color: 'text-green-600 dark:text-green-400' },
            { label: 'Expenses', value: personalExpenses, color: 'text-red-600 dark:text-red-400' },
            { label: 'Net', value: netPersonal, color: netPersonal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{loading ? '—' : fmt(s.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Business modules */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Business Modules</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {moduleCards.map(card => (
            <Link key={card.label} href={card.href}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-md dark:hover:shadow-gray-900 transition-shadow group">
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{card.icon}</span>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{card.label}</p>
              <p className={`text-xl font-bold mt-1 ${
                card.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                card.color === 'teal' ? 'text-teal-600 dark:text-teal-400' :
                card.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                card.color === 'red' ? 'text-red-600 dark:text-red-400' :
                'text-amber-600 dark:text-amber-400'
              }`}>{loading ? '—' : card.value}</p>
              {card.sub && (
                <p className={`text-xs mt-0.5 ${card.color === 'red' ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {card.sub}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Business Transactions</h3>
            <Link href="/admin/transactions" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>
          </div>
          {loading ? <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
            : recentTx.length === 0 ? <p className="text-gray-400 dark:text-gray-500 text-sm">No transactions yet.</p>
            : (
              <div className="space-y-2">
                {recentTx.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-64">{tx.description}</p>
                      {tx.company && selectedCompanyId === 'all' && <p className="text-xs text-gray-400 dark:text-gray-500">{tx.company}</p>}
                    </div>
                    <span className={`text-sm font-bold shrink-0 ml-2 ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Quick actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { href: '/admin/personal', label: '+ Personal Transaction', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30' },
              { href: '/admin/phone-sales', label: '+ Phone to Inventory', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30' },
              { href: '/admin/phone-service', label: '+ Service Record', color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30' },
              { href: '/admin/phone-rental', label: '+ Rental', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30' },
              { href: '/admin/locksmith', label: '+ Locksmith Project', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30' },
              { href: '/admin/invoices', label: '+ Invoice', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30' },
              { href: '/admin/customers', label: '+ Customer', color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30' },
            ].map(a => (
              <Link key={a.href} href={a.href} className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${a.color}`}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Submitted Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Submitted Orders</h3>
          <Link href="/admin/keying-orders" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View all →</Link>
        </div>
        {loading ? <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
          : recentOrders.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">No form submissions yet. Share your form links below to start receiving orders.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <Link key={o.id} href="/admin/keying-orders"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">{o.order_number}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{o.company_name || o.contact_name}</span>
                    {o.cut_keys && <span className="text-xs shrink-0" title="Cut keys requested">✂️</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      o.status === 'new' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                      o.status === 'in_progress' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      o.status === 'complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>{o.status.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
      </div>

      {/* Customer-facing Form Links */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Customer Form Links</h3>
          <Link href="/admin/forms" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Manage forms →</Link>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Share these links with your customers to collect orders and requests.</p>
        <div className="space-y-3">
          {[
            { label: '🗝️ Keying Order Form', path: '/keying', desc: 'Customer keying order submission' },
          ].map(link => {
            const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${link.path}` : link.path
            return (
              <div key={link.path} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{link.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{fullUrl}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(fullUrl)}
                    className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-medium">
                    Copy
                  </button>
                  <Link href={link.path} target="_blank"
                    className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
                    Open ↗
                  </Link>
                </div>
              </div>
            )
          })}
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            Custom forms you build in <Link href="/admin/forms" className="text-indigo-500 hover:underline">Forms</Link> each get their own shareable link too.
          </p>
        </div>
      </div>
    </div>
  )
}
