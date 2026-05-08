# RescueGrid — Build Progress

**Last Updated:** 2026-04-04T01:05:00+05:30
**Current Phase:** Phase 7.5 — COMPLETE ✅
**Next Phase:** Phase 9 (Broadcast + Resource Management)
**Status:** Real-time subscriptions implemented. Build passes. Ready for Phase 9.

---

## ✅ REAL-TIME ISSUE RESOLVED

**What was fixed:** All polling (setInterval) has been replaced with proper Supabase `channel.subscribe()` using `postgres_changes` events. The UI now updates IMMEDIATELY when data changes in the database - no page refresh needed.

**Pages now using real-time subscriptions:**
- `app/(victim)/report/status/[id]/page.tsx` — victim report + messages (already had it)
- `app/(volunteer)/volunteer/missions/page.tsx` — new assignment notifications
- `app/(volunteer)/volunteer/chat/[taskforce_id]/page.tsx` — new chat messages
- `app/(volunteer)/layout.tsx` — active mission strip + pending count
- `components/dma/Topbar.tsx` — live counters (critical/active/vols)
- `app/(dma)/dma/messages/page.tsx` — all channel updates + flag notifications

---

## Phase 7.5 — Real-Time Subscription Fixes (2026-04-04) ✅ COMPLETE

### Issues Fixed:
- [x] **Volunteer missions page** — Replaced 15s polling with `assignment` table subscription (INSERT/UPDATE)
- [x] **Volunteer chat page** — Replaced 5s polling with `message` table subscription (INSERT)
- [x] **Volunteer layout** — Replaced 15s polling with `assignment` table subscription for active mission strip
- [x] **DMA Topbar** — Replaced 5s polling with subscriptions on `victim_report`, `assignment`, `volunteer` tables
- [x] **Created lib/realtime.ts** — Shared utility for managing real-time subscriptions
- [x] **DMA Messages page** — Implemented full messaging hub with all 5 channel types
- [x] **Created /api/dma/channels** — API to list all DMA message channels
- [x] **Created /api/dma/message** — API for DMA to send messages in any channel

### Files Updated:
- `lib/realtime.ts` — Real-time subscription utilities
- `app/(volunteer)/volunteer/missions/page.tsx` — Real-time assignment subscription
- `app/(volunteer)/volunteer/chat/[taskforce_id]/page.tsx` — Real-time message subscription
- `app/(volunteer)/layout.tsx` — Real-time active mission strip
- `components/dma/Topbar.tsx` — Real-time counter subscriptions
- `app/(dma)/dma/messages/page.tsx` — Full DMA messaging hub (all 5 channel types)
- `app/api/dma/channels/route.ts` — Channel list API
- `app/api/dma/message/route.ts` — DMA message send/fetch API

### Real-Time Subscription Pattern (from victim report status page):
```typescript
// From: app\(victim)\report\status\[id]\page.tsx (lines 107-133)
channelRef.current = supabase
  .channel(`channel-name-${id}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "table_name",
    filter: `id=eq.${id}`,
  }, (payload) => {
    setState(payload.new as Type);
  })
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "message",
    filter: `foreign_id=eq.${id}`,
  }, (payload) => {
    setMessages((prev) => [...prev, payload.new as Message]);
  })
  .subscribe();

