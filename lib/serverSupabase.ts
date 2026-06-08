import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client — SERVER ONLY. Never import into client components.
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Normalise a phone number to digits only (so "(555) 123-4567" == "5551234567")
export function digits(p: string | null | undefined): string {
  return (p || '').replace(/\D/g, '')
}

// LaML/TwiML-compatible XML response
export function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export function escapeXml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Place an outbound call via the SignalWire compatibility API.
export async function placeCall(
  creds: { space_url: string; project_id: string; api_token: string; phone_number: string },
  to: string,
  callbackUrl: string,
) {
  const base = creds.space_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const endpoint = `https://${base}/api/laml/2010-04-01/Accounts/${creds.project_id}/Calls.json`
  const auth = Buffer.from(`${creds.project_id}:${creds.api_token}`).toString('base64')
  const form = new URLSearchParams({ To: to, From: creds.phone_number, Url: callbackUrl })
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) throw new Error('SignalWire call failed: ' + (await res.text()).slice(0, 200))
  return res.json()
}
