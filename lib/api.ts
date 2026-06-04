import { supabase } from './supabase'
import { Company, Invoice, InvoiceItem, Transaction, Contact, Item, ItemCustomerPrice, Form } from '@/types/database'

// ─── Companies ───────────────────────────────────────────────────────────────

export async function getCompanies(userId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw error
  return data as Company[]
}

export async function createCompany(company: {
  user_id: string
  name: string
  email?: string
  phone?: string
  address?: string
  logo_url?: string | null
}) {
  const { data, error } = await supabase
    .from('companies')
    .insert([company])
    .select()
    .single()
  if (error) throw error
  return data as Company
}

export async function updateCompany(id: string, updates: Partial<Company>) {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Company
}

export async function deleteCompany(id: string) {
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw error
}

export async function uploadCompanyLogo(companyId: string, file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${companyId}-logo-${Date.now()}.${fileExt}`
  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(fileName, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName)
  return data.publicUrl
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(companyId: string, type?: 'customer' | 'vendor') {
  let query = supabase.from('contacts').select('*').eq('company_id', companyId)
  if (type) query = query.eq('contact_type', type)
  const { data, error } = await query.order('name')
  if (error) throw error
  return data as Contact[]
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single()
  if (error) throw error
  return data as Contact
}

export async function updateContact(id: string, updates: Partial<Contact>) {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Contact
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(companyId: string, type?: 'income' | 'expense') {
  let query = supabase
    .from('transactions')
    .select('*, contacts(name)')
    .eq('company_id', companyId)
  if (type) query = query.eq('type', type)
  const { data, error } = await query.order('transaction_date', { ascending: false })
  if (error) throw error
  return data as (Transaction & { contacts?: { name: string } | null })[]
}

export async function createTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction])
    .select()
    .single()
  if (error) throw error
  return data as Transaction
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Transaction
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function getItems(companyId: string) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw error
  return data as Item[]
}

export async function createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('items')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, updates: Partial<Item>) {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Item
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// ─── Item Customer Pricing ────────────────────────────────────────────────────

export async function getItemPricing(itemId: string) {
  const { data, error } = await supabase
    .from('item_pricing')
    .select('*, contacts(name)')
    .eq('item_id', itemId)
  if (error) throw error
  return data as (ItemCustomerPrice & { contacts?: { name: string } | null })[]
}

export async function upsertItemPricing(itemId: string, contactId: string, price: number) {
  const { data, error } = await supabase
    .from('item_pricing')
    .upsert({ item_id: itemId, contact_id: contactId, custom_price: price }, { onConflict: 'item_id,contact_id' })
    .select()
    .single()
  if (error) throw error
  return data as ItemCustomerPrice
}

export async function deleteItemPricing(id: string) {
  const { error } = await supabase.from('item_pricing').delete().eq('id', id)
  if (error) throw error
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceWithContact = Invoice & {
  contacts?: { name: string; email: string } | null
  invoice_items?: InvoiceItem[]
}

export async function getInvoices(companyId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, contacts(name, email), invoice_items(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as InvoiceWithContact[]
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  lineItems: Array<{ description: string; quantity: number; unit_price: number; line_total: number; item_id?: string | null }>
) {
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert([invoice])
    .select()
    .single()
  if (error) throw error

  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(lineItems.map(li => ({ ...li, invoice_id: inv.id })))
    if (itemsError) throw itemsError
  }

  return inv as Invoice
}

export async function updateInvoice(id: string, updates: Partial<Invoice>) {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Invoice
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export async function getForms(companyId: string) {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_fields(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(f => ({
    ...f,
    fields: ((f.form_fields as unknown[]) || []).sort(
      (a: unknown, b: unknown) =>
        ((a as { field_order: number }).field_order || 0) -
        ((b as { field_order: number }).field_order || 0)
    ),
  })) as Form[]
}

export async function getFormById(formId: string) {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_fields(*)')
    .eq('id', formId)
    .single()
  if (error) throw error
  return {
    ...data,
    fields: ((data.form_fields as unknown[]) || []).sort(
      (a: unknown, b: unknown) =>
        ((a as { field_order: number }).field_order || 0) -
        ((b as { field_order: number }).field_order || 0)
    ),
  } as Form
}

export async function getPublicFormById(formId: string) {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_fields(*), companies(name, logo_url)')
    .eq('id', formId)
    .eq('is_published', true)
    .single()
  if (error) throw error
  return {
    ...data,
    fields: ((data.form_fields as unknown[]) || []).sort(
      (a: unknown, b: unknown) =>
        ((a as { field_order: number }).field_order || 0) -
        ((b as { field_order: number }).field_order || 0)
    ),
  } as Form & { companies?: { name: string; logo_url: string | null } | null }
}

export async function toggleFormPublished(formId: string, published: boolean) {
  const { data, error } = await supabase
    .from('forms')
    .update({ is_published: published })
    .eq('id', formId)
    .select()
    .single()
  if (error) throw error
  return data as Form
}

export async function createForm(
  form: { company_id: string; name: string; description?: string },
  fields: Array<{ label: string; type: string; required: boolean; options?: string[]; field_order: number }>
) {
  const { data: newForm, error } = await supabase
    .from('forms')
    .insert([{ company_id: form.company_id, name: form.name, description: form.description || null }])
    .select()
    .single()
  if (error) throw error

  if (fields.length > 0) {
    const { error: fieldsError } = await supabase
      .from('form_fields')
      .insert(fields.map(f => ({ ...f, form_id: newForm.id })))
    if (fieldsError) throw fieldsError
  }

  return newForm as Form
}

export async function updateForm(
  formId: string,
  updates: { name?: string; description?: string },
  fields?: Array<{ label: string; type: string; required: boolean; options?: string[]; field_order: number }>
) {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', formId)
    .select()
    .single()
  if (error) throw error

  if (fields !== undefined) {
    await supabase.from('form_fields').delete().eq('form_id', formId)
    if (fields.length > 0) {
      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fields.map(f => ({ ...f, form_id: formId })))
      if (fieldsError) throw fieldsError
    }
  }

  return data as Form
}

export async function deleteForm(id: string) {
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) throw error
}

export async function getFormSubmissions(formId: string) {
  const { data, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}

export async function submitForm(formId: string, formData: Record<string, unknown>, contactId?: string) {
  const { data, error } = await supabase
    .from('form_submissions')
    .insert([{ form_id: formId, data: formData, contact_id: contactId || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Keying Prices ───────────────────────────────────────────────────────────

export interface KeyingPrice {
  id: string
  company_id: string
  brand: string
  cylinder_type: string | null
  price_per_key: number
}

export async function getKeyingPrices(companyId: string) {
  const { data, error } = await supabase
    .from('keying_prices')
    .select('*')
    .eq('company_id', companyId)
    .order('brand')
  if (error) throw error
  return data as KeyingPrice[]
}

export async function upsertKeyingPrice(companyId: string, brand: string, cylinderType: string, price: number) {
  const { data, error } = await supabase
    .from('keying_prices')
    .upsert({ company_id: companyId, brand, cylinder_type: cylinderType, price_per_key: price }, { onConflict: 'company_id,brand,cylinder_type' })
    .select()
    .single()
  if (error) throw error
  return data as KeyingPrice
}

export async function deleteKeyingPrice(id: string) {
  const { error } = await supabase.from('keying_prices').delete().eq('id', id)
  if (error) throw error
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getTotalIncome(companyId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('company_id', companyId)
    .eq('type', 'income')
  if (error) throw error
  return (data || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
}

export async function getTotalExpenses(companyId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('company_id', companyId)
    .eq('type', 'expense')
  if (error) throw error
  return (data || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
}