// Cleanup in useEffect return:
if (channelRef.current) {
  supabase.removeChannel(channelRef.current);
}
```

### Tables to Subscribe (per PRD Module 6 Real-Time Features):
| Feature | Table | Event |
|---------|-------|-------|
| New victim report on DMA map | `victim_report` | INSERT |
| Victim sees DMA reply | `message` | INSERT (filter: victim_report_id=X) |
| Volunteer receives assignment | `assignment` | INSERT/UPDATE |
| Task force room messages | `message` | INSERT (filter: task_force_id=X) |
| Volunteer live location | `volunteer` | UPDATE (lat/lng) |
| Volunteer online status | `volunteer` | UPDATE (last_seen) |
| DMA flagged notification | `message` | INSERT (filter: is_flagged_for_dma=true) |
| Assignment status change | `assignment` | UPDATE (status) |
| Resource low-stock alert | `resource` | UPDATE |

---

### Issues Fixed:
- [x] **Chat input bar missing** — Added `z-50` and safe-area-inset-bottom padding to fixed input bar
- [x] **Tasks/Active tab routing bug** — Fixed `isActive()` function to do exact pathname matching instead of incorrectly highlighting both tabs
- [x] **Map WebGL container warning** — Added check for childNodes.length > 0 before initializing map
- [x] **Volunteer layout missing** — Recreated `app/(volunteer)/layout.tsx` with status bar, active mission strip, and bottom nav
- [x] **Missing Volunteer API routes** — Created all 6 missing volunteer API routes:
  - `GET /api/volunteer/assignment` — get active assignment
  - `GET /api/volunteer/assignment/queue` — queue assignments
  - `GET /api/volunteer/assignment/history` — completed/failed assignments
  - `GET /api/volunteer/assignment/active` — active assignment
  - `PATCH /api/volunteer/assignment/[id]` — update status
  - `PATCH /api/volunteer/location` — update GPS coordinates
  - `GET/POST /api/volunteer/message` — fetch/send TF messages
  - `PATCH /api/volunteer/message/[id]/flag` — flag message
  - `PATCH /api/volunteer/status` — toggle availability
  - `POST /api/volunteer/push-token` — register push subscription
  - `GET /api/volunteer/me` — volunteer profile

---

## Phase 0 — Project Foundation ✅ COMPLETE

### 0.1 Next.js App Setup ✅
- [x] Run `bunx create-next-app@latest` in `rescuegrid/` subdirectory
- [x] Install dependencies: @supabase/supabase-js, @supabase/ssr, mapbox-gl, @mapbox/mapbox-gl-geocoder, @mapbox/search-js-react, web-push, react-map-gl
- [x] Install dev dependencies: @types/mapbox-gl, @types/web-push
- [x] Configure `globals.css` with full token set from UI PRD §13 via Tailwind v4 @theme
  - Colors: `void`, `surface-1–4`, `orange`, `alert`, `ops`, `intel`, `caution`, `ink`, `muted`, `dim`
  - Font families: `display` (Barlow Condensed), `body` (Barlow), `mono` (JetBrains Mono)
  - Clip path utilities: `clip-tactical`, `clip-tactical-sm`
- [x] Load fonts in `app/layout.tsx` via next/font/google
- [x] Set global CSS variables — all dark theme tokens from UI PRD §3
- [x] Set `<body>` background to `--bg0` (`#07080A`)
- [x] `bun run build` passes with 0 errors

### 0.2 Supabase Client Setup ✅
- [x] `lib/supabase/client.ts` — browser client using createBrowserClient
- [x] `lib/supabase/server.ts` — server client using createServerClient with cookies
- [x] `middleware.ts` at project root — refreshes session on every request
- [x] `.env.local` created with required environment variable placeholders

### 0.3 Route Shells ✅
- [x] Victim PWA: `/`, `/report/[type]`, `/report/status/[id]`
- [x] Volunteer PWA: login, missions, active, map, chat, profile
- [x] DMA Dashboard: login, dashboard, deployments, assignments, resources, messages, broadcast
- [x] All 16 routes verified with `bun run build`

### 0.4 Shared UI Primitives ✅
- [x] `components/ui/Button.tsx` — variant (primary/secondary/ghost/danger), size (default/small), angular clip-path
- [x] `components/ui/StatusBadge.tsx` — status (critical/on-mission/ready/standby/completed), pulsing dot for critical
- [x] `components/ui/InputField.tsx` — label, left 3px orange border, JetBrains Mono uppercase label
- [x] Test page at `/` with all component variants rendered

---

## Phase 1 — Database Schema ✅ COMPLETE

### 1.1 Migrations ✅
- [x] `supabase/migrations/001_initial_schema.sql` created with all 7 tables
  - victim_report, volunteer, task_force, assignment, task_force_member, message, resource
  - Circular FK between task_force and assignment resolved via ALTER TABLE

### 1.2 Realtime ✅
- [x] User confirmed Realtime enabled on all required tables

