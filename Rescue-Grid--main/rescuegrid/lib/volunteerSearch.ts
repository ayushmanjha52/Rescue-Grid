import type { createServiceClient } from '@/lib/supabase/service';
import { sanitizeFilterTerm } from '@/lib/skills';

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface ResolvedSkills {
  ids: number[];
  /** Codes and display names — used to match the legacy free-text `skills` column. */
  terms: string[];
}

/** Looks up skill definitions by code so both skill storage formats can be matched. */
export async function resolveSkillCodes(supabase: ServiceClient, codes: string[]): Promise<ResolvedSkills> {
  const clean = codes.map(sanitizeFilterTerm).filter(Boolean);
  if (clean.length === 0) return { ids: [], terms: [] };

  const { data } = await supabase
    .from('skill_definitions')
    .select('id, code, name')
    .in('code', clean);

  const ids = (data || []).map((d: { id: number }) => d.id);
  const terms = new Set<string>(clean);
  for (const d of data || []) terms.add(sanitizeFilterTerm(d.name));
  return { ids, terms: [...terms].filter(Boolean) };
}

/** Volunteer ids that have any of the given skills in either storage format. */
export async function volunteerIdsWithSkills(supabase: ServiceClient, skills: ResolvedSkills): Promise<Set<string>> {
  const ids = new Set<string>();
  if (skills.ids.length > 0) {
    const { data } = await supabase.from('volunteer_skills').select('volunteer_id').in('skill_id', skills.ids);
    for (const row of data || []) ids.add(row.volunteer_id);
  }
  if (skills.terms.length > 0) {
    const { data } = await supabase
      .from('volunteer')
      .select('id')
      .or(skills.terms.map((t) => `skills.ilike.%${t}%`).join(','));
    for (const row of data || []) ids.add(row.id);
  }
  return ids;
}
