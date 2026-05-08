# RescueGrid — Agent Build Plan
**Version:** 1.0  
**Synced with:** PRD v1.2 · UI PRD v1.2 · ERD v3  
**Stack:** Next.js (App Router) · Supabase · Mapbox GL JS · PWA · Vercel  
**Package Manager:** Bun — use `bun` for all installs and scripts. Never use npm, npx, or yarn.  
**Rule:** Complete each phase fully before starting the next. Never scaffold ahead.

---

## How to Use This Plan

This document is your single source of truth for building RescueGrid. Read it alongside the three reference documents passed to you:

- **`RescueGrid_PRD_v1_2.md`** — What to build, module by module, and all resolved decisions
- **`RescueGrid_UI_PRD_v1_2.md`** — Exact visual spec: colors, fonts, components, layout, every screen
- **`rescuegrid_erd_final_v3.html`** — The complete database schema (7 tables, all FK relationships)

Each phase is self-contained and testable. Complete every checklist item before moving to the next phase.

---

## Environment & Secrets

Before writing a single line of code, confirm these exist in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

Generate VAPID keys with:
```bash
bunx web-push generate-vapid-keys
```

---

## Phase 0 — Project Foundation
**Goal:** A running Next.js app with design tokens, fonts, and empty route shells. No data, no logic.

### 0.1 Next.js App Setup

```bash
bunx create-next-app@latest rescuegrid --app --typescript --tailwind
cd rescuegrid
```

Install all dependencies:
```bash
bun add @supabase/supabase-js @supabase/ssr mapbox-gl @mapbox/mapbox-gl-geocoder @mapbox/search-js-react web-push
bun add -d @types/mapbox-gl @types/web-push
```

- [ ] Configure `tailwind.config.ts` with the full token set from UI PRD §13:
  - Colors: `void`, `surface.1–4`, `orange`, `alert`, `ops`, `intel`, `caution`, `ink`, `muted`, `dim`
  - Font families: `display` (Barlow Condensed), `body` (Barlow), `mono` (JetBrains Mono)
  - Clip path utilities: `tactical`, `tactical-sm`
- [ ] Load fonts in `app/layout.tsx` via Google Fonts: `Barlow`, `Barlow+Condensed`, `JetBrains+Mono`
- [ ] Set global CSS variables in `globals.css` — all 17 dark theme tokens from UI PRD §3, plus light theme fallbacks
- [ ] Set `<body>` background to `--bg0` (`#07080A`)

### 0.2 Supabase Client Setup
- [ ] `lib/supabase/client.ts` — browser client using `createBrowserClient`
- [ ] `lib/supabase/server.ts` — server client using `createServerClient` with cookies
- [ ] `middleware.ts` at project root — refreshes session on every request using Supabase SSR helper

### 0.3 Route Shells
Create these files with a single `<div>PLACEHOLDER</div>`. No logic. Just confirms routing works.

**Victim PWA:**
- [ ] `app/(victim)/page.tsx` → `/`
- [ ] `app/(victim)/report/[type]/page.tsx` → `/report/[type]`
- [ ] `app/(victim)/report/status/[id]/page.tsx` → `/report/status/[id]`

**Volunteer PWA:**
- [ ] `app/(volunteer)/volunteer/login/page.tsx`
- [ ] `app/(volunteer)/volunteer/missions/page.tsx`
- [ ] `app/(volunteer)/volunteer/active/page.tsx`
- [ ] `app/(volunteer)/volunteer/map/page.tsx`
- [ ] `app/(volunteer)/volunteer/chat/[taskforce_id]/page.tsx`
- [ ] `app/(volunteer)/volunteer/profile/page.tsx`

**DMA Dashboard:**
- [ ] `app/(dma)/dma/login/page.tsx`
- [ ] `app/(dma)/dma/dashboard/page.tsx`
- [ ] `app/(dma)/dma/deployments/page.tsx`
- [ ] `app/(dma)/dma/assignments/page.tsx`
- [ ] `app/(dma)/dma/resources/page.tsx`
- [ ] `app/(dma)/dma/messages/page.tsx`
- [ ] `app/(dma)/dma/broadcast/page.tsx`

### 0.4 Shared UI Primitives
Build in `components/ui/`. These are reused across all three surfaces. Build once here, import everywhere.

- [ ] **`Button.tsx`** — Props: `variant` (`primary` | `secondary` | `ghost` | `danger`), `size` (`default` | `small`). All variants use `clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))`. Font: Barlow Condensed 600 13px UPPERCASE `letter-spacing: 0.15em`. Padding: `10px 24px` default, `7px 16px` small. Full color specs in UI PRD §5.1.
- [ ] **`StatusBadge.tsx`** — Props: `status` (`critical` | `on-mission` | `ready` | `standby` | `completed`). JetBrains Mono 10px, 5px dot prefix. `critical` dot pulses at 1.2s. Full spec in UI PRD §5.2.
- [ ] **`InputField.tsx`** — Props: `label`, `type`, standard HTML input props. Left 3px orange border, `--bg3` bg, no border on other sides. Label: JetBrains Mono 10px orange UPPERCASE `letter-spacing: 0.2em`, above field. Focus: full orange border, `--bg4` bg. Spec in UI PRD §5.3.

