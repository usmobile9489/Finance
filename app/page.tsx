'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Finance Platform</h1>
          <div className="flex gap-3">
            <Link href="/auth/login" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Manage Your Finances<br />
            <span className="text-indigo-600">All in One Place</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Track income and expenses, create professional invoices, manage contacts, and analyze your business across multiple companies.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/login" className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors">
              Sign In
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '📊', title: 'Dashboard', desc: 'View income, expenses, and profit/loss analytics across all your companies in real-time.' },
            { icon: '📄', title: 'Invoicing', desc: 'Create professional invoices, set up recurring billing, and track payment status.' },
            { icon: '💸', title: 'Transactions', desc: 'Record income and expenses with tags, notes, and contact associations.' },
            { icon: '👥', title: 'Contacts', desc: 'Manage customers and vendors with full contact details and history.' },
            { icon: '📦', title: 'Items & Services', desc: 'Build a catalog of products and services with custom pricing per customer.' },
            { icon: '📋', title: 'Custom Forms', desc: 'Build custom forms to collect data and manage submissions from customers.' },
          ].map(feature => (
            <div key={feature.title} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
