'use client'

import { useEffect, useState } from 'react'
import { getTotalIncome, getTotalExpenses } from '@/lib/api'

export default function Dashboard({ companyId }: { companyId: string }) {
  const [income, setIncome] = useState<number>(0)
  const [expenses, setExpenses] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const incomeTotal = await getTotalIncome(companyId)
        const expenseTotal = await getTotalExpenses(companyId)
        setIncome(incomeTotal)
        setExpenses(expenseTotal)
      } catch (error) {
        console.error('Error loading analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    if (companyId) {
      loadAnalytics()
    }
  }, [companyId])

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  const profit = income - expenses

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-gray-600 text-sm font-semibold mb-2">Total Income</h3>
        <p className="text-3xl font-bold text-green-600">${income.toFixed(2)}</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-gray-600 text-sm font-semibold mb-2">Total Expenses</h3>
        <p className="text-3xl font-bold text-red-600">${expenses.toFixed(2)}</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-gray-600 text-sm font-semibold mb-2">Profit/Loss</h3>
        <p className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${profit.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