**Phase 0 is done when:** `bun dev` starts clean, all routes resolve to their placeholder, and a test Button renders with the angular clip-path visually confirmed.

---

## Phase 1 — Database Schema
**Goal:** All 7 tables exist in Supabase with correct types, FK constraints, RLS, and seed data.

### 1.1 Run Migrations
Execute the migration file in Supabase SQL editor. Run in this exact order — it respects FK dependencies.

`supabase/migrations/001_initial_schema.sql`:
-- 1. VICTIM_REPORT (no dependencies)
CREATE TABLE victim_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_no text NOT NULL,
  latitude float,
  longitude float,
  city text,
  district text,
  situation text NOT NULL,
  custom_message text,
  urgency text DEFAULT 'moderate',
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

-- 2. VOLUNTEER (no dependencies)
CREATE TABLE volunteer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile_no text UNIQUE NOT NULL,
  type text,
  latitude float,
  longitude float,
  skills text,
  equipment text,
  status text DEFAULT 'active',
  push_token text,
  last_seen timestamptz
);

-- 3. TASK_FORCE (assignment FK added after assignment table exists)
CREATE TABLE task_force (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dma_id text,
  status text DEFAULT 'active',
  assignment_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 4. ASSIGNMENT (depends on volunteer, task_force, victim_report)
CREATE TABLE assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  location_label text,
  latitude float,
  longitude float,
  urgency text DEFAULT 'moderate',
  status text DEFAULT 'open',
  assigned_to_volunteer uuid REFERENCES volunteer(id),
  assigned_to_taskforce uuid REFERENCES task_force(id),
  victim_report_id uuid REFERENCES victim_report(id),
  timer timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Close the circular FK: task_force → assignment
ALTER TABLE task_force
  ADD CONSTRAINT fk_tf_assignment FOREIGN KEY (assignment_id) REFERENCES assignment(id);

-- 6. TASK_FORCE_MEMBER (depends on task_force + volunteer)
CREATE TABLE task_force_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_force_id uuid NOT NULL REFERENCES task_force(id),
  volunteer_id uuid NOT NULL REFERENCES volunteer(id),
  member_type text,
  role text
);

-- 7. MESSAGE (depends on task_force, victim_report)
CREATE TABLE message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sender_type text NOT NULL,
  sender_id uuid,
  task_force_id uuid REFERENCES task_force(id),
  victim_report_id uuid REFERENCES victim_report(id),
  receiver_id uuid,
  is_flagged_for_dma boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- 8. RESOURCE (no dependencies)
CREATE TABLE resource (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  quantity float DEFAULT 0,
  low_stock_threshold float DEFAULT 0,
  unit text,
  owner_info text,
  location text,
  updated_at timestamptz DEFAULT now()
);

### 1.2 Enable Supabase Realtime
In Supabase dashboard → Table Editor → Replication, enable for:
- [ ] `victim_report`
- [ ] `assignment`
- [ ] `message`
- [ ] `volunteer`
- [ ] `resource`

### 1.3 Row Level Security (RLS)
Enable RLS on all 7 tables. Policies:

- [ ] `victim_report` — anon INSERT allowed. anon SELECT by `id` only. Service role: full access.
- [ ] `volunteer` — authenticated user SELECT/UPDATE own row (`id = auth.uid()`). Service role: full access.
- [ ] `assignment` — volunteer SELECT where `assigned_to_volunteer = auth.uid()` OR `assigned_to_taskforce` in their memberships. Service role: full access.
- [ ] `task_force` — volunteer SELECT where their `volunteer_id` is in `task_force_member` for that TF. Service role: full access.
- [ ] `task_force_member` — same scope as task_force. Service role: full access.
- [ ] `message` — volunteer SELECT/INSERT where `task_force_id` is their TF, or `sender_id / receiver_id` is their ID. Service role: full access.
- [ ] `resource` — service role only. No volunteer or anon access.

### 1.4 Seed Data
Create `supabase/seed.sql`:
- [ ] 4 volunteers — 1 individual, 1 Police, 1 NGO, 1 NDRF — varied statuses
- [ ] 5 victim_reports — Rescue/Critical, Food/Urgent, Medical/Moderate, Shelter/Open, Water/Open
- [ ] 2 task forces with 2 members each
- [ ] 3 assignments — 1 to volunteer, 1 to TF, 1 unassigned open
- [ ] 6 messages — spanning victim thread, TF room, and direct channel types
- [ ] 5 resources — Food Packets, Water Cans, Boats, Medical Kits, Blankets — one below `low_stock_threshold`

**Phase 1 is done when:** All 7 tables exist, Realtime is on, RLS active, `SELECT * FROM victim_report` in SQL editor returns seed rows.

---

## Phase 2 — Authentication
**Goal:** DMA logs in with email/password. Volunteers log in with mocked phone OTP. Sessions persist across page refreshes.

