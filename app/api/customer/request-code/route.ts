import { NextRequest, NextResponse } from 'next/server'
import { serviceClient, digits, placeCall } from '@/lib/serverSupabase'

// A customer can only register if their phone number is already in your contacts.
// We then place a SignalWire CALL that reads them a verification code.
export async function POST(req: NextRequest) {
  let body: { phone?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const phoneDigits = digits(body.phone)
  if (phoneDigits.length < 7) return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })

  const db = serviceClient()

  // Find a contact whose phone matches (compare digits only)
  const { data: contacts } = await db.from('contacts').select('id, phone, company_id')
  const match = (contacts || []).find(c => digits(c.phone) === phoneDigits)
  if (!match) {
    return NextResponse.json({ error: 'That phone number is not on file. Ask the business to add you as a contact first.' }, { status: 404 })
  }

  // Which account owns this contact → whose SignalWire credentials to use
  const { data: company } = await db.from('companies').select('user_id').eq('id', match.company_id).maybeSingle()
  const ownerId = company?.user_id
  const { data: sw } = await db.from('signalwire_settings').select('*').eq('owner_id', ownerId).maybeSingle()
  if (!sw || !sw.space_url || !sw.project_id || !sw.api_token || !sw.phone_number) {
    return NextResponse.json({ error: 'Phone verification is not set up yet. Please contact the business.' }, { status: 503 })
  }

  // Generate + store a 4-digit code (5 min expiry)
  const code = String(Math.floor(1000 + Math.random() * 9000))
  await db.from('phone_verifications').insert({
    phone: phoneDigits, code,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  // Place the verification call → SignalWire fetches our LaML which reads the code
  const origin = new URL(req.url).origin
  const sayUrl = `${origin}/api/ivr/verify-say?phone=${encodeURIComponent(phoneDigits)}`
  try {
    await placeCall(sw, '+' + phoneDigits, sayUrl)
  } catch {
    return NextResponse.json({ error: 'Could not place the verification call. Check the number and try again.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
