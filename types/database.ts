export type CompanyKind = 'phone' | 'keying' | 'general' | 'personal'

export interface Company {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  address: string
  logo_url: string | null
  kind: CompanyKind
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  company_id: string
  name: string
  email: string
  phone: string
  contact_type: 'customer' | 'vendor'
  address: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  company_id: string
  name: string
  description: string | null
  base_price: number
  cost_price?: number | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ItemCustomerPrice {
  id: string
  item_id: string
  contact_id: string
  custom_price: number
  created_at: string
  updated_at: string
}

export interface ItemPricing {
  id: string
  item_id: string
  contact_id: string
  custom_price: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  company_id: string
  contact_id: string | null
  amount: number
  type: 'income' | 'expense'
  description: string
  tags: string[]
  notes: string | null
  transaction_date: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  company_id: string
  name: string
  category: 'item' | 'transaction'
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  item_id?: string | null
  description?: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Invoice {
  id: string
  company_id: string
  invoice_number: string
  contact_id: string
  subtotal: number
  tax: number
  total: number
  cost: number
  status: 'draft' | 'pending_approval' | 'sent' | 'paid'
  issue_date: string
  due_date: string
  notes: string | null
  is_recurring: boolean
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  next_recurring_date?: string
  from_name?: string | null
  from_address?: string | null
  from_email?: string | null
  from_phone?: string | null
  created_at: string
  updated_at: string
}

export interface FormField {
  id: string
  form_id: string
  label: string
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'file'
  required: boolean
  options?: string[]
  field_order: number
}

export interface Form {
  id: string
  company_id: string
  name: string
  description: string | null
  fields: FormField[]
  is_published: boolean
  slug: string | null
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  contact_id: string | null
  data: Record<string, unknown>
  submitted_at: string
  created_at: string
}