### 2.1 DMA Login (`/dma/login`)
- [ ] Page: `RESCUEGRID` logo, email `InputField`, password `InputField`, `LOGIN →` primary Button
- [ ] Call `supabase.auth.signInWithPassword({ email, password })` on submit
- [ ] On success → redirect to `/dma/dashboard`
- [ ] On error → inline error below form in `--red-alert`, JetBrains Mono 11px
- [ ] Middleware: all `/dma/*` routes check for valid session → redirect to `/dma/login` if missing
- [ ] Create one DMA user in Supabase Auth dashboard for testing

### 2.2 Volunteer Login (`/volunteer/login`)
- [ ] Two-step UI: Step 1 = phone input, Step 2 = OTP input (visible after Step 1 submits)
- [ ] Step 1: `supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })` — demo mode, no real SMS
- [ ] Step 2: `supabase.auth.verifyOtp({ phone, token: '123456', type: 'sms' })` — OTP always `123456`
- [ ] Show hint below OTP field: `DEMO MODE — USE CODE 123456` in dim mono
- [ ] On success → redirect to `/volunteer/missions`
- [ ] Middleware: all `/volunteer/*` routes (except `/volunteer/login`) require session

### 2.3 Auth Helpers
- [ ] `lib/auth/getSession.ts` — server-side, returns session or null
- [ ] `lib/auth/getVolunteer.ts` — fetches `volunteer` row matched by authenticated user's phone number

**Phase 2 is done when:** DMA login → dashboard works; session clear → redirected back to login. Volunteer login with `123456` → missions page works.

---

## Phase 3 — Victim Report Flow
**Goal:** Civilian opens PWA, submits a report with GPS, and tracks live status with DMA replies.

### 3.1 Victim Home Screen (`/`)
Refer to: UI PRD §9.1

- [ ] Dark screen, `RESCUEGRID` logo centered top — RESCUE white / GRID orange, Barlow Condensed 700
- [ ] Bilingual subtitle: "Report Emergency / आपातकाल रिपोर्ट करें" in muted Barlow
- [ ] 2×3 grid of situation cards: Food · Water · Medical · Rescue · Shelter · Missing
- [ ] Each card: angular clip-path on `--bg2`, colored left border by situation type, icon, English label Barlow Condensed 18px 700 UPPERCASE, Hindi label Barlow 13px muted
- [ ] Card tap → navigate to `/report/[type]`
- [ ] Sticky bottom: `📞 HELPLINE: 1070` full-width primary Button (`href="tel:1070"`)

### 3.2 Report Form (`/report/[type]`)
Refer to: UI PRD §9.2

- [ ] Back arrow top-left → `/`
- [ ] Mapbox GL JS map, 160px tall, dark style, draggable pin initialized at browser GPS
- [ ] `↻ USE CURRENT LOCATION` ghost Button → calls `geolocation.getCurrentPosition()`
- [ ] Detected place name below map in JetBrains Mono 11px dim
- [ ] Phone `InputField` — `inputmode="tel"`, required
- [ ] Optional message textarea (same InputField style) — max 280 chars, character counter in Mono dim bottom-right
- [ ] `SEND REPORT →` primary Button, full width — disabled while phone empty, spinner on submit
- [ ] On submit: POST to `/api/victim/report` → on success navigate to `/report/status/[new_id]`

### 3.3 API Route — Create Report
`app/api/victim/report/route.ts` (POST)

- [ ] Validate: `phone_no`, `latitude`, `longitude`, `situation` required — 400 if missing
- [ ] Call Mapbox Reverse Geocoding: `GET https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=TOKEN` — extract `city` and `district` from feature context
- [ ] Insert into `victim_report` with service role client
- [ ] Return `{ id }` with status 201

### 3.4 Report Status Screen (`/report/status/[id]`)
Refer to: UI PRD §9.3

- [ ] Fetch report on load by `id`
- [ ] Display: `REPORT #KL-{YEAR}-{XXXX}`, situation badge, urgency badge
- [ ] Live status badge — updates via Supabase Realtime on `victim_report WHERE id = [id]`
- [ ] **Message thread:**
  - DMA messages: right-aligned, `--orange-dim` bg
  - Victim messages: left-aligned, `--bg3` bg
  - Sender label + timestamp in JetBrains Mono 10px dim
- [ ] Message input + `SEND →` Button — POST `/api/victim/message` → inserts `message` with `victim_report_id`, `sender_type = 'victim'`
- [ ] New DMA messages appear live via Realtime on `message WHERE victim_report_id = [id]`
- [ ] Sticky bottom: `📞 CALL HELPLINE: 1070` primary Button

**Phase 3 is done when:** Full victim flow works end-to-end — home → form → submit → status screen shows live-updating status and DMA replies appear in real-time.

---

## Phase 4 — DMA Dashboard Core
**Goal:** DMA sees victim reports and volunteers on a live Mapbox map with filters and the responders panel.

### 4.1 Dashboard Layout (`/dma/dashboard`)
Refer to: UI PRD §6.1

- [ ] Three-column fixed layout, no full-page scroll:
  - Left sidebar: 260px fixed, `--bg1`, independent scroll
  - Center: Mapbox map fills remaining width, full height minus topbar
  - Right sidebar: 320px fixed, `--bg1`, independent scroll