### 1.3 RLS ✅
- [x] `supabase/migrations/002_rls_policies.sql` created with policies for all 7 tables:
  - victim_report: anon INSERT + SELECT by id; service_role full
  - volunteer: authenticated SELECT/UPDATE own; service_role full
  - assignment: volunteer SELECT if assigned or in their TF; service_role full
  - task_force: volunteer SELECT if member; service_role full
  - task_force_member: volunteer SELECT if member; service_role full
  - message: volunteer SELECT/INSERT via TF or direct; service_role full
  - resource: service_role only

### 1.4 Seed Data ✅
- [x] `supabase/seed.sql` created with:
  - 4 volunteers (individual, Police, NGO, NDRF)
  - 5 victim_reports (rescue/food/medical/shelter/water situations)
  - 2 task forces with 4 members total
  - 3 assignments (1 volunteer, 1 TF, 1 unassigned)
  - 6 messages (victim thread + TF rooms)
  - 5 resources (Water Cans below threshold)

---

## Phase 2 — Authentication ✅ COMPLETE

### 2.1 DMA Login (`/dma/login`) ✅
- [x] Page: `RESCUEGRID` logo, email `InputField`, password `InputField`, `LOGIN →` primary Button
- [x] Password visibility toggle (eye icon)
- [x] Calls `supabase.auth.signInWithPassword({ email, password })` on submit
- [x] On success → redirect to `/dma/dashboard`
- [x] On error → inline error in `--red-alert`, JetBrains Mono 11px

### 2.2 Volunteer Login (`/volunteer/login`) ✅ — REFACTORED
- [x] **TRUE DEMO MODE** — Single-step login, no OTP/SMS
- [x] Phone number input → validates against `volunteer` table
- [x] `POST /api/volunteer/login` — server-side validation using service_role
- [x] Sets `volunteer_session` cookie with `{ volunteer_id, phone, name }`
- [x] No Twilio/SMS dependency — works offline
- [x] On success → redirect to `/volunteer/missions`

### 2.3 Auth Helpers ✅
- [x] `lib/auth/getSession.ts` — server-side Supabase session retrieval (for DMA)
- [x] `lib/auth/getVolunteer.ts` — server-side volunteer from cookie session (for volunteer)

### 2.4 Middleware Auth Protection ✅
- [x] `/dma/*` routes (except `/dma/login`) redirect to `/dma/login` if no Supabase session
- [x] `/volunteer/*` routes (except `/volunteer/login`) redirect to `/volunteer/login` if no `volunteer_session` cookie

---

## Phase 3 — Victim Report Flow ✅ COMPLETE

### 3.1 Victim Home Screen (`/`) ✅ COMPLETE
- [x] Dark screen, `RESCUEGRID` logo centered top — RESCUE white / GRID orange, Barlow Condensed 700
- [x] Bilingual subtitle: "Report Emergency / आपातकाल रिपोर्ट करें" in muted Barlow
- [x] 2×3 grid of situation cards: Food · Water · Medical · Rescue · Shelter · Missing
- [x] Each card: angular clip-path on `--bg2`, colored left border by situation type
- [x] Icon, English label Barlow Condensed 18px 700 UPPERCASE, Hindi label Barlow 13px muted
- [x] Card tap → navigate to `/report/[type]`
- [x] Sticky bottom: `📞 HELPLINE: 1070` full-width primary Button (`href="tel:1070"`)
- [x] SOS badge in top-right of logo
- [x] "My Reports" link to `/report/my`

### 3.2 Report Form (`/report/[type]`) ✅ COMPLETE
- [x] Back arrow top-left → `/`
- [x] Mapbox GL JS map, 160px tall, dark style, draggable pin initialized at browser GPS
- [x] `↻ USE CURRENT LOCATION` ghost Button → calls `geolocation.getCurrentPosition()`
- [x] Detected place name below map in JetBrains Mono 11px dim
- [x] **People Affected** number input — how many people need help (included in message)
- [x] Phone `InputField` — `inputmode="tel"`, required
- [x] Optional message textarea — max 280 chars, character counter in Mono dim bottom-right
- [x] `SEND REPORT →` primary Button, full width — disabled while phone empty, spinner on submit
- [x] On submit: POST to `/api/victim/report` → on success navigate to `/report/status/[new_id]`
- [x] Situation-specific placeholder text for message field

