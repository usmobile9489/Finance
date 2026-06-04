'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type KeyingOrder = {
  id: string
  order_number: string
  status: 'new' | 'in_progress' | 'complete' | 'cancelled'
  company_name: string
  contact_name: string
  email: string | null
  phone: string | null
  address: string | null
  customer_ref: string | null
  needed_by: string | null
  notes: string | null
  brands_json: BrandItem[]
  total: number
  created_at: string
}

type BrandItem = {
  brand: string
  condition: string
  keying_option: string
  quantity: number
  subtotal: number
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  complete: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function KeyingOrdersPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [orders, setOrders] = useState<KeyingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<KeyingOrder | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => { loadOrders() }, [selectedCompanyId, companies])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('keying_orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders((data || []) as KeyingOrder[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: KeyingOrder['status']) {
    setUpdatingStatus(true)
    await supabase.from('keying_orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    setUpdatingStatus(false)
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order?')) return
    await supabase.from('keying_orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false
    if (search && !o.company_name.toLowerCase().includes(search.toLowerCase()) &&
        !o.order_number.toLowerCase().includes(search.toLowerCase()) &&
        !o.contact_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const newCount = orders.filter(o => o.status === 'new').length
  const totalRevenue = orders.filter(o => o.status === 'complete').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Keying Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage incoming keying orders from customers</p>
        </div>
        <Link href="/keying" target="_blank"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          View Order Form ↗
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'New Orders', value: newCount, color: 'blue' },
          { label: 'In Progress', value: orders.filter(o => o.status === 'in_progress').length, color: 'yellow' },
          { label: 'Completed', value: orders.filter(o => o.status === 'complete').length, color: 'green' },
          { label: 'Total Revenue', value: fmt(totalRevenue), color: 'emerald' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'yellow' ? 'border-yellow-500' :
            s.color === 'green' ? 'border-green-500' : 'border-emerald-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
              s.color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input placeholder="Search order #, company, contact..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {(['all', 'new', 'in_progress', 'complete', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Order list */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 dark:text-gray-500 mb-2">No orders found.</p>
                <Link href="/keying" target="_blank" className="text-sm text-indigo-600 dark:text-indigo-400">Share order form →</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(order => (
                  <div key={order.id} onClick={() => setSelected(order)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selected?.id === order.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{order.order_number}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.status]}`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate">{order.company_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{order.contact_name} · {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm shrink-0">{fmt(order.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5">
          {!selected ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🗝️</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Select an order to view details</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{selected.order_number}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[selected.status]}`}>
                    {selected.status.replace('_', ' ')}
                  </span>
                </div>
                <button onClick={() => deleteOrder(selected.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Contact info */}
              <div className="space-y-2 mb-4 text-sm">
                {[
                  { label: 'Company', value: selected.company_name },
                  { label: 'Contact', value: selected.contact_name },
                  { label: 'Email', value: selected.email },
                  { label: 'Phone', value: selected.phone },
                  { label: 'Needed By', value: selected.needed_by ? new Date(selected.needed_by).toLocaleDateString() : null },
                  { label: 'Ref #', value: selected.customer_ref },
                ].map(f => f.value ? (
                  <div key={f.label} className="flex gap-2">
                    <span className="text-gray-400 dark:text-gray-500 w-20 shrink-0">{f.label}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{f.value}</span>
                  </div>
                ) : null)}
              </div>

              {/* Brands table */}
              {selected.brands_json?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Brands</p>
                  <div className="space-y-1.5">
                    {selected.brands_json.map((b, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{b.brand}</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{fmt(b.subtotal)}</span>
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 mt-0.5">
                          {b.condition} · {b.keying_option} · Qty: {b.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total</span>
                    <span className="font-bold text-gray-900 dark:text-white">{fmt(selected.total)}</span>
                  </div>
                </div>
              )}

              {selected.notes && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">Notes</p>
                  {selected.notes}
                </div>
              )}

              {/* Status update */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['new', 'in_progress', 'complete', 'cancelled'] as const).map(s => (
                    <button key={s} disabled={updatingStatus || selected.status === s}
                      onClick={() => updateStatus(selected.id, s)}
                      className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                        selected.status === s
                          ? `${STATUS_COLORS[s]} border-transparent cursor-default`
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50'
                      }`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
