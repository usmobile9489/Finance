import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only route. The service-role key is read from a NON-public env var,
// so it never reaches the browser. Only an already-authenticated user can
// call this to create another login.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // 1) Verify the caller is a logged-in user
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createClient(url, anonKey)
  const { data: { user }, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // 2) Parse input
  let body: { email?: string; password?: string; mode?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const email = (body.email || '').trim()
  const password = body.password || ''
  const mode = body.mode === 'member' ? 'member' : 'tenant'
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 3) Figure out the caller's account. If the caller is themselves a member of
  //    someone else's account, they may ONLY add more members to that same
  //    account — they cannot spin up separate tenants.
  const { data: membership } = await admin
    .from('account_members').select('owner_id').eq('member_id', user.id).maybeSingle()
  const isMember = !!membership
  const accountOwnerId = membership?.owner_id || user.id
  if (mode === 'tenant' && isMember) {
    return NextResponse.json({ error: 'Only the account owner can create a separate account.' }, { status: 403 })
  }

  // 4) Create the user (service-role bypasses disabled signup)
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 5) "member" → link to the caller's account owner (shared workspace).
  //    "tenant" → leave isolated with their own empty workspace.
  if (mode === 'member' && created?.user?.id) {
    const { error: linkErr } = await admin.from('account_members').insert({ owner_id: accountOwnerId, member_id: created.user.id })
    if (linkErr) return NextResponse.json({ error: 'User created but linking failed: ' + linkErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mode })
}
