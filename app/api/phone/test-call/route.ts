import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient, digits, placeCall } from '@/lib/serverSupabase'

// Places a test call to the owner's phone to confirm SignalWire is set up right.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: { user } } = await createClient(url, anon).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = serviceClient()
  const { data: sw } = await db.from('signalwire_settings').select('*').eq('owner_id', user.id).maybeSingle()
  if (!sw) return NextResponse.json({ error: 'Save your SignalWire settings first.' }, { status: 400 })
  const missing = ['space_url', 'project_id', 'api_token', 'phone_number', 'owner_phone'].filter(k => !sw[k])
  if (missing.length) return NextResponse.json({ error: 'Missing: ' + missing.join(', ') }, { status: 400 })

  const origin = new URL(req.url).origin
  try {
    await placeCall(sw, '+' + digits(sw.owner_phone), `${origin}/api/ivr/test-say`)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Call failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
