import { NextRequest } from 'next/server'
import { serviceClient, digits, xml, escapeXml } from '@/lib/serverSupabase'

// SignalWire posts form-encoded data here for the inbound IVR.
// State is carried in the ?step=... query string; gathered digits arrive as `Digits`.
//
// Configure in SignalWire: set the number's inbound voice webhook to
//   https://YOUR-DOMAIN/api/ivr/voice   (HTTP POST)

const fmtMoney = (n: number) => 'about ' + Math.round(n) + ' dollars'

async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const origin = url.origin
  const step = url.searchParams.get('step') || 'start'
  const q = url.searchParams

  // Read SignalWire's POST body
  let From = '', To = '', Digits = ''
  try {
    const form = await req.formData()
    From = String(form.get('From') || '')
    To = String(form.get('To') || '')
    Digits = String(form.get('Digits') || '')
  } catch { /* ignore */ }

  const db = serviceClient()
  const gather = (action: string, prompt: string, numDigits = 6) =>
    xml(`<Gather input="dtmf" numDigits="${numDigits}" finishOnKey="#" timeout="8" action="${origin}/api/ivr/voice?${action}" method="POST"><Say>${prompt}</Say></Gather><Say>Sorry, I didn't get that. Goodbye.</Say><Hangup/>`)

  // Identify the account by the SignalWire number that was called (To)
  const { data: sw } = await db.from('signalwire_settings').select('*')
  const account = (sw || []).find(s => digits(s.phone_number) === digits(To)) || (sw || [])[0]

  // ── Entry ──
  if (step === 'start') {
    if (!account) return xml('<Say>This number is not configured yet. Goodbye.</Say><Hangup/>')
    return gather('step=pin', 'Welcome. Please enter your pin, followed by the pound key.')
  }

  // ── PIN check ──
  if (step === 'pin') {
    const pin = Digits
    if (account && pin && pin === account.owner_ivr_pin) {
      return gather('step=main&u=' + account.owner_id,
        'Main menu. Press 1 for personal. Press 2 for business. Press 4 to hear your balance.', 1)
    }
    // customer PIN: must match a customer linked to the calling number
    const { data: links } = await db.from('customer_contacts').select('user_id, contact_id, ivr_pin')
    const { data: contacts } = await db.from('contacts').select('id, phone')
    const fromDigits = digits(From)
    const cust = (links || []).find(l => {
      if (!l.ivr_pin || l.ivr_pin !== pin) return false
      const ct = (contacts || []).find(c => c.id === l.contact_id)
      return ct && digits(ct.phone) === fromDigits
    })
    if (cust) {
      const { data: invs } = await db.from('invoices').select('total, status').eq('contact_id', cust.contact_id)
      const unpaid = (invs || []).filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
      return xml(`<Say>You have an outstanding balance of ${fmtMoney(unpaid)}. Goodbye.</Say><Hangup/>`)
    }
    return xml('<Say>That pin was not recognized. Goodbye.</Say><Hangup/>')
  }

  const ownerId = q.get('u') || ''

  // ── Owner main menu ──
  if (step === 'main') {
    if (Digits === '1') return gather('step=p_amt&u=' + ownerId, 'Enter the amount in cents. For ten dollars fifty, enter one zero five zero, then pound.')
    if (Digits === '2') {
      const { data: cos } = await db.from('companies').select('id, name, kind').eq('user_id', ownerId).neq('kind', 'personal')
      const list = (cos || []).slice(0, 9)
      if (list.length === 0) return xml('<Say>You have no businesses set up. Goodbye.</Say><Hangup/>')
      const prompt = 'Choose a business. ' + list.map((c, i) => `Press ${i + 1} for ${escapeXml(c.name)}.`).join(' ')
      const ids = list.map(c => c.id).join(',')
      return gather('step=b_amt&u=' + ownerId + '&cos=' + encodeURIComponent(ids), prompt, 1)
    }
    if (Digits === '4') {
      const [{ data: ptx }, { data: cos }] = await Promise.all([
        db.from('personal_transactions').select('amount, type').eq('user_id', ownerId),
        db.from('companies').select('id').eq('user_id', ownerId),
      ])
      const pNet = (ptx || []).reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
      const cIds = (cos || []).map(c => c.id)
      let bizRev = 0
      if (cIds.length) {
        const { data: invs } = await db.from('invoices').select('total, cost, status').in('company_id', cIds).eq('status', 'paid')
        bizRev = (invs || []).reduce((s, i) => s + Number(i.total || 0) - Number(i.cost || 0), 0)
      }
      return xml(`<Say>Your personal balance is ${fmtMoney(pNet)}. Your business profit is ${fmtMoney(bizRev)}. Goodbye.</Say><Hangup/>`)
    }
    return xml('<Say>Goodbye.</Say><Hangup/>')
  }

  // ── Personal: amount → type → save ──
  if (step === 'p_amt') {
    const cents = parseInt(Digits || '0', 10) || 0
    return gather('step=p_save&u=' + ownerId + '&c=' + cents, 'Press 1 for income. Press 2 for expense. Press 3 for donation.', 1)
  }
  if (step === 'p_save') {
    const amount = (parseInt(q.get('c') || '0', 10) || 0) / 100
    const type = Digits === '1' ? 'income' : Digits === '3' ? 'donation' : 'expense'
    await db.from('personal_transactions').insert([{
      user_id: ownerId, date: new Date().toISOString().split('T')[0], amount, type,
      category: 'Phone Entry', description: 'Added by phone', tags: [],
    }])
    return xml(`<Say>Saved. ${type}, ${fmtMoney(amount)}. Goodbye.</Say><Hangup/>`)
  }

  // ── Business: company chosen → amount → type → save ──
  if (step === 'b_amt') {
    const cos = (q.get('cos') || '').split(',')
    const idx = (parseInt(Digits || '0', 10) || 1) - 1
    const companyId = cos[idx] || cos[0]
    return gather('step=b_amt2&u=' + ownerId + '&co=' + encodeURIComponent(companyId),
      'Enter the amount in cents, then pound.')
  }
  if (step === 'b_amt2') {
    const cents = parseInt(Digits || '0', 10) || 0
    return gather('step=b_save&u=' + ownerId + '&co=' + encodeURIComponent(q.get('co') || '') + '&c=' + cents,
      'Press 1 for income. Press 2 for expense.', 1)
  }
  if (step === 'b_save') {
    const amount = (parseInt(q.get('c') || '0', 10) || 0) / 100
    const type = Digits === '1' ? 'income' : 'expense'
    await db.from('transactions').insert([{
      company_id: q.get('co'), amount, type, description: 'Added by phone',
      transaction_date: new Date().toISOString().split('T')[0], tags: [],
    }])
    return xml(`<Say>Saved. ${type}, ${fmtMoney(amount)}. Goodbye.</Say><Hangup/>`)
  }

  return xml('<Say>Goodbye.</Say><Hangup/>')
}

export const GET = handle
export const POST = handle
