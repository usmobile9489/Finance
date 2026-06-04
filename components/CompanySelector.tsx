'use client'

import { useState, useEffect } from 'react'
import { getCompanies } from '@/lib/api'
import { Company } from '@/types/database'

export default function CompanySelector({ userId }: { userId: string }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await getCompanies(userId)
        setCompanies(data)
        if (data.length > 0) {
          setSelectedCompany(data[0].id)
        }
      } catch (error) {
        console.error('Error loading companies:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCompanies()
  }, [userId])

  if (loading) {
    return <div className="text-gray-600">Loading companies...</div>
  }

  return (
    <select
      value={selectedCompany}
      onChange={(e) => setSelectedCompany(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
    >
      <option value="">Select a company</option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </select>
  )
}
