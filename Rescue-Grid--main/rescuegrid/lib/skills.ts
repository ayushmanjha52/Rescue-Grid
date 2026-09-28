// The skill taxonomy lives in the database (skill_categories / skill_definitions,
// served by GET /api/skills). Equipment is still free text, so the common
// options are listed here for filter chips.

export const EQUIPMENT_OPTIONS = [
  { value: "boat", label: "Boat" },
  { value: "ladder", label: "Ladder" },
  { value: "radio", label: "Radio" },
  { value: "first aid kit", label: "First Aid Kit" },
  { value: "stretcher", label: "Stretcher" },
  { value: "flashlight", label: "Flashlight" },
  { value: "generator", label: "Generator" },
  { value: "chainsaw", label: "Chainsaw" },
  { value: "rope", label: "Rope" },
  { value: "life jacket", label: "Life Jacket" },
  { value: "medical kit", label: "Medical Kit" },
  { value: "oxygen", label: "Oxygen" },
  { value: "ambulance", label: "Ambulance" },
  { value: "truck", label: "Truck" },
  { value: "drone", label: "Drone" },
] as const;

export interface SkillDefinition {
  id: number;
  code: string;
  name: string;
}

export interface SkillCategory {
  id: number;
  code: string;
  name: string;
  skill_definitions: SkillDefinition[];
}

/** Splits a comma separated text column into trimmed values. */
export function parseList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Makes a free-text term safe to embed in a PostgREST filter string. */
export function sanitizeFilterTerm(term: string): string {
  return term.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 50);
}
