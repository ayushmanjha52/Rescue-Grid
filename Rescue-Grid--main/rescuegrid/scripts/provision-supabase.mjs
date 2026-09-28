// Connects RescueGrid to Supabase using only a personal access token:
// finds or creates the project, writes its keys into .env.local, creates the
// database, and optionally loads demo data and creates a DMA operator login.
//
//   bun run db:provision                                   list your organizations and projects
//   bun run db:provision -- --project <ref> [--seed] [--operator you@org.in]
//   bun run db:provision -- --create [--org <id>] [--region ap-south-1] [--seed] [--operator …]
//
// Needs SUPABASE_ACCESS_TOKEN in .env.local
// (Supabase dashboard → Account → Access Tokens → Generate new token).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.supabase.com/v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const sqlFile = (file) => readFileSync(path.join(root, "supabase", file), "utf8");

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

// ---- arguments -------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token || !token.startsWith("sbp_") || token.includes("your-personal-access-token")) {
  fail(
    "SUPABASE_ACCESS_TOKEN is not set in .env.local.\n" +
      "  Supabase dashboard → click your avatar → Account preferences → Access Tokens →\n" +
      "  Generate new token, then paste it into .env.local as SUPABASE_ACCESS_TOKEN=sbp_…"
  );
}

// ---- Supabase Management API -------------------------------------------------

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === "object" && data ? data.message || data.error || JSON.stringify(data) : data;
    throw new Error(`${method} ${route} → ${res.status}: ${detail}`);
  }
  return data;
}

const runSql = (ref, query) => api("POST", `/projects/${ref}/database/query`, { query });

async function waitUntilHealthy(ref) {
  process.stdout.write("  waiting for the project to start");
  for (let i = 0; i < 90; i++) {
    const project = await api("GET", `/projects/${ref}`);
    if (project.status === "ACTIVE_HEALTHY") {
      console.log(" ready");
      return;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  fail("The project did not become ready within 15 minutes. Check the Supabase dashboard, then run again with --project.");
}

// ---- .env.local ----------------------------------------------------------------

function updateEnv(values) {
  const template = existsSync(envPath) ? readFileSync(envPath, "utf8") : readFileSync(path.join(root, ".env.example"), "utf8");
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(envPath, text);
}

// ---- main ----------------------------------------------------------------------

console.log("\nRescueGrid → Supabase\n");

const [organizations, projects] = await Promise.all([api("GET", "/organizations"), api("GET", "/projects")]);

let ref = option("--project");

if (!ref && !flag("--create")) {
  console.log("Organizations:");
  for (const org of organizations) console.log(`  ${org.id}  ${org.name}`);
  console.log("\nProjects:");
  if (projects.length === 0) console.log("  (none)");
  for (const p of projects) console.log(`  ${p.id}  ${p.name.padEnd(28)} ${p.region.padEnd(16)} ${p.status}`);
  console.log(
    "\nRun again with --project <ref> to use one of these, or --create to make a new project" +
      "\n(add --seed for demo data and --operator you@org.in for a DMA login).\n"
  );
  process.exit(0);
}

let dbPassword;
if (!ref) {
  const orgId = option("--org") || organizations[0]?.id;
  if (!orgId) fail("No Supabase organization found on this account.");
  if (!option("--org") && organizations.length > 1) {
    fail(`You belong to ${organizations.length} organizations. Pick one with --org <id> (run without flags to list them).`);
  }
  const region = option("--region") || "ap-south-1"; // Mumbai
  const name = option("--name") || "RescueGrid";
  dbPassword = randomBytes(18).toString("base64url");

  console.log(`Creating project "${name}" in ${region}…`);
  const project = await api("POST", "/projects", { name, organization_id: orgId, region, db_pass: dbPassword });
  ref = project.id;
  console.log(`  project ref: ${ref}`);
  await waitUntilHealthy(ref);
} else if (!projects.some((p) => p.id === ref)) {
  fail(`Project ${ref} was not found on this account.`);
}

// Keys
const keys = await api("GET", `/projects/${ref}/api-keys?reveal=true`);
const findKey = (...names) => keys.find((k) => names.includes(k.name) || names.includes(k.type))?.api_key;
const anonKey = findKey("anon", "publishable");
const serviceKey = findKey("service_role", "secret");
if (!anonKey || !serviceKey) fail("Could not read the project's API keys.");

const url = `https://${ref}.supabase.co`;
updateEnv({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  SUPABASE_PROJECT_REF: ref,
  ...(dbPassword ? { SUPABASE_DB_PASSWORD: dbPassword } : {}),
});
console.log("✓ Keys written to .env.local");

// Database
const [{ exists }] = await runSql(ref, "SELECT to_regclass('public.victim_report') IS NOT NULL AS exists");
const files = exists ? UPGRADE_MIGRATIONS : ["schema.sql"];
console.log(exists ? "\nExisting database — applying upgrades:" : "\nCreating the database:");
for (const file of files) {
  process.stdout.write(`  ${file} … `);
  await runSql(ref, sqlFile(file));
  console.log("ok");
}

if (flag("--seed")) {
  console.log("\nDemo data:");
  for (const file of SEED_FILES) {
    process.stdout.write(`  ${file} … `);
    await runSql(ref, sqlFile(file));
    console.log("ok");
  }
}

// Verify every table exists with row-level security on.
const tables = await runSql(
  ref,
  `SELECT c.relname AS name, c.relrowsecurity AS rls
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN (${APP_TABLES.map((t) => `'${t}'`).join(",")})`
);
const found = new Map(tables.map((t) => [t.name, t.rls]));
const problems = APP_TABLES.filter((t) => found.get(t) !== true);
console.log(problems.length ? `\n✗ Missing or unprotected: ${problems.join(", ")}` : `\n✓ ${APP_TABLES.length} tables, all with row-level security`);

// Operator login
const operatorEmail = option("--operator");
if (operatorEmail) {
  const password = randomBytes(12).toString("base64url");
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: operatorEmail, password, email_confirm: true, app_metadata: { role: "dma_operator" } }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    updateEnv({ DMA_ALLOWED_EMAILS: operatorEmail });
    console.log(`\n✓ DMA login created: ${operatorEmail}`);
    console.log(`  Temporary password: ${password}`);
    console.log("  Sign in at /dma/login, then change it (Supabase dashboard → Authentication → Users).");
  } else {
    console.log(`\n! Could not create ${operatorEmail}: ${data.msg || data.message || res.status}`);
  }
}

if (dbPassword) console.log("\nThe database password was saved in .env.local as SUPABASE_DB_PASSWORD. Keep it safe.");
if (problems.length) process.exit(1);
console.log("\nNext: bun run db:check, then bun dev\n");
