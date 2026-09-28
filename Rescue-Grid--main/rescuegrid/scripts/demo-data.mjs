// Adds or removes clearly-marked demo data so the dashboards can be tried out.
//
//   bun run db:demo -- add      8 "DEMO …" volunteers, 5 "[DEMO]" reports, 4 missions
//   bun run db:demo -- remove   deletes everything marked DEMO
//
// Demo phone numbers start with +91 0…, which no real Indian mobile does.
// Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const mode = process.argv[2];
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

async function remove() {
  const reports = must(await db.from("victim_report").select("id").like("custom_message", "[DEMO]%"), "find reports").map((r) => r.id);
  const assignments = must(await db.from("assignment").select("id").like("task", "[DEMO]%"), "find missions").map((a) => a.id);
  const volunteers = must(await db.from("volunteer").select("id").like("name", "DEMO %"), "find volunteers").map((v) => v.id);

  if (assignments.length) must(await db.from("message").delete().in("assignment_id", assignments), "delete mission updates");
  if (reports.length) must(await db.from("message").delete().in("victim_report_id", reports), "delete report messages");
  if (volunteers.length) {
    const ids = volunteers.join(",");
    must(await db.from("message").delete().or(`sender_id.in.(${ids}),receiver_id.in.(${ids})`), "delete volunteer messages");
  }
  if (assignments.length) must(await db.from("assignment").delete().in("id", assignments), "delete missions");
  if (reports.length) must(await db.from("victim_report").delete().in("id", reports), "delete reports");
  if (volunteers.length) must(await db.from("volunteer").delete().in("id", volunteers), "delete volunteers");
  console.log(`✓ Removed demo data: ${volunteers.length} volunteers, ${reports.length} reports, ${assignments.length} missions`);
}

