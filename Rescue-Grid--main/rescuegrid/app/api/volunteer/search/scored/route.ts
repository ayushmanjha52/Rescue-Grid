import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

interface SearchParams {
  latitude: number
  longitude: number
  radius_km?: number
  skill_codes?: string[]
  limit?: number
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body: SearchParams = await req.json()
  const {
    latitude,
    longitude,
    radius_km = 100,
    skill_codes = [],
    limit = 50,
  } = body

  let skillIds: number[] = []
  if (skill_codes.length > 0) {
    const { data: rows } = await supabase
      .from('skill_definitions')
      .select('id')
      .in('code', skill_codes)
    skillIds = rows?.map((r: any) => r.id) || []
  }

  const latDelta = radius_km / 111.0
  const lngDelta = radius_km / (111.0 * Math.cos((latitude * Math.PI) / 180))

  const { data: volunteers, error } = await supabase
    .from('volunteer')
    .select(`
      id,
      name,
      mobile_no,
      latitude,
      longitude,
      tier,
      status,
      last_seen,
      volunteer_skills!inner(skill_id)
    `)
    .eq('status', 'active')
    .gte('latitude', latitude - latDelta)
    .lte('latitude', latitude + latDelta)
    .gte('longitude', longitude - lngDelta)
    .lte('longitude', longitude + lngDelta)
    .limit(Math.min(limit * 2, 100))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!volunteers || volunteers.length === 0) {
    return NextResponse.json({ volunteers: [], meta: { total: 0, center: { latitude, longitude }, radius_km } })
  }

  const scored = volunteers
    .map((v: any) => {
      const distKm = 6371 * 2 * Math.asin(
        Math.sqrt(
          Math.pow(Math.sin(((v.latitude - latitude) * Math.PI) / 360), 2) +
          Math.cos((latitude * Math.PI) / 180) * Math.cos((v.latitude * Math.PI) / 180) *
          Math.pow(Math.sin(((v.longitude - longitude) * Math.PI) / 360), 2)
        )
      )

      if (distKm > radius_km) return null

      const proximityScore = 1.0 - (distKm / radius_km)
      const availScore = v.status === 'active'
        ? (v.last_seen && new Date(v.last_seen) > new Date(Date.now() - 15 * 60 * 1000) ? 1.0
          : v.last_seen && new Date(v.last_seen) > new Date(Date.now() - 60 * 60 * 1000) ? 0.7
          : v.last_seen && new Date(v.last_seen) > new Date(Date.now() - 6 * 60 * 60 * 1000) ? 0.4
          : 0.1)
        : 0.0
      const skillScore = ((v.tier || 1) / 4.0)
      const score = 0.40 * skillScore + 0.35 * proximityScore + 0.25 * availScore

      return { ...v, score: Math.round(score * 10000) / 10000, distance_km: Math.round(distKm * 100) / 100 }
    })
    .filter((v: any) => v !== null && v.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, Math.min(limit, 100))

  const formatted = scored.map((v: any) => ({
    id: v.id,
    name: v.name,
    mobile_no: v.mobile_no,
    latitude: v.latitude,
    longitude: v.longitude,
    tier: v.tier,
    status: v.status,
    last_seen: v.last_seen,
    skills: v.volunteer_skills?.map((vs: any) => vs.skill_id) || [],
    score: v.score,
    distance_km: v.distance_km
  }))

  return NextResponse.json({
    volunteers: formatted,
    meta: {
      total: formatted.length,
      center: { latitude, longitude },
      radius_km,
    },
  })
}