### 3.3 API Route — Create Report ✅ COMPLETE
- [x] `POST /api/victim/report`
- [x] Validate: `phone_no`, `latitude`, `longitude`, `situation` required — 400 if missing
- [x] Call Mapbox Reverse Geocoding to get city and district
- [x] Insert into `victim_report` with service role client
- [x] Return `{ id }` with status 201

### 3.4 Report Status Screen ✅ COMPLETE
- [x] Fetch report on load by `id`
- [x] Display: `REPORT #KL-{YEAR}-{XXXX}`, situation badge, urgency badge
- [x] Live status badge — updates via Supabase Realtime on `victim_report WHERE id = [id]`
- [x] Message thread: DMA messages right-aligned (orange-dim), victim messages left-aligned (bg3)
- [x] Sender label + timestamp in JetBrains Mono 10px dim
- [x] Message input + `SEND →` → POST `/api/victim/message`
- [x] New DMA messages appear live via Realtime on `message WHERE victim_report_id = [id]`
- [x] Sticky bottom: `📞 CALL HELPLINE: 1070` primary Button

### 3.5 My Reports Page (`/report/my`) ✅ COMPLETE
- [x] "My Reports" from home → `/report/my`
- [x] Enter phone number → fetches all reports from `victim_report` where `phone_no` matches
- [x] No localStorage — DB is source of truth, real-time updates work automatically
- [x] Displays report cards with situation (colored border), status badge, city, timestamp
- [x] Tap card → navigates to `/report/status/[id]`
- [x] "New Report" button at bottom

---

## Phase 4 — DMA Dashboard Core ✅ COMPLETE

### 4.1 Dashboard Layout (`/dma/dashboard`) ✅
- [x] Three-column fixed layout: Left 260px | Center flex-1 | Right 320px
- [x] No full-page scroll, each column scrolls independently
- [x] Topbar 52px fixed at top

### 4.2 Topbar ✅
- [x] `RESCUE` (white) `GRID` (orange) logo, Barlow Condensed 20px 700
- [x] Nav tabs: Dashboard · Deployments · Resources · Broadcast · Messages
- [x] Active tab: orange text + 2px orange bottom border
- [x] Live counters: CRITICAL (red), ACTIVE (orange), VOLS (white)
- [x] Session timer: live ticking from login, green Mono text
- [x] `+ CREATE TASK` primary small Button
- [x] `EMERGENCY BROADCAST` danger small Button
- [x] Logout button

### 4.3 Mapbox Map (center) ✅
- [x] Dark map (`mapbox://styles/mapbox/dark-v11`) with satellite toggle
- [x] Victim report pins: colored by situation, sized by urgency, pulsing for critical/open
- [x] Click pin → popup with report details
- [x] Volunteer lettered avatar markers with status dot (green/orange/gray)
- [x] Layer toggles: Need Pins, Volunteer Locations, Relief Camps, Nearby Hospitals
- [x] District filter integration
- [x] **REFACTORED**: Switched to `react-map-gl` with React component markers (better positioning, no CSS transform conflicts)
- [x] **FIXED**: Popup hover flicker - popups now stay visible when transitioning from marker to popup with delayed hide (150ms)
- [x] **FIXED**: Removed default popup box background - popups now display cleanly without duplicate styling

### 4.4 Left Sidebar ✅
- [x] Situation type filter chips (Food/Water/Medical/Rescue/Shelter/Missing)
- [x] Urgency level toggles (Critical/Urgent/Moderate)
- [x] District dropdown filter
- [x] Map layer toggles
- [x] Resource summary cards with inline quantity editing
- [x] Color-coded stock bars (green >60%, amber 30-60%, red below threshold)
- [x] LOW STOCK badge when quantity < threshold

### 4.5 Right Sidebar ✅
- [x] Mission Control: Queue/Active/Duplicate/Done counters
- [x] Selected report panel with CALL and ASSIGN buttons
- [x] Live Responders list: name, type, skills, status badge, last_seen
- [x] Sorted: On Mission → Ready → Offline

