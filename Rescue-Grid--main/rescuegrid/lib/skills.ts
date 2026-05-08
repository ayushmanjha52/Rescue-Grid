export const SKILL_OPTIONS = [
  { value: "medical", label: "Medical", description: "First aid, CPR, medical rescue" },
  { value: "first-aid", label: "First Aid", description: "Basic first aid certified" },
  { value: "rescue", label: "Rescue", description: "General rescue operations" },
  { value: "swimming", label: "Swimming", description: "Strong swimming ability" },
  { value: "climbing", label: "Climbing", description: "Rock/mountain climbing" },
  { value: "driving", label: "Driving", description: "Vehicle operation" },
  { value: "communications", label: "Communications", description: "Radio/communication equipment" },
  { value: "logistics", label: "Logistics", description: "Supply chain and coordination" },
  { value: "search", label: "Search & Rescue", description: "Search and rescue operations" },
  { value: "firefighting", label: "Firefighting", description: "Fire suppression certified" },
  { value: "water-rescue", label: "Water Rescue", description: "Flood/water rescue" },
  { value: "extraction", label: "Extraction", description: "Victim extraction" },
  { value: "navigation", label: "Navigation", description: "GPS/map navigation" },
  { value: "heavy-equipment", label: "Heavy Equipment", description: "Excavator/crane operation" },
  { value: "diving", label: "Diving", description: "Scuba/diving certified" },
] as const;

export const EQUIPMENT_OPTIONS = [
  { value: "boat", label: "Boat", description: "Motor/row boat" },
  { value: "ladder", label: "Ladder", description: "Extension/rescue ladder" },
  { value: "radio", label: "Radio", description: "Communication radio" },
  { value: "first-aid-kit", label: "First Aid Kit", description: "Medical supplies" },
  { value: "stretcher", label: "Stretcher", description: "Medical stretcher" },
  { value: "flashlight", label: "Flashlight", description: "Tactical flashlight" },
  { value: "generator", label: "Generator", description: "Portable generator" },
  { value: "chainsaw", label: "Chainsaw", description: "Power chainsaw" },
  { value: "rope", label: "Rope", description: "Rescue rope" },
  { value: "life-jacket", label: "Life Jacket", description: "Personal flotation device" },
  { value: "helmet", label: "Helmet", description: "Safety/rescue helmet" },
  { value: "gps", label: "GPS", description: "GPS device" },
  { value: "satellite-phone", label: "Satellite Phone", description: "Satellite communication" },
  { value: "snorkel", label: "Snorkel Gear", description: "Diving/snorkeling equipment" },
  { value: "cutting-equipment", label: "Cutting Equipment", description: "Hydraulic cutters" },
] as const;

export type SkillValue = typeof SKILL_OPTIONS[number]["value"];
export type EquipmentValue = typeof EQUIPMENT_OPTIONS[number]["value"];

export function parseSkills(skills: string | null | undefined): string[] {
  if (!skills) return [];
  return skills.split(",").map(s => s.trim()).filter(Boolean);
}

export function stringifySkills(skills: string[]): string {
  return skills.join(", ");
}
