'use client'

import { useState, useEffect, useContext } from 'react'
import { CompanyContext } from '../layout'
import { supabase } from '@/lib/supabase'
type LocksmithProject = {
  id: string
  company_id: string
  project_name: string
  customer: string
  project_type: string
  material_cost: number
  labor_cost: number
  invoice_amount: number
  status: 'active' | 'completed' | 'quoted'
  start_date: string
  end_date: string | null
  notes: string | null
}

type LocksmithInventory = {
  id: string
  company_id: string
  item_name: string
  category: 'lock' | 'pin' | 'key' | 'hardware' | 'other'
  quantity: number
  unit_cost: number
  notes: string | null
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PROJECT_TYPES = ['Master Key System', 'Lock Installation', 'Lock Repair', 'Key Cutting', 'Safe Opening', 'Access Control', 'Rekeying', 'Emergency Lockout', 'Other']

export default function LocksmithPage() {
  const { selectedCompanyId, companies } = useContext(CompanyContext)
  const [projects, setProjects] = useState<LocksmithProject[]>([])
  const [inventory, setInventory] = useState<LocksmithInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'projects' | 'inventory'>('projects')
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showInventoryForm, setShowInventoryForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState({
    project_name: '', customer: '', project_type: 'Master Key System',
    material_cost: '', labor_cost: '', invoice_amount: '',
    status: 'active' as LocksmithProject['status'],
    start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '',
  })
  const [inventoryForm, setInventoryForm] = useState({
    item_name: '', category: 'lock' as LocksmithInventory['category'],
    quantity: '', unit_cost: '', notes: '',
  })

  const companyIds = selectedCompanyId === 'all' ? companies.map(c => c.id) : [selectedCompanyId]

  useEffect(() => {
    if (companyIds.length === 0) return
    loadData()
  }, [selectedCompanyId, companies])

  async function loadData() {
    setLoading(true)
    const [p, i] = await Promise.all([
      supabase.from('locksmith_projects').select('*').in('company_id', companyIds).order('start_date', { ascending: false }),
      supabase.from('locksmith_inventory').select('*').in('company_id', companyIds).order('item_name'),
    ])
    setProjects((p.data || []) as LocksmithProject[])
    setInventory((i.data || []) as LocksmithInventory[])
    setLoading(false)
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('locksmith_projects').insert([{
        company_id: companyId,
        project_name: projectForm.project_name,
        customer: projectForm.customer,
        project_type: projectForm.project_type,
        material_cost: parseFloat(projectForm.material_cost) || 0,
        labor_cost: parseFloat(projectForm.labor_cost) || 0,
        invoice_amount: parseFloat(projectForm.invoice_amount),
        status: projectForm.status,
        start_date: projectForm.start_date,
        end_date: projectForm.end_date || null,
        notes: projectForm.notes || null,
      }])
      if (error) throw error
      setShowProjectForm(false)
      setProjectForm({ project_name: '', customer: '', project_type: 'Master Key System', material_cost: '', labor_cost: '', invoice_amount: '', status: 'active', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' })
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveInventory(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const companyId = selectedCompanyId === 'all' ? companies[0].id : selectedCompanyId
      const { error } = await supabase.from('locksmith_inventory').insert([{
        company_id: companyId,
        item_name: inventoryForm.item_name,
        category: inventoryForm.category,
        quantity: parseInt(inventoryForm.quantity),
        unit_cost: parseFloat(inventoryForm.unit_cost) || 0,
        notes: inventoryForm.notes || null,
      }])
      if (error) throw error
      setShowInventoryForm(false)
      setInventoryForm({ item_name: '', category: 'lock', quantity: '', unit_cost: '', notes: '' })
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save inventory item')
    } finally {
      setSaving(false)
    }
  }

  const totalRevenue = projects.filter(p => p.status === 'completed').reduce((s, p) => s + p.invoice_amount, 0)
  const totalCost = projects.filter(p => p.status === 'completed').reduce((s, p) => s + p.material_cost + p.labor_cost, 0)
  const totalProfit = totalRevenue - totalCost
  const activeProjects = projects.filter(p => p.status === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Locksmith</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage projects, inventory and profit</p>
        </div>
        <div className="flex gap-2">
          {tab === 'projects'
            ? <button onClick={() => setShowProjectForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ New Project</button>
            : <button onClick={() => setShowInventoryForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Item</button>
          }
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Projects', value: activeProjects, color: 'blue' },
          { label: 'Revenue', value: fmt(totalRevenue), color: 'green' },
          { label: 'Total Cost', value: fmt(totalCost), color: 'red' },
          { label: 'Profit', value: fmt(totalProfit), color: totalProfit >= 0 ? 'emerald' : 'orange' },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${
            s.color === 'blue' ? 'border-blue-500' : s.color === 'green' ? 'border-green-500' :
            s.color === 'red' ? 'border-red-500' : s.color === 'emerald' ? 'border-emerald-500' : 'border-orange-500'
          }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${
              s.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : s.color === 'green' ? 'text-green-600 dark:text-green-400' :
              s.color === 'red' ? 'text-red-600 dark:text-red-400' : s.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('projects')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'projects' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          Projects ({projects.length})
        </button>
        <button onClick={() => setTab('inventory')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'inventory' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          Inventory ({inventory.length})
        </button>
      </div>

      {tab === 'projects' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
            : projects.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 dark:text-gray-500 mb-3">No projects yet.</p>
                <button onClick={() => setShowProjectForm(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Create first project</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      {['Project', 'Customer', 'Type', 'Materials', 'Labor', 'Invoice', 'Profit', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {projects.map(p => {
                      const profit = p.invoice_amount - p.material_cost - p.labor_cost
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{p.project_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(p.start_date).toLocaleDateString()}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.customer}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.project_type}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmt(p.material_cost)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmt(p.labor_cost)}</td>
                          <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">{fmt(p.invoice_amount)}</td>
                          <td className={`px-4 py-3 font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(profit)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              p.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { supabase.from('locksmith_projects').delete().eq('id', p.id).then(loadData) }}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
            : inventory.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 dark:text-gray-500 mb-3">No inventory items yet.</p>
                <button onClick={() => setShowInventoryForm(true)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add first item</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      {['Item', 'Category', 'Qty', 'Unit Cost', 'Total Value', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {inventory.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.item_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            item.category === 'lock' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                            item.category === 'key' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                            item.category === 'pin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>{item.category}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.quantity}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmt(item.unit_cost)}</td>
                        <td className="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400">{fmt(item.unit_cost * item.quantity)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => { supabase.from('locksmith_inventory').delete().eq('id', item.id).then(loadData) }}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Project Form Modal */}
      {showProjectForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">New Project</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSaveProject} className="space-y-3">
              <input type="text" placeholder="Project name *" required value={projectForm.project_name}
                onChange={e => setProjectForm({ ...projectForm, project_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Customer *" required value={projectForm.customer}
                onChange={e => setProjectForm({ ...projectForm, customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={projectForm.project_type} onChange={e => setProjectForm({ ...projectForm, project_type: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Materials', key: 'material_cost' as const },
                  { label: 'Labor', key: 'labor_cost' as const },
                  { label: 'Invoice *', key: 'invoice_amount' as const },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                    <input type="number" step="0.01" min="0" required={f.key === 'invoice_amount'} placeholder="0.00"
                      value={projectForm[f.key]} onChange={e => setProjectForm({ ...projectForm, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value as LocksmithProject['status'] })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="quoted">Quoted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <textarea placeholder="Notes" value={projectForm.notes} onChange={e => setProjectForm({ ...projectForm, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Save Project'}</button>
                <button type="button" onClick={() => { setShowProjectForm(false); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Form Modal */}
      {showInventoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Inventory Item</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSaveInventory} className="space-y-3">
              <input type="text" placeholder="Item name *" required value={inventoryForm.item_name}
                onChange={e => setInventoryForm({ ...inventoryForm, item_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={inventoryForm.category} onChange={e => setInventoryForm({ ...inventoryForm, category: e.target.value as LocksmithInventory['category'] })}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {(['lock', 'pin', 'key', 'hardware', 'other'] as const).map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity *</label>
                  <input type="number" min="0" required placeholder="0" value={inventoryForm.quantity}
                    onChange={e => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unit Cost</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={inventoryForm.unit_cost}
                    onChange={e => setInventoryForm({ ...inventoryForm, unit_cost: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <textarea placeholder="Notes" value={inventoryForm.notes} onChange={e => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => { setShowInventoryForm(false); setError(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
