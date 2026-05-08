import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '0')
  const lng = parseFloat(searchParams.get('lng') ?? '0')

  const rings = [
    { label: '0–20km',   min: 0,  max: 20  },
    { label: '20–60km',  min: 20, max: 60  },
    { label: '60–100km', min: 60, max: 100 },
  ]

  const results = await Promise.all(rings.map(async (ring) => {
    const { data: categoryStats } = await supabase
      .from('volunteer')
      .select(`
        latitude,
        longitude,
        tier,
        volunteer_skills!inner(skill_definitions!inner(category:skill_categories(code)))
      `)
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    const byCategory: Record<string, { count: number; maxTier: number; totalTier: number }> = {}

    for (const v of (categoryStats || []) as any[]) {
      const distKm = 6371 * 2 * Math.asin(
        Math.sqrt(
          Math.pow(Math.sin(((v.latitude - lat) * Math.PI) / 360), 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((v.latitude * Math.PI) / 180) *
          Math.pow(Math.sin(((v.longitude - lng) * Math.PI) / 360), 2)
        )
      )

      if (distKm < ring.min || distKm > ring.max) continue

      const category = (v as any).volunteer_skills?.[0]?.skill_definitions?.category?.code || 'UNKNOWN'
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, maxTier: 0, totalTier: 0 }
      }
      byCategory[category].count++
      byCategory[category].totalTier += v.tier || 1
      byCategory[category].maxTier = Math.max(byCategory[category].maxTier, v.tier || 1)
    }

    const coverage = Object.entries(byCategory).map(([category, stats]) => ({
      category,
      volunteer_count: stats.count,
      max_tier: stats.maxTier,
      avg_tier: Math.round((stats.totalTier / stats.count) * 100) / 100
    }))

    return { ring: ring.label, coverage }
  }))

  return NextResponse.json({ center: { lat, lng }, rings: results })
}
