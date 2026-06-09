import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient, digits } from '@/lib/serverSupabase'

// Checks the code; on success records that this user passed 2FA.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: { user } } = await createClient(url, anon).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const code = (body.code || '').trim()

  const db = serviceClient()
  const { data: sw } = await db.from('signalwire_settings').select('owner_phone').eq('owner_id', user.id).maybeSingle()
  if (!sw?.owner_phone) return NextResponse.json({ error: '2FA not set up' }, { status: 400 })
  const phone = digits(sw.owner_phone)

  const { data: rows } = await db.from('phone_verifications').select('id')
    .eq('phone', phone).eq('code', code).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1)
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Wrong or expired code' }, { status: 400 })

  await db.from('mfa_verifications').upsert({ user_id: user.id, verified_at: new Date().toISOString() })
  await db.from('phone_verifications').delete().eq('phone', phone)
  return NextResponse.json({ ok: true })
}