async function add() {
  await remove(); // start clean so running "add" twice doesn't duplicate

  const skillDefs = must(await db.from("skill_definitions").select("id, code"), "load skills");
  const skill = (i) => skillDefs[i % Math.max(skillDefs.length, 1)];

  const volunteerSeed = [
    { name: "DEMO Priya Sharma", type: "NGO", status: "on-mission", joined: 4320, seen: 1, lat: 23.7962, lng: 86.4311, skills: [0, 1] },
    { name: "DEMO Rahul Verma", type: "NDRF", status: "on-mission", joined: 5760, seen: 2, lat: 23.8104, lng: 86.4402, skills: [2, 3] },
    { name: "DEMO Anjali Singh", type: "Individual", status: "on-mission", joined: 2880, seen: 4, lat: 23.7815, lng: 86.4208, skills: [4] },
    { name: "DEMO Vikram Yadav", type: "Police", status: "on-mission", joined: 7200, seen: 3, lat: 23.8013, lng: 86.4497, skills: [5, 6] },
    { name: "DEMO Sunita Devi", type: "Individual", status: "active", joined: 90, seen: 1, lat: 23.7899, lng: 86.4350, skills: [0] },
    { name: "DEMO Arjun Mehta", type: "Individual", status: "active", joined: 25, seen: 2, lat: 23.7935, lng: 86.4268, skills: [7] },
    { name: "DEMO Mohammed Iqbal", type: "NGO", status: "standby", joined: 10080, seen: 60, lat: 23.8150, lng: 86.4120, skills: [8] },
    { name: "DEMO Kavita Kumari", type: "Individual", status: "offline", joined: 8640, seen: null, lat: null, lng: null, skills: [] },
  ];

  const volunteers = [];
  for (const [i, v] of volunteerSeed.entries()) {
    const codes = v.skills.map((s) => skill(s)?.code).filter(Boolean);
    const row = must(
      await db
        .from("volunteer")
        .insert({
          name: v.name,
          mobile_no: `+9100000000${String(i + 1).padStart(2, "0")}`,
          type: v.type,
          status: v.status,
          created_at: ago(v.joined),
          last_seen: v.seen == null ? null : ago(v.seen),
          latitude: v.lat,
          longitude: v.lng,
          accuracy: v.lat ? 25 : null,
          skills: codes.join(","),
          equipment: i % 2 === 0 ? "First Aid Kit, Rope" : "Boat",
        })
        .select("id, name")
        .single(),
      `add ${v.name}`
    );
    const skillRows = v.skills.map((s) => skill(s)).filter(Boolean).map((s) => ({ volunteer_id: row.id, skill_id: s.id }));
    if (skillRows.length) must(await db.from("volunteer_skills").insert(skillRows), "add skills");
    volunteers.push(row);
  }

  const reportSeed = [
    { situation: "rescue", urgency: "critical", status: "en_route", msg: "[DEMO] Family of 5 trapped on a roof, water rising fast", lat: 23.7957, lng: 86.4304, city: "Dhanbad", mins: 40 },
    { situation: "medical", urgency: "critical", status: "arrived", msg: "[DEMO] Elderly man needs insulin, cannot walk", lat: 23.8098, lng: 86.4389, city: "Dhanbad", mins: 70 },
    { situation: "food", urgency: "urgent", status: "assigned", msg: "[DEMO] 40 people at school shelter need food", lat: 23.7821, lng: 86.4215, city: "Jharia", mins: 25 },
    { situation: "shelter", urgency: "moderate", status: "en_route", msg: "[DEMO] 3 families need tarpaulin sheets", lat: 23.8020, lng: 86.4510, city: "Dhanbad", mins: 120 },
    { situation: "water", urgency: "urgent", status: "open", msg: "[DEMO] No drinking water in ward 7 since morning", lat: 23.7875, lng: 86.4460, city: "Dhanbad", mins: 10 },
  ];
  const reports = [];
  for (const [i, r] of reportSeed.entries()) {
    reports.push(
      must(
        await db
          .from("victim_report")
          .insert({
            phone_no: `+9100000001${String(i + 1).padStart(2, "0")}`,
            latitude: r.lat,
            longitude: r.lng,
            accuracy: 30,
            city: r.city,
            district: "Dhanbad",
            situation: r.situation,
            urgency: r.urgency,
            status: r.status,
            custom_message: r.msg,
            created_at: ago(r.mins),
            updated_at: ago(Math.max(r.mins - 15, 1)),
          })
          .select("id")
          .single(),
        "add report"
      )
    );
  }

  const missionSeed = [
    { v: 0, r: 0, task: "[DEMO] Evacuate family from roof (boat needed)", urgency: "critical", status: "en_route", label: "Near Bank More, Dhanbad", updated: 6 },
    { v: 1, r: 1, task: "[DEMO] Deliver insulin and check on elderly man", urgency: "critical", status: "arrived", label: "Hirapur, Dhanbad", updated: 12 },
    { v: 2, r: 2, task: "[DEMO] Bring 40 food packets to school shelter", urgency: "urgent", status: "active", label: "Govt. School, Jharia", updated: 20 },
    { v: 3, r: 3, task: "[DEMO] Distribute tarpaulin to 3 families", urgency: "moderate", status: "en_route", label: "Saraidhela, Dhanbad", updated: 45 },
  ];
  for (const m of missionSeed) {
    const report = reportSeed[m.r];
    const mission = must(
      await db
        .from("assignment")
        .insert({
          task: m.task,
          location_label: m.label,
          latitude: report.lat,
          longitude: report.lng,
          urgency: m.urgency,
          status: m.status,
          assigned_to_volunteer: volunteers[m.v].id,
          victim_report_id: reports[m.r].id,
          created_at: ago(m.updated + 20),
          updated_at: ago(m.updated),
        })
        .select("id")
        .single(),
      "add mission"
    );
    const note =
      m.status === "arrived" ? "📍 Arrived on site · patient stable, giving insulin now"
        : m.status === "en_route" ? "🚗 On the way · road flooded near the bridge, taking detour"
          : null;
    if (note) {
      must(
        await db.from("message").insert({
          content: note,
          sender_type: "volunteer",
          sender_id: volunteers[m.v].id,
          assignment_id: mission.id,
          created_at: ago(m.updated),
        }),
        "add mission update"
      );
    }
  }

  console.log(`✓ Added demo data: ${volunteers.length} volunteers, ${reports.length} reports, ${missionSeed.length} missions`);
  console.log('  Remove it any time with:  bun run db:demo -- remove');
}

if (mode === "add") await add();
else if (mode === "remove") await remove();
else {
  console.error("Usage: bun run db:demo -- add | remove");
  process.exit(1);
}
