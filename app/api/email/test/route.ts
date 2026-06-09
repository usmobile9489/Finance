import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/serverSupabase'
import nodemailer from 'nodemailer'

// Sends a test email using the owner's saved SMTP settings.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: { user } } = await createClient(url, anon).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { to?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const to = (body.to || '').trim()
  if (!to.includes('@')) return NextResponse.json({ error: 'Enter a valid recipient email' }, { status: 400 })

  const db = serviceClient()
  const { data: s } = await db.from('smtp_settings').select('*').eq('owner_id', user.id).maybeSingle()
  if (!s || !s.host || !s.from_email) return NextResponse.json({ error: 'SMTP is not set up yet.' }, { status: 503 })

  try {
    const transporter = nodemailer.createTransport({
      host: s.host, port: s.port || 587, secure: !!s.secure,
      auth: s.username ? { user: s.username, pass: s.password } : undefined,
    })
    await transporter.sendMail({
      from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email,
      to,
      subject: 'Test email from your Finance dashboard',
      text: 'Success! Your SMTP settings are working.',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Send failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
