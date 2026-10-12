import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Uptime check that also keeps the database awake. Supabase pauses free
// projects that see no database activity for a week, so this runs a real
// (tiny) query every time. It is called by the Vercel cron in vercel.json and
// by .github/workflows/keep-alive.yml, and works with any uptime monitor.
export async function GET() {
  const started = Date.now()
  const { error } = await createServiceClient()
    .from('skill_categories')
    .select('id', { count: 'exact', head: true })

  const body = {
    status: error ? 'degraded' : 'ok',
    database: error ? 'unreachable' : 'up',
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  }

  if (error) console.error('Health check failed:', error.message)

  return NextResponse.json(body, {
    status: error ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
