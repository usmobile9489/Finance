import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/serverSupabase'

// Hit daily by Vercel Cron (see vercel.json). A free Supabase project pauses after
// ~7 days with no database activity, so this cheap query keeps it awake.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = serviceClient()
    const { error } = await db.from('companies').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'ping failed' },
      { status: 500 },
    )
  }
}
