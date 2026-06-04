'use client'

import Image from 'next/image'
import { Invoice, InvoiceItem } from '@/types/database'

interface InvoiceTemplateProps {
  invoice: Invoice
  lineItems?: InvoiceItem[]
  company: {
    id: string
    name: string
    email: string
    phone: string
    address: string
    logo_url: string | null
  }
  contact: {
    name: string
    email: string
    address: string
  }
}

export default function InvoiceTemplate({ invoice, lineItems = [], company, contact }: InvoiceTemplateProps) {
  return (
    <div className="bg-white p-12 shadow-2xl rounded-lg max-w-4xl mx-auto">
      {/* Header with Logo */}
      <div className="flex justify-between items-start mb-12 pb-8 border-b-2 border-gray-200">
        <div className="flex-1">
          {company.logo_url && (
            <Image
              src={company.logo_url}
              alt={company.name}
              width={150}
              height={60}
              className="mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-gray-600 mt-2">{company.address}</p>
          <p className="text-gray-600">{company.email} | {company.phone}</p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-bold text-indigo-600 mb-4">INVOICE</div>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-semibold">Invoice #:</span> {invoice.invoice_number}</p>
            <p><span className="font-semibold">Issue Date:</span> {invoice.issue_date}</p>
            <p><span className="font-semibold">Due Date:</span> {invoice.due_date}</p>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Bill To</h3>
          <p className="text-lg font-semibold text-gray-900">{contact.name}</p>
          <p className="text-gray-600">{contact.address}</p>
          <p className="text-gray-600">{contact.email}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Payment Terms</h3>
          <p className="text-gray-900">Due within 30 days of invoice date</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-12">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-t-2 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 w-20">Qty</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 w-24">Price</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-4 text-sm text-gray-900">{item.description || `Item ${idx + 1}`}</td>
                <td className="px-4 py-4 text-right text-sm text-gray-900">{item.quantity}</td>
                <td className="px-4 py-4 text-right text-sm text-gray-900">${Number(item.unit_price).toFixed(2)}</td>
                <td className="px-4 py-4 text-right text-sm font-semibold text-gray-900">
                  ${Number(item.line_total).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-64">
          <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
            <span className="text-gray-700">Subtotal:</span>
            <span className="text-gray-900 font-semibold">${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-4 pb-4 border-b-2 border-gray-300">
            <span className="text-gray-700">Tax:</span>
            <span className="text-gray-900 font-semibold">${invoice.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-indigo-50 px-4 py-3 rounded">
            <span className="text-lg font-bold text-gray-900">Total Due:</span>
            <span className="text-2xl font-bold text-indigo-600">${invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
        <p>Thank you for your business!</p>
        <p>This invoice is automatically generated and requires no signature.</p>
      </div>
    </div>
  )
}
