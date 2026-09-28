// Checks that the app can store and read data in your Supabase project, and
// that the public key can't read private data.
//
//   bun run db:check
//
// Uses NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from .env.local. The test report it writes is
// deleted again at the end.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
const check = (ok, label, detail = "") => {
  results.push(ok);
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

if (!url || !anonKey || !serviceKey || url.includes("your-project-ref")) {
  console.error(
    "\n✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local\n" +
      "  (Supabase dashboard → Project Settings → API).\n"
  );
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(url, serviceKey, options);
const publicClient = createClient(url, anonKey, options);

console.log(`\nRescueGrid ↔ ${new URL(url).host}\n`);

console.log("Server (what the API routes use):");
for (const table of ["victim_report", "volunteer", "assignment", "message", "resource", "skill_definitions"]) {
  const { count, error } = await server.from(table).select("*", { count: "exact", head: true });
  check(!error, `read ${table}`, error ? error.message : `${count ?? 0} rows`);
}

const { data: created, error: insertError } = await server
  .from("victim_report")
  .insert({ phone_no: "+910000000000", latitude: 23.79, longitude: 86.43, situation: "food", urgency: "urgent", custom_message: "db:check test — safe to delete" })
  .select("id")
  .single();
check(!insertError, "store a report", insertError ? insertError.message : `id ${created.id}`);
if (created) {
  const { error: deleteError } = await server.from("victim_report").delete().eq("id", created.id);
  check(!deleteError, "delete the test report", deleteError?.message);
}

const { data: allowed, error: rateError } = await server.rpc("hit_rate_limit", {
  p_key: "db-check",
  p_limit: 1000,
  p_window_seconds: 60,
});
check(!rateError && allowed === true, "rate limiter (migration 018)", rateError?.message);

const { error: timelineError } = await server.from("message").select("assignment_id").limit(1);
check(!timelineError, "mission timeline column (migration 017)", timelineError?.message);

console.log("\nPublic key (what a stranger's browser can do):");
const { data: leaked } = await publicClient.from("victim_report").select("id").limit(1);
check(!leaked || leaked.length === 0, "cannot read victim reports");
const { data: leakedVols } = await publicClient.from("volunteer").select("id").limit(1);
check(!leakedVols || leakedVols.length === 0, "cannot read volunteers");
const { error: writeError } = await publicClient
  .from("victim_report")
  .insert({ phone_no: "+910000000000", latitude: 0, longitude: 0, situation: "food" });
check(!!writeError, "cannot write directly to the database");
const { error: skillsError } = await publicClient.from("skill_categories").select("id").limit(1);
check(!skillsError, "can read the public skills list", skillsError?.message);

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} check(s) failed.\n` : "\n✓ Supabase is connected and locked down.\n");
process.exit(failed ? 1 : 0);