### API Routes Created
- [x] `GET /api/dma/counters` — critical, active, vols counts
- [x] `GET /api/dma/assignment/counts` — queue/active/duplicate/done
- [x] `GET /api/volunteer/list` — all volunteers
- [x] `GET /api/volunteer/locations` — volunteers with lat/lng
- [x] `GET /api/dma/resource/list` — all resources
- [x] `GET /api/victim/reports` — all reports (updated to return array)

### Components Created
- [x] `components/dma/Topbar.tsx`
- [x] `components/dma/LeftSidebar.tsx`
- [x] `components/dma/RightSidebar.tsx`
- [x] `components/dma/MapboxMap.tsx`

---

## Phase 5 — Assignment System ✅ COMPLETE

### 5.1 Create Assignment Modal ✅
- [x] `components/dma/CreateAssignmentModal.tsx`
- [x] Triggered by `+ CREATE TASK` in topbar (navigates to `/dma/dashboard?create=true`)
- [x] Task description textarea
- [x] Mapbox SearchBox location: live suggestions → auto-fill `location_label` + `latitude` + `longitude`
- [x] **Location auto-filled** when opened from pin popup (pre-fills from victim report city/district + lat/lng)
- [x] Urgency select: Critical / Urgent / Moderate
- [x] Assign To radio: Individual Volunteer OR Task Force (mutually exclusive)
- [x] Timer (optional) datetime-local input
- [x] Linked Report (optional) dropdown of open victim reports
- [x] `CREATE ASSIGNMENT` primary button → POST `/api/dma/assignment`
- [x] `CANCEL` ghost button closes modal

### 5.2 API Route — Create Assignment ✅
- [x] `POST /api/dma/assignment` — validate required fields
- [x] Enforces exactly one of `assigned_to_volunteer` OR `assigned_to_taskforce`
- [x] Insert with `status = 'active'`
- [x] Push notification to volunteer or all TF members via `lib/push/sendPush.ts`

### 5.3 Assignments List (`/dma/assignments`) ✅
- [x] `app/(dma)/dma/assignments/page.tsx`
- [x] Card list sorted `created_at DESC`
- [x] Each card: task, urgency badge, status badge, assignee name, location_label, timer countdown
- [x] Click to expand: full task, linked report, coordinates, action buttons
- [x] `MARK COMPLETED` (ops) + `MARK FAILED` (danger) buttons → PATCH `/api/dma/assignment/[id]`

### 5.4 API Route — Update Assignment Status ✅
- [x] `PATCH /api/dma/assignment/[id]` — accepts `completed` or `failed`
- [x] Updates `assignment.status` and `assignment.updated_at`
- [x] If `completed` and `victim_report_id` set → `victim_report.status = 'resolved'`

### API Routes Created
- [x] `POST /api/dma/assignment` — create assignment with push notification
- [x] `PATCH /api/dma/assignment/[id]` — update status (completed/failed)
- [x] `GET /api/dma/assignment/list` — list all with enriched volunteer/TF/report names
- [x] `GET /api/dma/taskforce/list` — task force list for modal dropdowns

### New/Updated Files (Phase 5)
- `components/dma/CreateAssignmentModal.tsx` — full assignment creation form with Mapbox SearchBox
- `app/(dma)/dma/assignments/page.tsx` — assignment list with expand/complete/fail
- `app/api/dma/assignment/route.ts` — POST create assignment
- `app/api/dma/assignment/[id]/route.ts` — PATCH update status
- `app/api/dma/assignment/list/route.ts` — GET assignment list with joins
- `app/api/dma/taskforce/list/route.ts` — GET task force list
- `lib/push/sendPush.ts` — lazy-init web-push with VAPID, graceful no-op if keys missing
- `app/(dma)/dma/dashboard/page.tsx` — refactored with Suspense boundary for useSearchParams
- `components/dma/Topbar.tsx` — `+ CREATE TASK` navigates to `/dma/dashboard?create=true`; "Deployments" tab renamed to "Task Forces"

---

## Phase 6 — Task Force Management ✅ COMPLETE

