import { NextRequest, NextResponse } from 'next/server'
import { serviceClient, digits } from '@/lib/serverSupabase'

// Verify the phone code, then create the customer's login (email + password) and
// link it to every contact that shares that phone number. Optional 4-digit IVR PIN.
export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; email?: string; password?: string; pin?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const phoneDigits = digits(body.phone)
  const code = (body.code || '').trim()
  const email = (body.email || '').trim()
  const password = body.password || ''
  const pin = (body.pin || '').trim()

  if (!email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  if (pin && !/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })

  const db = serviceClient()

  // Check the code (latest, unexpired)
  const { data: rows } = await db.from('phone_verifications').select('*')
    .eq('phone', phoneDigits).eq('code', code).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1)
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Wrong or expired code' }, { status: 400 })

  // Contacts that share this phone (could be more than one company)
  const { data: contacts } = await db.from('contacts').select('id, phone, company_id')
  const matches = (contacts || []).filter(c => digits(c.phone) === phoneDigits)
  if (matches.length === 0) return NextResponse.json({ error: 'No matching contact' }, { status: 404 })

  // Create the auth user (service role bypasses disabled public signup)
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !created?.user?.id) return NextResponse.json({ error: error?.message || 'Could not create account' }, { status: 400 })
  const userId = created.user.id

  // Link to each matching contact
  for (const m of matches) {
    const { data: company } = await db.from('companies').select('user_id').eq('id', m.company_id).maybeSingle()
    await db.from('customer_contacts').insert({
      user_id: userId, contact_id: m.id, owner_id: company?.user_id || null, ivr_pin: pin || null,
    })
  }

  // Clean up used codes for this phone
  await db.from('phone_verifications').delete().eq('phone', phoneDigits)

  return NextResponse.json({ ok: true })
}
