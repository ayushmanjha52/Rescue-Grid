import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireDma } from '@/lib/auth/dma'
import { parseBBox } from '@/lib/geo'

const MAP_STATUSES = ['active', 'standby', 'on-mission']

interface VolunteerSkillRow {
  skill_definitions: { code: string; name: string; category?: { code: string } | null } | null
}

interface MapVolunteerRow {
  id: string
  name: string
  mobile_no: string
  type: string | null
  latitude: number
  longitude: number
  tier: number
  status: string
  last_seen: string | null
  skills: string | null
  equipment: string | null
  volunteer_skills: VolunteerSkillRow[] | null
}

/**
 * Viewport-scoped volunteers for the DMA map. At high zoom (≥12) pins are drawn
 * individually, so fewer rows are needed; at low zoom rows feed the clusterer.
 */
export async function GET(req: NextRequest) {
  const auth = await requireDma()
  if (auth.response) return auth.response

  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const zoom = Number.parseInt(searchParams.get('zoom') ?? '10', 10)
    const bbox = parseBBox(searchParams.get('bbox'))
    const isPinZoom = Number.isFinite(zoom) && zoom >= 12

    let query = supabase
      .from('volunteer')
      .select(`
        id, name, mobile_no, type, latitude, longitude, tier, status, last_seen, skills, equipment,
        volunteer_skills(skill_definitions(code, name, category:skill_categories(code)))
      `)
      .in('status', MAP_STATUSES)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (bbox) {
      query = query
        .gte('latitude', bbox.minLat)
        .lte('latitude', bbox.maxLat)
        .gte('longitude', bbox.minLng)
        .lte('longitude', bbox.maxLng)
    }

    const { data, error } = await query.limit(isPinZoom ? 200 : 1000)
    if (error) throw error

    const volunteers = ((data || []) as unknown as MapVolunteerRow[]).map((v) => {
      const normalized = (v.volunteer_skills || [])
        .map((vs) => vs.skill_definitions)
        .filter((sd): sd is NonNullable<typeof sd> => !!sd)
      return {
        id: v.id,
        name: v.name,
        mobile_no: v.mobile_no,
        type: v.type,
        latitude: v.latitude,
        longitude: v.longitude,
        tier: v.tier,
        status: v.status,
        last_seen: v.last_seen,
        equipment: v.equipment,
        // Prefer the normalized skill names; fall back to the free-text column.
        skills: normalized.length > 0
          ? normalized.map((sd) => sd.name)
          : (v.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
        primary_category: normalized[0]?.category?.code || 'UNKNOWN',
      }
    })

    return NextResponse.json({ type: isPinZoom ? 'pins' : 'cluster_input', data: volunteers })
  } catch (err) {
    console.error('Volunteer map error:', err)
    return NextResponse.json({ error: 'Failed to load volunteers' }, { status: 500 })
  }
}