### 6.1 Deployments Page (`/dma/deployments`) ✅
- [x] `app/(dma)/dma/deployments/page.tsx`
- [x] Card list: all task forces (active + dissolved)
- [x] Each card: TF name, member count, status badge, linked assignment name
- [x] `OPEN ROOM` secondary Button → navigate to `/dma/messages?tf=[id]`
- [x] `DISSOLVE` danger Button → PATCH `/api/dma/taskforce/[id]` `{ status: 'dissolved' }`
- [x] `+ CREATE TASK FORCE` primary Button → opens Create TF modal
- [x] Expandable cards showing member list with avatar, name, type
- [x] Empty state when no task forces exist

### 6.2 Create Task Force Modal ✅
- [x] `components/dma/CreateTaskForceModal.tsx`
- [x] `NAME` InputField (required)
- [x] `ADD MEMBERS` — multi-select from `volunteer` rows with name + type + status badge
- [x] `ASSIGN MISSION (optional)` — dropdown of active assignments
- [x] `CREATE` primary Button → POST `/api/dma/taskforce`
- [x] `CANCEL` ghost Button → closes modal

### 6.3 API Routes — Task Force ✅

#### `POST /api/dma/taskforce`
- [x] Validates: name required, at least one member required
- [x] Insert into `task_force` with status 'active'
- [x] Insert one `task_force_member` row per selected volunteer
- [x] Return created TF with members

#### `PATCH /api/dma/taskforce/[id]`
- [x] Update `task_force.status` (dissolve: status = 'dissolved')
- [x] Support member add: `{ addVolunteer: uuid }` → insert `task_force_member`
- [x] Support member remove: `{ removeVolunteer: uuid }` → delete `task_force_member`

### 6.4 Supporting API Routes ✅
- [x] `GET /api/dma/taskforce/list` — enhanced to return member count, member details, and assignment name

### New/Updated Files (Phase 6)
- `app/api/dma/taskforce/route.ts` — POST create task force
- `app/api/dma/taskforce/[id]/route.ts` — PATCH update/dissolve task force
- `app/api/dma/taskforce/list/route.ts` — GET list with enriched data
- `components/dma/CreateTaskForceModal.tsx` — Create TF form modal
- `app/(dma)/dma/deployments/page.tsx` — Deployments page with card list

---

## Phase 7 — Volunteer PWA ✅ COMPLETE

### 7.1 Volunteer Layout ✅ (UPDATED)
- [x] `app/(volunteer)/volunteer/layout.tsx`
- [x] Status bar strip (top 40px): time + "RESCUEGRID" logo in professional Mono styling
- [x] Active mission persistent strip: orange bg, mission name + pulsing dot + timer + arrow
- [x] Professional bottom nav (68px): Tasks · Active · Map · Profile with SVG icons
- [x] Tasks tab badge: orange notification badge with pending count
- [x] Active tab badge: green pulsing dot when mission active

### 7.2 Missions Screen (`/volunteer/missions`) ✅ (UPDATED)
- [x] Two tabs: QUEUE · HISTORY with angular clip-path styling
- [x] Queue: assignments where volunteer is assignee or TF member, `status = 'open'/'active'`
- [x] Each card shows: status badge, urgency badge, task title, location, timer, timestamp
- [x] Clear visual distinction: border color by status (orange=active, ops=completed, alert=failed)
- [x] Expandable cards with "Tap to collapse/expand" cue
- [x] "START MISSION →" vs "CONTINUE MISSION →" based on status
- [x] Quick action buttons (Map, Team Chat) visible after expanding

### 7.3 Active Mission Screen (`/volunteer/active`) ✅ (UPDATED)
- [x] Mission header: ID badge, status badge, urgency label
- [x] Location card: address, coordinates, countdown timer if set
- [x] Status buttons: ON MY WAY / ARRIVED / ✓ COMPLETE / ✗ FAILED
- [x] **Task Force Section**: shows TF name, member count, member avatars with initials and type badges
- [x] Team Chat button in TF section
- [x] VIEW ROUTE ON MAP button
- [x] Empty state with icon and "VIEW QUEUE" button

### 7.4 Map Screen (`/volunteer/map`) ✅
- [x] Mapbox dark map, full screen
- [x] Volunteer live GPS dot — `watchPosition` every update → PATCH `/api/volunteer/location`
- [x] Assignment destination: orange pin marker
- [x] Mapbox Directions API live route: fetches on load, renders as orange LineLayer
- [x] Distance + ETA overlay chip at bottom
- [x] `OPEN IN GOOGLE MAPS ↗` ghost button → deep link with destination coords