### 4.2 Topbar
Refer to: UI PRD §6.2

- [ ] 52px fixed, full width, `--bg1`, `border-bottom: 1px solid --border`
- [ ] Logo: `RESCUE` (white) `GRID` (orange), Barlow Condensed 20px 700 `letter-spacing: 0.08em`
- [ ] Nav tabs: Dashboard · Deployments · Resources · Broadcast · Messages — JetBrains Mono 11px UPPERCASE. Active: orange text + 2px orange bottom border. Inactive: `--text-dim`.
- [ ] Right side counters (live, from Supabase):
  - `N CRITICAL` — `victim_report WHERE urgency='critical' AND status!='resolved'` — count in `--red-alert` 14px bold
  - `N ACTIVE` — `assignment WHERE status='active'` — count in `--orange` 14px bold
  - `N VOLS` — `volunteer WHERE status='active'` — count in white 14px bold
- [ ] Session timer — live ticking from login time, JetBrains Mono 13px green, green-tinted pill bg
- [ ] `+ CREATE TASK` primary small Button → opens Create Assignment modal (Phase 5)
- [ ] `EMERGENCY BROADCAST` danger small Button → navigate to `/dma/broadcast`
- [ ] All counters update via Supabase Realtime subscriptions

### 4.3 Mapbox Map (center)
Refer to: PRD Module 2, UI PRD §6.4

- [ ] Mapbox GL JS, dark style (`mapbox://styles/mapbox/dark-v11`), fills center column
- [ ] **Victim report pins:** fetch all `victim_report` on load. Pin colored by `situation`. Open reports pulse. Assigned = solid, no pulse. Resolved = faded. Click → popup with phone, situation, urgency, city, district, timestamp, `ASSIGN →` button.
- [ ] **Volunteer markers:** fetch `volunteer WHERE status='active'`. Lettered avatar marker, colored dot by status (green=ready, orange=on-mission, gray=offline). Live position via Realtime on `volunteer` UPDATE.
- [ ] **Layer toggles** (map controls top-right): Need Pins · Volunteer Locations · Relief Camps · Nearby Hospitals (hospitals via Mapbox Places POI query)
- [ ] **Satellite toggle** — switches between dark and satellite-streets style
- [ ] **District filter** — filters visible victim pins by `victim_report.district`
- [ ] New victim reports added to map live via Realtime on `victim_report` INSERT

### 4.4 Left Sidebar — Filters + Resources
Refer to: UI PRD §6.3

- [ ] **Filter section:**
  - Situation type chips: Food · Water · Medical · Rescue · Shelter · Missing (multi-select toggles)
  - Urgency: Critical · Urgent · Moderate (multi-select)
  - District dropdown — distinct `district` values from `victim_report`
  - Filters update visible map pins immediately
- [ ] **Resource cards:**
  - Fetch all `resource` rows
  - Each card: name, quantity progress bar (green >60%, amber 30–60%, red below threshold), unit, location
  - `LOW STOCK` amber badge when `quantity < low_stock_threshold`
  - `EDIT` ghost Button → inline quantity input → `SAVE` primary → PATCH `/api/dma/resource/[id]`

### 4.5 Right Sidebar — Mission Control + Responders
Refer to: UI PRD §6.5

- [ ] **Mission Control:**
  - Live counters: Queue · Active · Duplicate · Done — from `assignment` grouped by `status`
  - Updates via Realtime on `assignment`
- [ ] **Responders list:**
  - All `volunteer` rows — name, type badge, `StatusBadge`, skills (truncated), `last_seen` in Mono dim
  - Sorted: On Mission → Ready → Offline
  - Live updates via Realtime on `volunteer` UPDATE

**Phase 4 is done when:** DMA dashboard loads with live map, seed pins visible, volunteer markers appear, filters work, and counters update in real-time.

---

## Phase 5 — Assignment System
**Goal:** DMA creates assignments via the modal (with Mapbox SearchBox location). Assignments notify volunteers. Status lifecycle works.

### 5.1 Create Assignment Modal
Refer to: UI PRD §6.6, PRD Module 3

Opened by `+ CREATE TASK` in topbar, or `ASSIGN →` from a report pin popup.

- [ ] Modal overlay, `--bg2` background
- [ ] `TASK DESCRIPTION` textarea — `InputField` style
- [ ] `URGENCY` select — Critical / Urgent / Moderate
- [ ] `LOCATION` — **Mapbox SearchBox** (`@mapbox/search-js-react`):
  - Live suggestions as DMA types
  - On selection: auto-fills `location_label` (visible text), `latitude` + `longitude` (hidden state)
  - Clear (×) resets all three
  - Full spec in UI PRD §5.4
- [ ] `ASSIGN TO` — radio: "Individual Volunteer" OR "Task Force" (never both — this is a hard rule from PRD)
  - Individual: dropdown of `volunteer WHERE status='active'`
  - Task Force: dropdown of `task_force WHERE status='active'`
