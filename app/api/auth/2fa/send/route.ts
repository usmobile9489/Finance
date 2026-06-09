import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient, digits, placeCall } from '@/lib/serverSupabase'

// Places a SignalWire call to the owner's phone with a 4-digit login code.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: { user } } = await createClient(url, anon).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = serviceClient()
  const { data: sw } = await db.from('signalwire_settings').select('*').eq('owner_id', user.id).maybeSingle()
  if (!sw || !sw.require_2fa) return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })
  if (!sw.space_url || !sw.project_id || !sw.api_token || !sw.phone_number || !sw.owner_phone) {
    return NextResponse.json({ error: 'SignalWire / your phone number is not fully set up.' }, { status: 503 })
  }

  const phone = digits(sw.owner_phone)
  const code = String(Math.floor(1000 + Math.random() * 9000))
  await db.from('phone_verifications').insert({
    phone, code, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  const origin = new URL(req.url).origin
  try {
    await placeCall(sw, '+' + phone, `${origin}/api/ivr/verify-say?phone=${encodeURIComponent(phone)}`)
  } catch {
    return NextResponse.json({ error: 'Could not place the verification call.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
