/**
 * PBX Supabase Client
 * ====================
 * Connects to the PBX Supabase project (separate from Finance).
 *
 * Add to Finance .env.local:
 *   NEXT_PUBLIC_PBX_SUPABASE_URL=https://mhconoaofplhtftliwto.supabase.co
 *   NEXT_PUBLIC_PBX_SUPABASE_ANON_KEY=your-pbx-anon-key
 *   NEXT_PUBLIC_VM_BASE_URL=http://65.38.98.159/vm_serve.php
 *   NEXT_PUBLIC_VM_TOKEN=your-vm-token
 *
 * Copy this file to: Finance/lib/pbx.ts
 */

import { createClient } from '@supabase/supabase-js'

// Fall back to a harmless placeholder when the PBX env vars aren't set, so that
// importing this file never throws at build/runtime. PBX queries will simply
// fail gracefully until NEXT_PUBLIC_PBX_SUPABASE_* are configured.
const pbxUrl = process.env.NEXT_PUBLIC_PBX_SUPABASE_URL || 'https://placeholder.supabase.co'
const pbxKey = process.env.NEXT_PUBLIC_PBX_SUPABASE_ANON_KEY || 'placeholder'

export const pbxConfigured = Boolean(process.env.NEXT_PUBLIC_PBX_SUPABASE_URL && process.env.NEXT_PUBLIC_PBX_SUPABASE_ANON_KEY)

export const pbx = createClient(pbxUrl, pbxKey)

// NOTE: Finance login/auth uses the Finance project (@/lib/supabase). This
// `authClient` is kept only for any PBX-specific auth and points at the PBX
// project — do not use it for Finance data.
export const authClient = createClient(pbxUrl, pbxKey)

// Voicemail server (legacy fallback)
export const VM_BASE_URL = process.env.NEXT_PUBLIC_VM_BASE_URL || ''
export const VM_TOKEN = process.env.NEXT_PUBLIC_VM_TOKEN || ''

// ── Types ────────────────────────────────────────────

export interface MissedCall {
  id: string
  caller_number: string
  caller_name: string | null
  call_datetime: string
  has_voicemail: boolean
  voicemail_deleted: boolean
  voicemail_duration: number | null
  voicemail_file: string | null
  is_read: boolean
  parsha_name: string | null
  notes: string | null
}

export interface PbxContact {
  id: string
  phone: string
  name: string | null
  hebrew_name: string | null
  email: string | null
  mobile2: string | null
  home_phone: string | null
  work_phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  spouse_name: string | null
  spouse_hebrew_name: string | null
  spouse_phone: string | null
  announce_balance: boolean
  created_at: string
}

// ── Helpers ──────────────────────────────────────────

export function getVoicemailUrl(call: MissedCall): string | null {
  if (!call.voicemail_file) return null
  if (call.voicemail_file.startsWith('http')) return call.voicemail_file
  const fname = call.voicemail_file.split('/').pop()?.replace('.wav', '') || ''
  return `${VM_BASE_URL}?file=${fname}&token=${VM_TOKEN}`
}

export function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (n.length === 10) return `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`
  return phone
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}
