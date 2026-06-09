import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/serverSupabase'
import nodemailer from 'nodemailer'

const money = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })

// Emails an invoice to its customer using the owner's SMTP settings.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Use the caller's token so RLS only lets them read their own invoice
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { invoice_id?: string; to?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  if (!body.invoice_id) return NextResponse.json({ error: 'Missing invoice' }, { status: 400 })

  const { data: inv } = await userClient.from('invoices')
    .select('*, contacts(name,email), invoice_items(*)').eq('id', body.invoice_id).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const to = (body.to || inv.contacts?.email || '').trim()
  if (!to.includes('@')) return NextResponse.json({ error: 'No customer email on file — add one to the contact.' }, { status: 400 })

  const db = serviceClient()
  const { data: s } = await db.from('smtp_settings').select('*').eq('owner_id', user.id).maybeSingle()
  if (!s || !s.host || !s.from_email) return NextResponse.json({ error: 'Set up SMTP in Settings first.' }, { status: 503 })

  const fromName = inv.from_name || ''
  const rows = (inv.invoice_items || []).map((it: { description?: string; quantity: number; unit_price: number; line_total: number }) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${it.description || ''}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${it.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(it.unit_price)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(it.line_total)}</td></tr>`).join('')

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="margin:0">${fromName || 'Invoice'}</h2>
    <p style="color:#666">Invoice ${inv.invoice_number} · ${inv.issue_date}${inv.due_date ? ` · Due ${inv.due_date}` : ''}</p>
    <p>Bill to: <b>${inv.contacts?.name || ''}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333">Description</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #333">Qty</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #333">Price</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #333">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="text-align:right;font-size:18px"><b>Total: ${money(inv.total)}</b></p>
    ${inv.notes ? `<p style="color:#666">${inv.notes}</p>` : ''}
  </div>`

  try {
    const transporter = nodemailer.createTransport({
      host: s.host, port: s.port || 587, secure: !!s.secure,
      auth: s.username ? { user: s.username, pass: s.password } : undefined,
    })
    await transporter.sendMail({
      from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email,
      to, subject: `Invoice ${inv.invoice_number}`, html,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Send failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, to })
}