- [ ] `TIMER (optional)` — datetime-local input
- [ ] `LINKED REPORT (optional)` — dropdown of open victim reports (auto-filled if opened from pin popup)
- [ ] `CREATE ASSIGNMENT` primary Button → POST `/api/dma/assignment`
- [ ] `CANCEL` ghost Button → closes modal

### 5.2 API Route — Create Assignment
`app/api/dma/assignment/route.ts` (POST)

- [ ] Validate: `task`, `urgency`, `location_label`, `latitude`, `longitude` required
- [ ] Enforce: exactly one of `assigned_to_volunteer` OR `assigned_to_taskforce` — 400 if both or neither
- [ ] Insert into `assignment` with `status = 'active'`
- [ ] If `assigned_to_volunteer`: fetch `push_token`, send Web Push — title `⚡ New Mission`, body `${urgency} · ${location_label}`
- [ ] If `assigned_to_taskforce`: fetch all member `push_token` via join, send push to each
- [ ] Return created row

### 5.3 Assignments List (`/dma/assignments`)
- [ ] Card list of all assignments, sorted `created_at DESC`
- [ ] Each card: task (truncated), urgency badge, status badge, assignee name, location_label, timer countdown if set
- [ ] Click → expand: full task, linked report, action buttons
- [ ] `MARK COMPLETED` ops Button + `MARK FAILED` danger Button → PATCH `/api/dma/assignment/[id]`

### 5.4 API Route — Update Assignment Status
`app/api/dma/assignment/[id]/route.ts` (PATCH)

- [ ] Accept `{ status: 'completed' | 'failed' }`
- [ ] Update `assignment.status` and `assignment.updated_at = now()`
- [ ] If `completed` and `victim_report_id` is set: also update `victim_report.status = 'resolved'`
- [ ] Return updated row

**Phase 5 is done when:** DMA creates an assignment via modal with Mapbox location search, it appears in the list, status changes are reflected in the database, and linked victim report resolves on completion.

---

## Phase 6 — Task Force Management
**Goal:** DMA creates task forces, manages members, and TFs can be assigned missions.

### 6.1 Deployments Page (`/dma/deployments`)
Refer to: UI PRD §6, PRD Module 4

- [ ] Card list: all task forces (active + dissolved)
- [ ] Each card: TF name, member count, status badge, linked assignment name (if any)
- [ ] `OPEN ROOM` secondary Button → navigate to `/dma/messages` filtered to that TF channel
- [ ] `DISSOLVE` danger Button → PATCH `/api/dma/taskforce/[id]` `{ status: 'dissolved' }`
- [ ] `+ CREATE TASK FORCE` primary Button → opens Create TF modal

### 6.2 Create Task Force Modal
- [ ] `NAME` InputField (required)
- [ ] `ADD MEMBERS` — multi-select from `volunteer` rows: show name + type + status badge
- [ ] `ASSIGN MISSION (optional)` — dropdown of active assignments
- [ ] `CREATE` primary Button → POST `/api/dma/taskforce`

### 6.3 API Routes — Task Force

`app/api/dma/taskforce/route.ts` (POST)
- [ ] Insert into `task_force`
- [ ] Insert one `task_force_member` row per selected volunteer
- [ ] Return created TF with members

`app/api/dma/taskforce/[id]/route.ts` (PATCH)
- [ ] Update `task_force.status` (dissolve)
- [ ] Support member add: `{ addVolunteer: uuid }` → insert `task_force_member`
- [ ] Support member remove: `{ removeVolunteer: uuid }` → delete `task_force_member`

**Phase 6 is done when:** DMA creates a TF with 2+ members, assigns it a mission, and can dissolve it.

---

## Phase 7 — Volunteer PWA
**Goal:** Volunteers view missions, accept and update them, track live map with route, and chat in their TF room.

### 7.1 Missions Screen (`/volunteer/missions`)
Refer to: UI PRD §8.2, PRD Module 6

- [ ] Two tabs: `QUEUE` · `HISTORY` — JetBrains Mono 11px
- [ ] **Queue:** assignments where volunteer is assignee (or their TF), `status = 'active'`
  - Card: task text, urgency badge, location_label, timer countdown, situation tag
  - `ACCEPT` primary Button → PATCH `/api/volunteer/assignment/[id]`
- [ ] **History:** completed + failed — read-only, no action buttons
- [ ] New assignments appear live via Realtime on `assignment`

### 7.2 Active Mission Screen (`/volunteer/active`)
Refer to: UI PRD §8.3

- [ ] **Persistent active mission strip** at top — compact banner: mission name + urgency dot + timer — shows across all volunteer screens when there is an active assignment
- [ ] Full card: task text, location label, coordinates in Mono, urgency badge, live timer countdown
- [ ] Status Buttons:
  - `ON MY WAY` secondary
  - `ARRIVED` secondary
  - `MARK COMPLETED` primary (ops color) → PATCH `/api/volunteer/assignment/[id]`
  - `MARK FAILED` danger → PATCH `/api/volunteer/assignment/[id]`
- [ ] `OPEN TEAM CHAT` secondary Button → navigate to `/volunteer/chat/[taskforce_id]`