### 7.5 Task Force Chat (`/volunteer/chat/[taskforce_id]`) ✅ (UPDATED)
- [x] Chat header with back arrow, TF avatar, name, member count
- [x] Team members panel (toggleable): shows all TF members with initials, name, type badge, online status
- [x] Message bubbles: WhatsApp-style with angular clip-path
- [x] DMA messages: orange background with "🟧 DMA COMMAND" label
- [x] Own messages: right-aligned with distinct style
- [x] Other volunteer messages: left-aligned with sender name
- [x] Flag button on each message (⚑)
- [x] Fixed bottom input bar with text input and send button
- [x] Date separators between message groups
- [x] Empty state with icon

### 7.6 Profile Screen (`/volunteer/profile`) ✅
- [x] Display: name, type badge, skills, equipment from `volunteer` row
- [x] **Availability toggle** — ACTIVE (orange) / OFFLINE (gray) → PATCH `/api/volunteer/status`
- [x] On load: register push subscription via `pushManager.subscribe` → POST `/api/volunteer/push-token`
- [x] Notification preferences display (visual only)

### API Routes Created (Phase 7)
- [x] `GET /api/volunteer/assignment` — get active assignment for volunteer
- [x] `PATCH /api/volunteer/assignment/[id]` — accept/update status (on_my_way/arrived/completed/failed)
- [x] `GET /api/volunteer/assignment/queue` — queue assignments for volunteer
- [x] `GET /api/volunteer/assignment/history` — completed/failed assignments
- [x] `PATCH /api/volunteer/location` — update GPS coordinates + last_seen
- [x] `GET /api/volunteer/message` — fetch TF messages with sender info
- [x] `POST /api/volunteer/message` — send message in TF room
- [x] `PATCH /api/volunteer/message/[id]/flag` — flag message for DMA
- [x] `PATCH /api/volunteer/status` — toggle availability (active/offline)
- [x] `POST /api/volunteer/push-token` — register push subscription
- [x] `GET /api/volunteer/me` — get current volunteer profile

### New/Updated Files (Phase 7)
- `app/(volunteer)/volunteer/layout.tsx` — Volunteer PWA shell with bottom nav
- `app/(volunteer)/volunteer/missions/page.tsx` — Missions queue/history
- `app/(volunteer)/volunteer/active/page.tsx` — Active mission with status buttons
- `app/(volunteer)/volunteer/map/page.tsx` — Map with live GPS and routing
- `app/(volunteer)/volunteer/chat/[taskforce_id]/page.tsx` — TF chat with messaging
- `app/(volunteer)/volunteer/profile/page.tsx` — Profile with availability toggle
- `app/api/volunteer/assignment/route.ts` — GET active assignment
- `app/api/volunteer/assignment/[id]/route.ts` — PATCH status
- `app/api/volunteer/assignment/queue/route.ts` — GET queue
- `app/api/volunteer/assignment/history/route.ts` — GET history
- `app/api/volunteer/message/route.ts` — GET/POST messages
- `app/api/volunteer/message/[id]/flag/route.ts` — PATCH flag
- `app/api/volunteer/status/route.ts` — PATCH status
- `app/api/volunteer/push-token/route.ts` — POST push token
- `app/api/volunteer/me/route.ts` — GET volunteer profile

---

## Phase 8 — DMA Messaging Hub ✅ COMPLETE

### 8.1 DMA Messages Page (`/dma/messages`) ✅
- [x] Two-column layout: channel list (240px) | message thread
- [x] Three channel sections: Victim Reports, Task Force Rooms, Direct Messages
- [x] Channel item: last message preview, timestamp, unread count badge, flagged indicator
- [x] Active channel highlighted with orange left border
- [x] Message thread: bubble style (DMA right-aligned orange, volunteer/victim left-aligned bg3)
- [x] Flagged messages highlighted with red left border
- [x] DMA messages show "DMA COMMAND" label
- [x] Real-time updates via Supabase subscriptions on `message` table
- [x] Flagged message notifications via `is_flagged_for_dma=true` subscription

