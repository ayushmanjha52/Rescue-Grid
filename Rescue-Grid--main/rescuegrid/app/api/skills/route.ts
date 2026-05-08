import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()

  const { data: categories, error } = await supabase
    .from('skill_categories')
    .select(`
      id,
      code,
      name,
      skill_definitions(id, code, name)
    `)
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(categories || [])
}