### 7.3 Map Screen (`/volunteer/map`)
Refer to: UI PRD §8.4, PRD Module 6

- [ ] Mapbox GL JS dark map, full screen
- [ ] Volunteer live GPS dot — `geolocation.watchPosition` every 5 seconds → PATCH `/api/volunteer/location`
- [ ] Assignment destination: orange pulsing pin
- [ ] **Mapbox Directions API live route:**
  - Fetch `https://api.mapbox.com/directions/v5/mapbox/driving/${volLng},${volLat};${assignLng},${assignLat}`
  - Render as GeoJSON line layer on map
  - Recalculate every 10 seconds as volunteer moves
  - Distance + ETA overlay chip, JetBrains Mono, bottom of screen
- [ ] Other TF members' live locations — avatar markers from `volunteer` WHERE member of same TF, via Realtime
- [ ] `OPEN IN GOOGLE MAPS` ghost Button → deep link to Google Maps with destination coords

### 7.4 Volunteer Location API Route
`app/api/volunteer/location/route.ts` (PATCH)
- [ ] Accept `{ latitude, longitude }` from authenticated volunteer
- [ ] Update `volunteer.latitude`, `volunteer.longitude`, `volunteer.last_seen = now()`
- [ ] Return 200

### 7.5 Task Force Chat (`/volunteer/chat/[taskforce_id]`)
Refer to: UI PRD §8.5

- [ ] Verify volunteer is member of `[taskforce_id]` — if not, redirect to `/volunteer/missions`
- [ ] Chat header: TF name, member count, back arrow
- [ ] Message bubbles:
  - Volunteer messages: left-aligned, `--bg3` bg
  - DMA messages: right-aligned, `--orange-dim` bg, `DMA · COMMAND` label
  - Own messages: right-aligned, slightly distinct shade
  - Each bubble: sender name Barlow 12px bold, text Barlow 13px, timestamp Mono 10px dim
- [ ] **Flag button (⚑)** on each message → PATCH `/api/volunteer/message/[id]/flag` → sets `is_flagged_for_dma = true` and sends push to DMA
- [ ] Message input + `SEND →` → POST `/api/volunteer/message` — inserts `message` with `task_force_id`, `sender_type = 'volunteer'`, `sender_id = auth.uid()`
- [ ] New messages live via Realtime on `message WHERE task_force_id = [taskforce_id]`
- [ ] Mark `read_at` on messages when scrolled into view

### 7.6 Profile Screen (`/volunteer/profile`)
Refer to: UI PRD §8.6

- [ ] Display: name, type badge, skills, equipment from `volunteer` row
- [ ] **Availability toggle** — `ACTIVE` (orange) / `OFFLINE` (gray) → PATCH `/api/volunteer/status`
- [ ] On load: register push subscription via `pushManager.subscribe` → POST push token to `/api/volunteer/push-token`

**Phase 7 is done when:** Volunteer logs in, sees assigned missions, updates status, sees live map with route, chats in TF room, flags a message, and toggles availability.

---

## Phase 8 — DMA Messaging Hub
**Goal:** DMA views and responds to all 5 channel types in one place.

### 8.1 Messages Page (`/dma/messages`)
Refer to: UI PRD §7, PRD Module 5

Two-column layout: channel list left, active thread right.

- [ ] **Channel list:**
  - Victim threads: labeled `REPORT #KL-...` + situation badge
  - TF rooms: labeled `TF · [name]`
  - Direct messages: labeled volunteer name
  - Each item: last message preview (40 chars), timestamp, unread count badge
  - Flagged channels: red ⚑ icon
- [ ] **Thread panel:**
  - Same bubble style as victim status screen
  - Flagged messages: red left border + ⚑ icon
  - Unread: bold sender until `read_at` set
  - Message input + `SEND →` → POST `/api/dma/message` with correct FK for channel type
- [ ] All channels live via Realtime
- [ ] `read_at` updated when DMA opens a thread

### 8.2 API Route — DMA Send Message
`app/api/dma/message/route.ts` (POST)
- [ ] Accept: `content`, `channel_type` (`victim_thread` | `taskforce_room` | `direct`), plus relevant FK
- [ ] Validate FK present for given `channel_type`
- [ ] Insert `message` with `sender_type = 'dma'`
- [ ] If `direct`: send Web Push to target volunteer's `push_token`
- [ ] Return created message

### 8.3 Flag Handler
`app/api/volunteer/message/[id]/flag/route.ts` (PATCH)
- [ ] Set `message.is_flagged_for_dma = true`
- [ ] Send Web Push to DMA: title `⚑ Flag Alert`, body `[volunteer name] flagged a message in [TF name]`
- [ ] Return updated message

**Phase 8 is done when:** DMA sees all channel types, replies work in all channels, flagged messages are highlighted with red border, and unread counts update.

---

## Phase 9 — Broadcast + Resource Management
**Goal:** DMA sends mass emergency notifications. Resource inventory is fully manageable.

### 9.1 Broadcast Page (`/dma/broadcast`)
Refer to: PRD Module 2, UI PRD §6

