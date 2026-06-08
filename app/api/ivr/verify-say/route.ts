import { NextRequest } from 'next/server'
import { serviceClient, digits, xml } from '@/lib/serverSupabase'

// SignalWire fetches this during the verification call. It reads the latest code
// aloud (twice), digit by digit, then hangs up.
async function handle(req: NextRequest) {
  const phone = digits(new URL(req.url).searchParams.get('phone'))
  const db = serviceClient()
  const { data } = await db.from('phone_verifications').select('code')
    .eq('phone', phone).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1)
  const code = data?.[0]?.code
  if (!code) return xml('<Say>Sorry, no active verification code was found. Goodbye.</Say><Hangup/>')
  const spoken = code.split('').join(' ')   // "1 2 3 4" so each digit is clear
  return xml(
    `<Pause length="1"/>` +
    `<Say>Hello. Your verification code is. ${spoken}.</Say>` +
    `<Pause length="1"/>` +
    `<Say>Again. ${spoken}.</Say>` +
    `<Say>Goodbye.</Say><Hangup/>`
  )
}

export const GET = handle
export const POST = handle
