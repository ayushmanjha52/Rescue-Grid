import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireDma } from '@/lib/auth/dma'
import { bboxAround, haversineKm } from '@/lib/geo'
import { parseList, sanitizeFilterTerm } from '@/lib/skills'
import { resolveSkillCodes, volunteerIdsWithSkills } from '@/lib/volunteerSearch'

interface ScoredSearchBody {
  latitude: number
  longitude: number
  radius_km?: number
  skill_codes?: string[]
  equipment?: string[]
  status?: string
  limit?: number
}

interface CandidateRow {
  id: string
  name: string
  type: string | null
  latitude: number
  longitude: number
  tier: number | null
  status: string
  last_seen: string | null
  skills: string | null
  equipment: string | null
  volunteer_skills: { skill_definitions: { name: string } | null }[] | null
}

function availabilityScore(status: string, lastSeen: string | null): number {
  if (status !== 'active') return 0
  if (!lastSeen) return 0.1
  const ageMs = Date.now() - new Date(lastSeen).getTime()
  if (ageMs < 15 * 60 * 1000) return 1.0
  if (ageMs < 60 * 60 * 1000) return 0.7
  if (ageMs < 6 * 60 * 60 * 1000) return 0.4
  return 0.1
}

/**
 * Ranks volunteers for a mission location.
 * score = 0.40 · tier + 0.35 · proximity + 0.25 · availability (+ bonus when skills match)
 */
export async function POST(req: NextRequest) {
  const auth = await requireDma()
  if (auth.response) return auth.response

  const body: ScoredSearchBody = await req.json().catch(() => ({}))
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
  }

  const radiusKm = Math.min(Math.max(Number(body.radius_km) || 50, 1), 500)
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100)
  const status = body.status || 'active'
  const equipment = (body.equipment || []).map(sanitizeFilterTerm).filter(Boolean)

  const supabase = createServiceClient()

  let skillMatches: Set<string> | null = null
  if (body.skill_codes && body.skill_codes.length > 0) {
    skillMatches = await volunteerIdsWithSkills(supabase, await resolveSkillCodes(supabase, body.skill_codes))
    if (skillMatches.size === 0) {
      return NextResponse.json({ volunteers: [], meta: { total: 0, center: { latitude, longitude }, radius_km: radiusKm } })
    }
  }

  const box = bboxAround(latitude, longitude, radiusKm)
  let query = supabase
    .from('volunteer')
    .select(`
      id, name, type, latitude, longitude, tier, status, last_seen, skills, equipment,
      volunteer_skills(skill_definitions(name))
    `)
    .gte('latitude', box.minLat)
    .lte('latitude', box.maxLat)
    .gte('longitude', box.minLng)
    .lte('longitude', box.maxLng)

  if (status !== 'all') query = query.eq('status', status)
  if (skillMatches) query = query.in('id', [...skillMatches])
  if (equipment.length > 0) {
    query = query.or(equipment.map((e) => `equipment.ilike.%${e}%`).join(','))
  }

  const { data, error } = await query.limit(500)
  if (error) {
    console.error('Scored volunteer search error:', error)
    return NextResponse.json({ error: 'Failed to search volunteers' }, { status: 500 })
  }

  const scored = ((data || []) as unknown as CandidateRow[])
    .map((v) => {
      const distanceKm = haversineKm(latitude, longitude, v.latitude, v.longitude)
      if (distanceKm > radiusKm) return null

      const proximity = 1 - distanceKm / radiusKm
      const tierScore = (v.tier || 1) / 4
      const skillBonus = skillMatches ? 0.1 : 0
      const score = 0.4 * tierScore + 0.35 * proximity + 0.25 * availabilityScore(v.status, v.last_seen) + skillBonus

      const normalizedSkills = (v.volunteer_skills || [])
        .map((vs) => vs.skill_definitions?.name)
        .filter((name): name is string => !!name)

      return {
        id: v.id,
        name: v.name,
        type: v.type,
        latitude: v.latitude,
        longitude: v.longitude,
        tier: v.tier,
        status: v.status,
        last_seen: v.last_seen,
        skills: normalizedSkills.length > 0 ? normalizedSkills : parseList(v.skills),
        equipment: parseList(v.equipment),
        score: Math.round(Math.min(score, 1) * 10000) / 10000,
        distance_km: Math.round(distanceKm * 10) / 10,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return NextResponse.json({
    volunteers: scored,
    meta: { total: scored.length, center: { latitude, longitude }, radius_km: radiusKm },
  })
}