- [ ] `EMERGENCY BROADCAST` header — Barlow Condensed 32px, `--red-alert`
- [ ] Message textarea InputField
- [ ] Target selector radio:
  - `ALL VOLUNTEERS`
  - `SPECIFIC TASK FORCE` + TF dropdown
  - `EVERYONE`
- [ ] `BROADCAST NOW` danger Button → show confirmation step: recipient count + `CONFIRM` + `CANCEL`
- [ ] On confirm → POST `/api/dma/broadcast`

### 9.2 API Route — Broadcast
`app/api/dma/broadcast/route.ts` (POST)
- [ ] Resolve target volunteer IDs based on `target`
- [ ] Insert one `message` row per target with `sender_type = 'dma'`, `receiver_id` set
- [ ] Send Web Push to each: title `🚨 Emergency Broadcast`, body = first 100 chars of message
- [ ] Return `{ sent: N }`

### 9.3 Resource Management (`/dma/resources`)
Refer to: PRD Module 7, UI PRD §6.3

- [ ] Card grid of all `resource` rows
- [ ] Each card: name, type, quantity progress bar (green/amber/red by stock level), unit, owner_info, location, `updated_at` in Mono dim
- [ ] `LOW STOCK` amber badge when `quantity < low_stock_threshold`
- [ ] `EDIT` ghost Button → inline quantity edit → `SAVE` primary → PATCH `/api/dma/resource/[id]`
- [ ] `+ ADD RESOURCE` primary Button → modal with all fields → POST `/api/dma/resource`

**Phase 9 is done when:** Broadcast reaches all volunteers via Web Push, and resource quantities update with correct color-coded stock indicators.

---

## Phase 10 — PWA Configuration
**Goal:** All three surfaces are installable, offline-capable PWAs with working push notifications.

