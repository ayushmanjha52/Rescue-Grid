import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireDma } from '@/lib/auth/dma'
import { haversineKm } from '@/lib/geo'

const RINGS = [
  { label: '0–20km', min: 0, max: 20 },
  { label: '20–60km', min: 20, max: 60 },
  { label: '60–100km', min: 60, max: 100 },
]

interface CoverageRow {
  id: string
  latitude: number
  longitude: number
  tier: number | null
  volunteer_skills: { skill_definitions: { category: { code: string } | null } | null }[] | null
}

/** Skill-category coverage of active volunteers in distance rings around a point. */
export async function GET(req: NextRequest) {
  const auth = await requireDma()
  if (auth.response) return auth.response

  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('volunteer')
    .select('id, latitude, longitude, tier, volunteer_skills(skill_definitions(category:skill_categories(code)))')
    .eq('status', 'active')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  if (error) {
    console.error('Skill gaps error:', error)
    return NextResponse.json({ error: 'Failed to compute coverage' }, { status: 500 })
  }

  const rings = RINGS.map((ring) => ({
    ring: ring.label,
    stats: {} as Record<string, { volunteers: Set<string>; maxTier: number; totalTier: number }>,
  }))

  for (const v of (data || []) as unknown as CoverageRow[]) {
    const distKm = haversineKm(lat, lng, v.latitude, v.longitude)
    const ringIndex = RINGS.findIndex((r) => distKm >= r.min && distKm <= r.max)
    if (ringIndex === -1) continue

    const categories = new Set(
      (v.volunteer_skills || [])
        .map((vs) => vs.skill_definitions?.category?.code)
        .filter((c): c is string => !!c)
    )
    if (categories.size === 0) categories.add('UNKNOWN')

    const tier = v.tier || 1
    for (const category of categories) {
      const stats = (rings[ringIndex].stats[category] ||= { volunteers: new Set(), maxTier: 0, totalTier: 0 })
      stats.volunteers.add(v.id)
      stats.totalTier += tier
      stats.maxTier = Math.max(stats.maxTier, tier)
    }
  }

  return NextResponse.json({
    center: { lat, lng },
    rings: rings.map(({ ring, stats }) => ({
      ring,
      coverage: Object.entries(stats).map(([category, s]) => ({
        category,
        volunteer_count: s.volunteers.size,
        max_tier: s.maxTier,
        avg_tier: Math.round((s.totalTier / s.volunteers.size) * 100) / 100,
      })),
    })),
  })
}
