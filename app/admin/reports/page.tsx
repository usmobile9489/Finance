'use client'

import { useState, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'

type ReportRow = { label: string; income: number; expense: number; profit: number }

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReportsPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [module, setModule] = useState<'all' | 'personal' | 'phone-sales' | 'phone-service' | 'phone-rental' | 'locksmith' | 'business'>('all')
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  async function generateReport() {
    setLoading(true)
    setGenerated(false)

    const results: ReportRow[] = []

    if (module === 'all' || module === 'personal') {
      const { data } = await supabase.from('personal_transactions').select('type, amount, date')
        .gte(dateFrom ? 'date' : 'id', dateFrom || '00000000-0000-0000-0000-000000000000')
        .lte(dateTo ? 'date' : 'date', dateTo || '9999-12-31')
      const d = data || []
      const income = d.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
      const expense = d.filter(r => r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0)
      if (income + expense > 0) results.push({ label: 'Personal Finance', income, expense, profit: income - expense })
    }

    if (module === 'all' || module === 'business' || module === 'phone-sales') {
      const { data } = await supabase.from('phone_inventory').select('purchase_price, sale_price, status')
        .in('company_id', companyIds).eq('status', 'sold')
      const d = data || []
      const income = d.reduce((s, r) => s + Number(r.sale_price || 0), 0)
      const expense = d.reduce((s, r) => s + Number(r.purchase_price), 0)
      if (income + expense > 0) results.push({ label: 'Phone Buy/Sell', income, expense, profit: income - expense })
    }

    if (module === 'all' || module === 'business' || module === 'phone-service') {
      const { data } = await supabase.from('phone_services').select('price_charged, cost_to_business')
        .in('company_id', companyIds).eq('status', 'completed')
      const d = data || []
      const income = d.reduce((s, r) => s + Number(r.price_charged), 0)
      const expense = d.reduce((s, r) => s + Number(r.cost_to_business), 0)
      if (income + expense > 0) results.push({ label: 'Phone Service', income, expense, profit: income - expense })
    }

    if (module === 'all' || module === 'business' || module === 'phone-rental') {
      const { data } = await supabase.from('phone_rentals').select('rental_amount, deposit')
        .in('company_id', companyIds).eq('status', 'returned')
      const d = data || []
      const income = d.reduce((s, r) => s + Number(r.rental_amount), 0)
      if (income > 0) results.push({ label: 'Phone Rental', income, expense: 0, profit: income })
    }

    if (module === 'all' || module === 'business' || module === 'locksmith') {
      const { data } = await supabase.from('locksmith_projects').select('invoice_amount, material_cost, labor_cost')
        .in('company_id', companyIds).eq('status', 'completed')
      const d = data || []
      const income = d.reduce((s, r) => s + Number(r.invoice_amount), 0)
      const expense = d.reduce((s, r) => s + Number(r.material_cost) + Number(r.labor_cost), 0)
      if (income + expense > 0) results.push({ label: 'Locksmith', income, expense, profit: income - expense })
    }

    setRows(results)
    setGenerated(true)
    setLoading(false)
  }

  const totals = rows.reduce((acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, profit: acc.profit + r.profit }), { income: 0, expense: 0, profit: 0 })

  function exportCSV() {
    const header = 'Module,Income,Expenses,Profit\n'
    const body = rows.map(r => `${r.label},${r.income.toFixed(2)},${r.expense.toFixed(2)},${r.profit.toFixed(2)}`).join('\n')
    const total = `\nTotal,${totals.income.toFixed(2)},${totals.expense.toFixed(2)},${totals.profit.toFixed(2)}`
    const csv = header + body + total
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Generate profit & loss reports across all modules</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Report Filters</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Module</label>
            <select value={module} onChange={e => setModule(e.target.value as typeof module)}
              className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Modules</option>
              <option value="personal">Personal Finance</option>
              <option value="business">All Businesses</option>
              <option value="phone-sales">Phone Buy/Sell</option>
              <option value="phone-service">Phone Service</option>
              <option value="phone-rental">Phone Rental</option>
              <option value="locksmith">Locksmith</option>
            </select>
          </div>
          <button onClick={generateReport} disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {generated && rows.length > 0 && (
            <button onClick={exportCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {generated && (
        rows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400 dark:text-gray-500">No data found for the selected filters.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Profit & Loss Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Module</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenue / Income</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Costs / Expenses</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Profit / Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {rows.map(r => (
                    <tr key={r.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{r.label}</td>
                      <td className="px-5 py-3 text-right text-green-600 dark:text-green-400 font-medium">{fmt(r.income)}</td>
                      <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{fmt(r.expense)}</td>
                      <td className={`px-5 py-3 text-right font-bold ${r.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{fmt(r.profit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/30 font-bold border-t-2 border-gray-200 dark:border-gray-600">
                    <td className="px-5 py-3 text-gray-900 dark:text-white">Total</td>
                    <td className="px-5 py-3 text-right text-green-600 dark:text-green-400">{fmt(totals.income)}</td>
                    <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{fmt(totals.expense)}</td>
                    <td className={`px-5 py-3 text-right ${totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{fmt(totals.profit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