### 10.1 Web App Manifest
`public/manifest.json`:
```json
{
  "name": "RescueGrid",
  "short_name": "RescueGrid",
  "theme_color": "#FF6B2B",
  "background_color": "#07080A",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
- [ ] Reference in `app/layout.tsx`: `<link rel="manifest" href="/manifest.json">`
- [ ] `<meta name="theme-color" content="#FF6B2B">`
- [ ] Create placeholder icons at `public/icon-192.png` and `public/icon-512.png`

### 10.2 Service Worker
`public/sw.js`:
- [ ] Cache on install: `/`, `/report/*`, `/volunteer/missions`
- [ ] Cache strategy: cache-first for static assets, network-first for API routes
- [ ] Background sync: queue failed report POSTs, retry on reconnect
- [ ] Register service worker in a client component in `app/layout.tsx`

### 10.3 Web Push
- [ ] `lib/push/sendPush.ts`:
  ```ts
  import webpush from 'web-push'
  webpush.setVapidDetails('mailto:admin@rescuegrid.in', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  export async function sendPush(pushToken: string, title: string, body: string) { ... }
  ```
- [ ] On volunteer profile load (client): `navigator.serviceWorker.ready` → `pushManager.subscribe` → POST to `/api/volunteer/push-token`
- [ ] Test all 4 notification types (UI PRD §11):
  - [ ] New assignment → volunteer
  - [ ] DMA direct message → volunteer
  - [ ] Assignment status update → volunteer
  - [ ] Flag alert → DMA

**Phase 10 is done when:** Chrome shows "Add to Home Screen" prompt on victim + volunteer surfaces, offline victim form renders without internet, and a real push notification arrives on a physical device.

---

## Phase 11 — Polish, States & Edge Cases
**Goal:** Every component state from UI PRD §10 is implemented. No blank loading screens, no missing empty states.

### 11.1 Component State Coverage
Verify every row in UI PRD §10:
- [ ] Victim report pin: open (pulsing) · assigned (solid) · resolved (faded)
- [ ] Volunteer marker: online-ready (green dot) · on-mission (orange dot) · offline (gray dot)
- [ ] Assignment card: open · active · completed · failed
- [ ] Task force: active · completed (read-only) · dissolved
- [ ] Message bubble: unread (bold sender) · read (normal) · flagged (red border + ⚑)
- [ ] Resource bar: ok (green >60%) · caution (amber 30–60%) · low (red, below threshold)
- [ ] Availability toggle: active (orange) · offline (gray)
- [ ] Volunteer mission card: new (orange badge) · accepted · in-progress · done · failed

### 11.2 Loading States
- [ ] Map: skeleton overlay until Mapbox fires `map.on('load')`
- [ ] All POST/PATCH: button shows spinner + disabled during request
- [ ] Realtime subscriptions: "CONNECTING…" dim badge until subscription confirms
- [ ] Report status screen: loading skeleton on initial fetch

### 11.3 Empty States
- [ ] DMA assignments list empty → `NO ACTIVE MISSIONS` Mono dim center
- [ ] Volunteer queue empty → `NO PENDING MISSIONS`
- [ ] Resource list empty → `NO RESOURCES LOGGED` + `+ ADD RESOURCE` Button
- [ ] Message channel list empty → `NO ACTIVE CHANNELS`

### 11.4 Error States
- [ ] Geolocation denied on report form → show manual-only map with instructions
- [ ] Mapbox fails to load → show coordinate input fields as fallback
- [ ] Network error on report POST → `FAILED TO SEND — TRY AGAIN` in `--red-alert` Mono
- [ ] Push token registration failure → silent fail (log only), do not break profile screen

### 11.5 Texture + Atmosphere
Refer to: UI PRD §2.1
- [ ] Scanlines in `globals.css`:
  ```css
  body::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 9999;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
    );
  }
  ```
- [ ] 40px orange-tinted grid overlay on DMA dashboard background at 3% opacity

**Phase 11 is done when:** All component states render correctly, no surface shows a blank white screen during loading, and scanline texture is visible at low opacity.

---

## Phase 12 — QA & Deployment
**Goal:** Full end-to-end scenario works on real devices. Deployed to Vercel.

### 12.1 End-to-End Scenario Test
Run this manually in order:
- [ ] Victim opens PWA on mobile Chrome → taps "Rescue" → fills form with real GPS → submits → status screen shows "OPEN"
- [ ] DMA sees new pin appear on map live → clicks pin → creates assignment with Mapbox SearchBox → assigns to volunteer
- [ ] Volunteer receives push notification → opens missions queue → accepts → opens map → sees live route
- [ ] Volunteer chats in TF room → flags a message → DMA receives push notification
- [ ] Volunteer marks mission completed → victim status screen updates to "RESOLVED" in real-time
- [ ] DMA broadcasts to all volunteers → all receive push

### 12.2 Cross-Device Check
- [ ] Victim PWA on Android Chrome (320px minimum width) — all tap targets ≥ 44px, helpline sticky visible
- [ ] Volunteer PWA on Android Chrome — bottom nav accessible, map fills screen, persistent strip visible
- [ ] DMA Dashboard on desktop Chrome 1280px+ — three-column layout correct, map fills center

### 12.3 Vercel Deployment
```bash
bun run build   # Must pass with 0 errors before deploying
bunx vercel     # Deploy (follow prompts)
bunx vercel --prod  # Promote to production
```
- [ ] Set all `.env.local` variables as Vercel environment variables (Settings → Environment Variables → Production)
- [ ] Confirm `NEXT_PUBLIC_*` vars are set for Production scope
- [ ] Test production URL on a real mobile device — verify PWA install + push + Realtime all work

### 12.4 Final Checks
- [ ] `bun run build` completes with 0 errors and 0 TypeScript errors
- [ ] No `console.error` output during normal usage flows
- [ ] RLS verified — open two browser sessions as different volunteers, confirm neither can see the other's assignments
- [ ] Seed data replaced with clean, realistic demo data for presentation

---

## File Structure Reference

```
rescuegrid/
├── app/
│   ├── (victim)/
│   │   ├── page.tsx                              # Victim home
│   │   └── report/
│   │       ├── [type]/page.tsx                   # Report form
│   │       └── status/[id]/page.tsx              # Status + thread
│   ├── (volunteer)/volunteer/
│   │   ├── login/page.tsx
│   │   ├── missions/page.tsx
│   │   ├── active/page.tsx
│   │   ├── map/page.tsx
│   │   ├── chat/[taskforce_id]/page.tsx
│   │   └── profile/page.tsx
│   ├── (dma)/dma/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── deployments/page.tsx
│   │   ├── assignments/page.tsx
│   │   ├── resources/page.tsx
│   │   ├── messages/page.tsx
│   │   └── broadcast/page.tsx
│   └── api/
│       ├── victim/
│       │   ├── report/route.ts
│       │   └── message/route.ts
│       ├── volunteer/
│       │   ├── assignment/[id]/route.ts
│       │   ├── location/route.ts
│       │   ├── message/route.ts
│       │   ├── message/[id]/flag/route.ts
│       │   ├── status/route.ts
│       │   └── push-token/route.ts
│       └── dma/
│           ├── assignment/route.ts
│           ├── assignment/[id]/route.ts
│           ├── taskforce/route.ts
│           ├── taskforce/[id]/route.ts
│           ├── message/route.ts
│           ├── broadcast/route.ts
│           ├── resource/route.ts
│           └── resource/[id]/route.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── StatusBadge.tsx
│   │   └── InputField.tsx
│   ├── map/
│   │   └── MapboxMap.tsx
│   └── dma/
│       ├── Topbar.tsx
│       ├── LeftSidebar.tsx
│       └── RightSidebar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── auth/
│   │   ├── getSession.ts
│   │   └── getVolunteer.ts
│   └── push/
│       └── sendPush.ts
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   └── icon-512.png
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── middleware.ts
├── tailwind.config.ts
└── .env.local
```

---

## Bun Commands Reference

```bash
bun dev              # Start dev server
bun run build        # Production build — run this before every deploy
bun run lint         # ESLint check
bunx vercel          # Deploy to Vercel (preview)
bunx vercel --prod   # Deploy to production
```

> **Always use `bun` or `bunx`. Never use `npm`, `npx`, or `yarn` anywhere in this project.**
