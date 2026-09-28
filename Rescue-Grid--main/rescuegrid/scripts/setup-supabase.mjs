// Creates (or upgrades) the RescueGrid database in your Supabase project.
//
//   bun run db:setup                          tables, security rules, functions
//   bun run db:setup -- --seed                …plus demo data
//   bun run db:setup -- --operator you@org.in …plus a DMA operator login
//
// Needs SUPABASE_DB_URL in .env.local (Supabase dashboard → Connect →
// "Session pooler"). --operator also needs NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Safe to run more than once.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = (file) => readFileSync(path.join(root, "supabase", file), "utf8");

const args = process.argv.slice(2);
const withSeed = args.includes("--seed");
const operatorIndex = args.indexOf("--operator");
const operatorEmail = operatorIndex >= 0 ? args[operatorIndex + 1] : null;

const UPGRADE_MIGRATIONS = [
  "migrations/015_security_and_integrity.sql",
  "migrations/016_per_user_rls.sql",
  "migrations/017_volunteer_intake_and_mission_updates.sql",
  "migrations/018_rate_limits.sql",
  "migrations/019_operator_role.sql",
];
const SEED_FILES = ["seed.sql", "migrations/050_volunteer_seed_data.sql"];
const APP_TABLES = [
  "victim_report", "volunteer", "task_force", "task_force_member", "assignment", "message",
  "resource", "resource_allocation", "skill_categories", "skill_definitions", "volunteer_skills",
  "chat_sessions", "chat_messages", "rate_limit",
];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// Either a full SUPABASE_DB_URL, or just SUPABASE_DB_PASSWORD (the host is
// derived from the project URL, and the password needs no URL-encoding).
const dbUrl = process.env.SUPABASE_DB_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const urlUsable = dbUrl && !/your-db-password|\[YOUR-PASSWORD\]/i.test(dbUrl);
let projectRef = process.env.SUPABASE_PROJECT_REF;
try {
  projectRef ||= new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0];
} catch {
  // no project URL
}

if (!urlUsable && !(dbPassword && projectRef)) {
  fail(
    "No database password in .env.local.\n" +
      "  Add SUPABASE_DB_PASSWORD=<your database password>\n" +
      "  (forgotten it? Supabase dashboard → Project Settings → Database → Reset database password)."
  );
}

// Supabase requires TLS; its certificate isn't in Node's default CA bundle.
const ssl = { rejectUnauthorized: false };
const client = new pg.Client(
  urlUsable
    ? { connectionString: dbUrl, ssl }
    : { host: `db.${projectRef}.supabase.co`, port: 5432, user: "postgres", database: "postgres", password: dbPassword, ssl }
);

async function run(label, text) {
  process.stdout.write(`  ${label} … `);
  try {
    await client.query(text);
    console.log("ok");
  } catch (error) {
    console.log("failed");
    fail(`${label}: ${error.message}`);
  }
}

async function createOperator(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("--operator needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const password = randomBytes(12).toString("base64url");
  // supabase-js sends both legacy (JWT) and new (sb_secret_…) keys correctly.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "dma_operator" } });
  if (error) {
    console.log(`  ! Could not create ${email}: ${error.message}`);
    return;
  }
  console.log(`  ✓ Operator created: ${email}`);
  console.log(`    Temporary password: ${password}`);
  console.log("    Sign in at /dma/login and change it (Supabase dashboard → Authentication → Users).");
  console.log(`    Add ${email} to DMA_ALLOWED_EMAILS in .env.local.`);
}

try {
  await client.connect();
} catch (error) {
  fail(`Could not connect to the database: ${error.message}\n  Check SUPABASE_DB_URL (host, password) in .env.local.`);
}

console.log("\nRescueGrid → Supabase setup\n");

const { rows } = await client.query("SELECT to_regclass('public.victim_report') IS NOT NULL AS exists");
if (rows[0].exists) {
  console.log("Existing database found — applying upgrades:");
  for (const file of UPGRADE_MIGRATIONS) await run(file, sql(file));
} else {
  console.log("Empty database — creating everything:");
  await run("schema.sql", sql("schema.sql"));
}

if (withSeed) {
  console.log("\nDemo data:");
  for (const file of SEED_FILES) await run(file, sql(file));
}

console.log("\nVerifying:");
const { rows: tables } = await client.query(
  `SELECT c.relname AS name, c.relrowsecurity AS rls
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
  [APP_TABLES]
);
const found = new Map(tables.map((t) => [t.name, t.rls]));
let ok = true;
for (const table of APP_TABLES) {
  const state = !found.has(table) ? "MISSING" : found.get(table) ? "row-level security on" : "RLS OFF";
  if (state !== "row-level security on") ok = false;
  console.log(`  ${state === "row-level security on" ? "✓" : "✗"} ${table.padEnd(20)} ${state}`);
}

await client.end();

if (operatorEmail) {
  console.log("\nOperator account:");
  await createOperator(operatorEmail);
}

if (!ok) fail("Some tables are missing or unprotected — see above.");
console.log("\n✓ Database ready. Next: `bun run db:check`, then `bun dev`.\n");
