import { xml } from '@/lib/serverSupabase'

// SignalWire fetches this for the "test call" — it just confirms setup works.
function handle() {
  return xml('<Pause length="1"/><Say>Hello. This is a test call from your finance dashboard. Your phone setup is working correctly. Goodbye.</Say><Hangup/>')
}
export const GET = handle
export const POST = handle