### 8.2 DMA Send Message API ✅
- [x] `POST /api/dma/message` — sends message with sender_type='dma'
- [x] `GET /api/dma/message` — fetches messages by channel_type + channel_id
- [x] Support for all 5 channel types: victim_thread, taskforce_room, direct

### 8.3 Flag Handler ✅
- [x] `PATCH /api/volunteer/message/[id]/flag` — already existed, sets `is_flagged_for_dma=true`

### API Routes Created
- [x] `GET /api/dma/channels` — lists all channels with unread counts and flag status
- [x] `GET/POST /api/dma/message` — message fetch and send

---

## Next Phase

**Phase 9: Broadcast + Resource Management**
- 9.1: Broadcast Page (`/dma/broadcast`) — emergency broadcast to volunteers/TF/everyone
- 9.2: API Route — Broadcast
- 9.3: Resource Management (`/dma/resources`) — full CRUD for resource inventory

---

## Technical Notes

### Verification Steps

**Test Real-Time Subscriptions:**
1. Open two browser tabs - one as volunteer, one as DMA
2. As DMA, create an assignment for the volunteer
3. The volunteer should IMMEDIATELY see the new assignment in their queue (no refresh needed)
4. As volunteer, send a message in TF chat
5. Other TF members should IMMEDIATATELY see the new message
6. In DMA dashboard, the counters should update IMMEDIATELY when new reports come in

**Test DMA Messages:**
1. Navigate to `http://localhost:3000/dma/messages`
2. Confirm channel list shows: victim threads, TF rooms, direct messages
3. Click a channel → message thread loads
4. Send a message → it appears immediately
5. As volunteer, flag a message → DMA sees red flag indicator in channel list

---

## Technical Notes

- Stack: Next.js 16.2.2 (App Router) · Supabase · Mapbox GL JS · PWA · Vercel
- Package Manager: Bun only (never npm/npx/yarn)
- Tailwind CSS v4 — uses CSS-based `@theme` configuration in globals.css
- Project location: `rescuegrid/` subdirectory
- Next.js 16 uses `proxy.ts` convention (middleware warning present but build passes)
- Database: 7 tables with circular FK (task_force ↔ assignment) resolved via ALTER TABLE

### Auth Architecture (REFACTORED)
- **DMA Auth:** Supabase Auth email/password → `sb-access-token` / `sb-refresh-token` cookies
- **Volunteer Auth:** Custom demo mode → `volunteer_session` cookie (JSON with volunteer_id, phone, name)
  - No Twilio/SMS dependency
  - Validates phone against `volunteer.mobile_no` in DB
  - Cookie is httpOnly, secure in production, 7-day expiry
  - **⚠️ Future:** When ready for real OTP, enable Twilio in Supabase Dashboard → Authentication → Providers → Phone.

### New/Updated Files
- `app/(victim)/page.tsx` — Victim home screen with 2×3 situation card grid
- `app/(victim)/report/[type]/page.tsx` — Report form with Mapbox GPS
- `app/(victim)/report/status/[id]/page.tsx` — Report status + live message thread
- `app/api/victim/report/route.ts` — POST: validate, reverse geocode, insert victim_report
- `app/api/victim/message/route.ts` — POST: insert message as victim sender
- `lib/supabase/service.ts` — Service role client for server-side DB operations
- `app/layout.tsx` — Added `suppressHydrationWarning` to body for browser extension compatibility
- `components/dma/Topbar.tsx` — DMA topbar with logo, nav, counters, session timer
- `components/dma/LeftSidebar.tsx` — Filters + resource summary
- `components/dma/RightSidebar.tsx` — Mission control + responders
- `components/dma/MapboxMap.tsx` — Full Mapbox GL JS map component (refactored to use `react-map-gl` with React markers)
- `app/(dma)/dma/dashboard/page.tsx` — Main DMA dashboard page
- `app/api/dma/counters/route.ts` — Live counter API
- `app/api/dma/assignment/counts/route.ts` — Assignment status counts
- `app/api/volunteer/list/route.ts` — Volunteer list
- `app/api/volunteer/locations/route.ts` — Volunteer locations for map
- `app/api/dma/resource/list/route.ts` — Resource list
