# RescueGrid — app

Next.js 16 + Supabase app with three front ends that share one database:

| App | Path | Who | Auth |
| --- | --- | --- | --- |
| Victim PWA | `/`, `/report/*` | Anyone in distress | None (report id acts as a private link) |
| Volunteer PWA | `/volunteer/*` | Registered responders | Supabase Auth, phone number + PIN (no SMS, free) |
| DMA dashboard | `/dma/*` | Disaster-management operators | Supabase Auth, email/password (optionally allow-listed) |

## Getting started

Requirements: [Bun](https://bun.sh) (or Node 20+ with npm), a Supabase project, and a Mapbox token.

```bash
bun install
cp .env.example .env.local     # fill in the values — see comments in the file
bun dev                        # http://localhost:3000
```

### Database

All data (reports, volunteers, missions, messages, resources) is stored in your Supabase project. To set it up:

1. Fill in the Supabase values in `.env.local`: the URL, anon key and service-role key (Project Settings → API), and `SUPABASE_DB_URL` (Connect → Session pooler, with your database password).
2. Create the database:
   - `bun run db:setup` creates everything in a new project, or upgrades an existing one.
   - Add `-- --seed` to also load demo data.
   - Add `-- --operator you@org.in` to also create a DMA login.
3. Run `bun run db:check`. It writes and deletes a test report, and confirms the public key can't read private data.

To do it by hand instead, run `supabase/schema.sql` in the SQL editor for a new project. For an existing one, run migrations `015` → `016` → `017` → `018` → `019` in order; all are safe to re-run.

- 016 replaces every Row Level Security policy with the per-user set.
- 017 records when volunteers joined, and links messages to missions (the mission timeline).
- 018 adds rate limiting for public endpoints.
- 019 requires the server-granted operator role for DMA access (run `bun run db:operator` first).

> `001_initial_schema.sql` is a reference dump of an earlier schema and is not meant to be executed.

Then in Supabase:

- Volunteer sign-in needs **no SMS provider**. Volunteers use their phone number and a PIN, and the server creates their login, so the Phone provider can stay off.
- **Authentication → Sign ups:** disable public email sign-ups, then create DMA operator users by hand. Also set `DMA_ALLOWED_EMAILS`.

### SMS gateway (optional, paid)

```bash
supabase functions deploy twilio-sms-webhook --no-verify-jwt
supabase secrets set TWILIO_AUTH_TOKEN=... MAPBOX_TOKEN=... PUBLIC_APP_URL=https://your-app.example
```

Point your Twilio number's **Messaging webhook (HTTP POST)** at
`https://<project-ref>.supabase.co/functions/v1/twilio-sms-webhook`. Requests without a valid Twilio signature are rejected.

### Push notifications (optional)

`npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_KEY` / `VAPID_PRIVATE_KEY`. Volunteers enable alerts from their Profile page (the service worker is `public/sw.js`).

## Scripts

| Command | What it does |
| --- | --- |
| `bun dev` | Dev server |
| `bun run build` / `bun start` | Production build / serve |
| `bun run lint` | ESLint (Next + React Compiler rules) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit tests in `tests/` |
| `bun run check` | All three of the above |

## Project layout

```
app/
  (victim)/            victim PWA pages
  (volunteer)/         volunteer PWA (layout provides session, GPS tracking, nav)
  (dma)/               DMA dashboard (layout provides top bar, counters, AI assistant)
  api/dma/*            operator APIs  — require a DMA session (proxy.ts + requireDma)
  api/volunteer/*      volunteer APIs — require a volunteer Supabase session (requireVolunteer)
                       (list/locations/map/search/skill-gaps are operator-only)
  api/victim/*         public victim APIs (validated and de-duplicated)
components/            UI by audience (dma/, volunteer/, victim/, ui/)
hooks/                 realtime data hooks + small utilities
lib/
  auth/                volunteer / DMA session checks
  status.ts            one vocabulary for report / assignment / allocation statuses
  assignments.ts       mission lifecycle (keeps reports + responder status in sync) and mission updates
  volunteers.ts        volunteer intake helpers (new-volunteer window, names, skills)
  resources.ts         stock reservation and settlement
  supabase/            browser, server (cookie) and service-role clients
proxy.ts               route protection (Next 16's replacement for middleware)
supabase/              schema, migrations, seed data, SMS edge function
```

## How it fits together

- **Writes** always go through the API routes, which use the service-role key and enforce authorization in code.
- **Realtime:** operators and volunteers subscribe to Postgres changes with their own Supabase session, so Row Level Security decides what each of them receives. Victims have no account. The server pings a broadcast topic named after the report's private UUID, and the status page refetches through the API.
- **Mission lifecycle:** `active` (assigned) → `en_route` → `arrived` → `completed` / `failed`. The linked victim report mirrors each step. Volunteers are marked `on-mission` while working. A failed mission puts the report back in the queue.
- **Stock:** allocations *reserve* quantity while `allocated`/`in_use`. When one is consumed or lost, the unreturned amount is deducted from the resource. Returned stock simply becomes available again.
- **Triage:** new reports get an urgency from their type (rescue and medical → critical). Operators can re-triage from the dashboard.

## Emergency volunteers: join → task → track

1. **Join.** Anyone can become a volunteer during an emergency:
   - They tap *Join as a volunteer* on the public home page, or open the join link that Command copies from **Volunteers** and shares by SMS, WhatsApp or posters.
   - They choose a PIN and sign in with their phone number and that PIN. No SMS is sent, so it costs nothing. A number can only be registered once.
   - Forgotten PIN: DMA clicks **Reset PIN** on the Volunteers page and reads the new temporary PIN to them. Volunteers can change their PIN in their Profile.
   - A welcome checklist then walks them through name and skills, mission alerts, location sharing and availability.
   - People without a smartphone are added by an operator with **Volunteers → Register walk-in**. They get a temporary PIN shown once on screen, so they can sign in to the volunteer app later with their number and that PIN.
2. **Task.** In **Volunteers**, operators can see everyone at a glance:
   - New sign-ups are marked **NEW** and sorted to the top, and each one raises a live alert.
   - Each card shows availability, skills, last location ping, current mission and the last thing the volunteer said.
   - **Assign task** opens the mission form with that volunteer already chosen. Missions can also go to a task force, or be created from a victim report as before.
   - App users get a push notification. Volunteers who haven't used the app yet are marked *Not on app — call*.
3. **Track.** Every step builds a timeline on the mission, shown in **Missions**, in Messages and as live alerts:
   - When a volunteer taps *Accept & start*, *Arrived*, *Complete* or *Failed*, an update is posted with their optional note. A failure needs a reason and is flagged urgent.
   - *Send update* posts a field report at any time, with quick phrases and an "urgent" flag.
   - Operators reply from the timeline. For walk-ins who call in, operators log *En route* or *On site* themselves.
   - Missions show when they were last updated and are highlighted after 30 minutes of silence.

## Security notes

- Both kinds of user have real Supabase Auth sessions (cookie-based, refreshed automatically, revoked on logout). An account is an **operator** only if it has the server-granted role `app_metadata.role = "dma_operator"`, given with `bun run db:operator -- someone@org.in`. Only the secret key can set this, so an email sign-up alone isn't enough. That matters because sign-ups stay open for volunteers' phone logins. An account is a **volunteer** if it's a phone account linked through `volunteer.auth_id`. The app (`lib/auth/*`) and the database (`is_dma_operator()`, migration 019, and `current_volunteer_id()`) apply the same rules.
- Row Level Security (migration 016):
  - Operators read all operational data.
  - Volunteers read only their own missions, task forces, team chat, direct messages and supplies.
  - The public anon key reads nothing except the skill taxonomy.
- Keep public email sign-ups **disabled** in Supabase, so the only email accounts are operators you create. `DMA_ALLOWED_EMAILS` adds an app-level allow-list on top.
- Victims have no account. "My Reports" lists the report IDs remembered on their own phone, and there is no lookup by phone number. A report link shows progress, but never the reporter's phone number or exact coordinates.
- Public endpoints are rate-limited (migration 018), by connection and by phone number:
  - victim reports and messages;
  - "My Reports" lookups;
  - volunteer sign-up, sign-in and PIN changes (to stop PIN guessing).
  Limits on reports are generous, because mobile networks put many phones behind one IP. Blocked users are pointed to SMS and the helpline.
- Volunteers can delete their account from their Profile page.
  - This removes their profile, skills, location, direct messages and phone login.
  - Team-chat posts stay, without their name.
  - It's refused while they're on a mission or holding supplies.
- Optional Cloudflare Turnstile protects volunteer sign-up (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`).
- Headers: Content-Security-Policy (only Supabase, Mapbox and Turnstile are allowed), HSTS, frame blocking, nosniff.
- The helpline defaults to **112** (India's emergency number) until `NEXT_PUBLIC_HELPLINE_NUMBER` is set. SOS texts go to the Twilio number, or to 112 if none is configured.
- After upgrading, volunteers sign in once more, because the old session cookie is retired.
