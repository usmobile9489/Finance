'use client'

import { useState, useEffect, useContext } from 'react'
import Link from 'next/link'
import { CompanyContext } from './layout'
import { supabase } from '@/lib/supabase'
import { Company } from '@/types/database'

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type PL = { revenue: number; expenses: number; net: number }
type CompanyPL = { company: Company; pl: PL }

const zero = (): PL => ({ revenue: 0, expenses: 0, net: 0 })

export default function AdminDashboard() {
  const { selectedCompanyId, companies, user } = useContext(CompanyContext)
  const [loading, setLoading] = useState(true)
  const [perCompany, setPerCompany] = useState<CompanyPL[]>([])
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; order_number: string; company_name: string; contact_name: string; status: string; cut_keys: boolean; created_at: string }>>([])
  const [pendingInvoiceTotal, setPendingInvoiceTotal] = useState(0)

  useEffect(() => {
    if (companies.length === 0 || !user) return
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, companies, user])

  async function loadAll() {
    setLoading(true)
    try {
      const allIds = companies.map(c => c.id)

      // Fetch every source once, scoped to all companies
      const [invoices, phones, services, rentals, kexp, locksmith, transactions, personalTx] = await Promise.all([
        supabase.from('invoices').select('company_id, total, cost, status').in('company_id', allIds),
        supabase.from('phone_inventory').select('company_id, purchase_price, sale_price, status').in('company_id', allIds),
        supabase.from('phone_services').select('company_id, price_charged, cost_to_business, status').in('company_id', allIds),
        supabase.from('phone_rentals').select('company_id, rental_amount, status').in('company_id', allIds),
        supabase.from('keying_expenses').select('company_id, amount').in('company_id', allIds),
        supabase.from('locksmith_projects').select('company_id, invoice_amount, material_cost, labor_cost, status').in('company_id', allIds),
        supabase.from('transactions').select('company_id, amount, type').in('company_id', allIds),
        user ? supabase.from('personal_transactions').select('amount, type').eq('user_id', user.id) : Promise.resolve({ data: [] }),
      ])

      const plByCompany: Record<string, PL> = {}
      companies.forEach(c => { plByCompany[c.id] = zero() })

      const add = (cid: string | null, rev: number, exp: number) => {
        if (!cid || !plByCompany[cid]) return
        plByCompany[cid].revenue += rev
        plByCompany[cid].expenses += exp
      }

      // Paid invoices → revenue (total) and cost → expense, so net = profit
      ;(invoices.data || []).forEach(r => { if (r.status === 'paid') add(r.company_id, Number(r.total) || 0, Number(r.cost) || 0) })
      // Phone buy/sell
      ;(phones.data || []).forEach(r => { if (r.status === 'sold') add(r.company_id, Number(r.sale_price) || 0, Number(r.purchase_price) || 0) })
      // Phone services
      ;(services.data || []).forEach(r => { if (r.status === 'completed') add(r.company_id, Number(r.price_charged) || 0, Number(r.cost_to_business) || 0) })
      // Phone rentals
      ;(rentals.data || []).forEach(r => { if (r.status === 'returned') add(r.company_id, Number(r.rental_amount) || 0, 0) })
      // Keying business expenses (pins/tools) → expense, reduces profit
      ;(kexp.data || []).forEach(r => add(r.company_id, 0, Number(r.amount) || 0))
      // Locksmith projects
      ;(locksmith.data || []).forEach(r => { if (r.status === 'completed') add(r.company_id, Number(r.invoice_amount) || 0, (Number(r.material_cost) || 0) + (Number(r.labor_cost) || 0)) })
      // Generic transactions
      ;(transactions.data || []).forEach(r => {
        if (r.type === 'income') add(r.company_id, Number(r.amount) || 0, 0)
        else add(r.company_id, 0, Number(r.amount) || 0)
      })

      // Personal company P&L from personal_transactions
      const personalCompany = companies.find(c => c.kind === 'personal')
      if (personalCompany) {
        ;(personalTx.data || []).forEach((r: { amount: number; type: string }) => {
          if (r.type === 'income') add(personalCompany.id, Number(r.amount) || 0, 0)
          else add(personalCompany.id, 0, Number(r.amount) || 0)
        })
      }

      const result: CompanyPL[] = companies.map(c => {
        const pl = plByCompany[c.id]
        pl.net = pl.revenue - pl.expenses
        return { company: c, pl }
      })
      setPerCompany(result)

      // Pending (unpaid sent) invoices total
      const pending = (invoices.data || []).filter(r => r.status === 'sent' || r.status === 'pending_approval').reduce((s, r) => s + (Number(r.total) || 0), 0)
      setPendingInvoiceTotal(pending)

      // Recent submitted orders
      const { data: orders } = await supabase
        .from('keying_orders')
        .select('id, order_number, company_name, contact_name, status, cut_keys, created_at')
        .order('created_at', { ascending: false }).limit(6)
      setRecentOrders((orders || []) as typeof recentOrders)
    } finally {
      setLoading(false)
    }
  }

  const isAll = selectedCompanyId === 'all'
  const focused = !isAll ? perCompany.find(p => p.company.id === selectedCompanyId) : null

  // Grand totals
  const grand = perCompany.reduce((acc, p) => ({
    revenue: acc.revenue + p.pl.revenue, expenses: acc.expenses + p.pl.expenses, net: acc.net + p.pl.net,
  }), zero())

  const scope = isAll ? grand : (focused?.pl ?? zero())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAll ? 'All Companies — Dashboard' : `${focused?.company.name ?? ''} — Dashboard`}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {isAll ? 'Combined performance across every company' : 'Performance for this company'}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: scope.revenue, color: 'green', sub: 'paid + sales' },
          { label: 'Expenses', value: scope.expenses, color: 'red', sub: 'costs' },
          { label: 'Net Profit', value: scope.net, color: scope.net >= 0 ? 'blue' : 'orange', sub: 'revenue − expenses' },
          { label: 'Pending Invoices', value: pendingInvoiceTotal, color: 'yellow', sub: 'awaiting payment' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'green' ? 'border-green-500' : s.color === 'red' ? 'border-red-500' :
            s.color === 'blue' ? 'border-blue-500' : s.color === 'orange' ? 'border-orange-500' : 'border-yellow-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              s.color === 'green' ? 'text-green-600 dark:text-green-400' : s.color === 'red' ? 'text-red-600 dark:text-red-400' :
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400'
            }`}>{loading ? '—' : fmt(s.value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-company breakdown (only on All) */}
      {isAll && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Per-Company Breakdown</h2>
          {loading ? <p className="text-gray-400 text-sm">Loading...</p>
            : perCompany.length === 0 ? <p className="text-gray-400 text-sm">No companies yet.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Company</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Expenses</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {perCompany.map(p => (
                      <tr key={p.company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2.5 font-medium text-gray-800 dark:text-gray-200">{p.company.name}</td>
                        <td className="py-2.5 text-right text-green-600 dark:text-green-400 font-medium">{fmt(p.pl.revenue)}</td>
                        <td className="py-2.5 text-right text-red-600 dark:text-red-400">{fmt(p.pl.expenses)}</td>
                        <td className={`py-2.5 text-right font-bold ${p.pl.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{fmt(p.pl.net)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 font-bold">
                      <td className="py-2.5 text-gray-900 dark:text-white">Total (all companies)</td>
                      <td className="py-2.5 text-right text-green-600 dark:text-green-400">{fmt(grand.revenue)}</td>
                      <td className="py-2.5 text-right text-red-600 dark:text-red-400">{fmt(grand.expenses)}</td>
                      <td className={`py-2.5 text-right ${grand.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{fmt(grand.net)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Recent submitted orders */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Submitted Orders</h3>
          <Link href="/admin/keying-orders" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View all →</Link>
        </div>
        {loading ? <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
          : recentOrders.length === 0 ? <p className="text-gray-400 dark:text-gray-500 text-sm">No form submissions yet. Share your form link below.</p>
          : (
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
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Share these links with customers to collect orders.</p>
        <div className="space-y-3">
          {[{ label: '🗝️ Keying Order Form', path: '/keying' }].map(link => {
            const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${link.path}` : link.path
            return (
              <div key={link.path} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{link.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{fullUrl}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => navigator.clipboard.writeText(fullUrl)}
                    className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 font-medium">Copy</button>
                  <Link href={link.path} target="_blank"
                    className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 font-medium">Open ↗</Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
