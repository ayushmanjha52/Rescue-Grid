# RescueGrid — Product Requirements Document
**Version:** 1.2  
**Stack:** Next.js · Supabase · Mapbox · PWA  
**Status:** Pre-development — Final  
**Changelog from v1.1:**
- Module 1: Added `city`, `district` to VICTIM_REPORT data spec
- Module 3: Added `location_label`, `urgency`, `updated_at` to ASSIGNMENT data spec + Mapbox SearchBox for location search
- Module 5: Added `victim_report_id` FK to MESSAGE channel table + documented 5th channel type
- Module 6: Added Mapbox Directions live routing for active task on volunteer PWA map
- §6 Realtime: Added `push_token` delivery note, `last_seen` trigger, district filter capability
- §11 ERD Reference: Updated to reflect all v3 fields

---

## 1. Overview

RescueGrid is a real-time disaster management platform connecting victims, volunteers, and the District Management Authority (DMA) during emergencies. Victims report emergencies via a PWA. Volunteers and task forces receive and execute assignments via their own PWA. The DMA orchestrates everything from a Next.js web dashboard.

---

## 2. Delivery Format

| Surface | Format | Why |
|---|---|---|
| Victim app | PWA (installable via Chrome) | No app store needed, works on any phone |
| Volunteer app | PWA (installable via Chrome) | Push notifications + location access available via PWA |
| DMA dashboard | Next.js web (desktop) | Full-screen map, complex UI, no install needed |

PWA gives access to:
- Push notifications (DMA flags, new assignment alerts) — delivered via Web Push API using `push_token` stored on VOLUNTEER
- GPS location (volunteer live tracking)
- Offline fallback screen (basic report form cached)

---

## 3. Tech Stack (Final)

| Layer | Technology | Notes |
|---|---|---|
| Frontend + Backend | Next.js (App Router) | API routes handle all backend logic — no separate server needed |
| Database | Supabase (Postgres) | ERD maps directly, RLS for permissions |
| Real-time | Supabase Realtime | Handles messaging, live locations, report updates — no manual WebSocket setup |
| Maps | Mapbox GL JS | Dark map, satellite view, Directions API, Geocoding API, nearby POI |
| Location Search | Mapbox SearchBox (React component) | Autocomplete for assignment location — returns place name + coordinates |
| Auth | Supabase Phone OTP | Demo mode for V1 (mock OTP, no real SMS cost) → real OTP in V2 |
| Hosting | Vercel | Native Next.js, edge functions, PWA support |
| Notifications | Web Push API + Supabase Realtime | push_token stored on VOLUNTEER, triggered on assignment or flag event |

**On Next.js API routes vs dedicated backend:**
Next.js API routes are sufficient and secure for V1. All business logic (creating assignments, managing task forces, broadcasting messages) lives in `/app/api/` route handlers. Supabase handles the database, auth, and real-time layer. No Express, no FastAPI, no separate server.

---

## 4. Users & Roles

### 4.1 Victim
Civilian in distress. No account needed.

**Can:**
- Submit emergency report (situation + location + phone + optional message)
- Receive replies from DMA on their report thread
- Track their report status in real-time
- Call helpline (1070) directly from app

### 4.2 Volunteer
Registered responder — individual, Police, NGO, or NDRF.

**Can:**
- Log in via phone OTP (demo mode in V1)
- View and accept assigned missions (Queue / History)
- See live location of other members within their own task force on map
- See live Mapbox-rendered route from current location to active assignment
- Message within their task force room
- Flag a message to alert DMA
- Update assignment status (active / completed / failed)
- Toggle availability (Active / Offline) — updates `VOLUNTEER.status`

**Cannot:**
- See other task force rooms they don't belong to
- Access DMA dashboard or any other volunteer's assignments

### 4.3 DMA
Full system authority. Web dashboard only.

**Can:**
- See all victim reports as live alert cards on Mapbox map, filterable by district
- See all volunteer locations on map
- See task force member locations scoped to each task force
- Create/close assignments with location search via Mapbox SearchBox
- Create/dissolve task forces, manage members
- Message in any channel — group room or direct to any volunteer
- Reply directly to victim reports
- Broadcast emergency messages to all or specific groups
- View and manually update resource inventory
- Get push notification when a volunteer flags a message

---

## 5. Core Modules

### Module 1 — Victim Report Flow

**App:** PWA, mobile-first, bilingual (English / Hindi)

**Flow:**
1. Victim opens RescueGrid PWA
2. Home screen shows 6 situation cards: Food · Water · Medical · Rescue · Shelter · Missing
3. Victim taps situation → form opens:
   - GPS auto-captured (with manual pin override on map)
   - Phone number input
   - Optional custom message
4. Submit → `VICTIM_REPORT` created, status = `open`
   - `city` and `district` auto-populated via Mapbox reverse geocoding on insert
5. Victim sees status screen — updates in real-time via Supabase Realtime
6. DMA can reply → victim sees reply in their status screen thread (scoped via `victim_report_id` on MESSAGE)

**Urgency:** DMA assigns urgency manually after reviewing the report (Critical / Urgent / Moderate). Not self-reported by victim — keeps the form simple for panicked users.

**Data:** `VICTIM_REPORT` — id, phone_no, latitude, longitude, city, district, situation, custom_message, urgency, status, created_at

---

### Module 2 — DMA Dashboard

Web app, desktop-first, Next.js.

#### Map (center)
- Mapbox dark map with satellite toggle
- Layers: Need Pins · Volunteer Locations · Relief Camps · Nearby Hospitals
- Mapbox Directions API for routing to assignment locations
- Filter sidebar: by situation type, by urgency level, by district
- Victim report pins colored by situation type and urgency
- Volunteer markers as lettered avatars with live location (Supabase Realtime)
- Clicking any pin opens detail card

#### Mission Control (right sidebar)
- Active report count
- Status counters: Queue / Active / Duplicate / Done
- Live responders list with name, skill, status (On Mission / Ready)
- `last_seen` timestamp shown per responder

#### Resource Summary (left sidebar)
- Resource cards: name, current qty / total, unit, location
- Low-stock warning badge when quantity drops below `low_stock_threshold`
- DMA edits quantities inline

#### Top Bar
- Open / Vols / Done / Critical live counters
- Create Task button
- Emergency Broadcast button
- Session timer

#### Deployments Tab
- All task forces: active and dissolved
- Create new task force
- Add/remove members (from available volunteer pool)
- Open task force messaging room

#### Messages Tab
- All channels in one view
- Left column: list of open channels (victim threads + task force rooms + direct)
- DMA can write in any channel
- Flagged messages highlighted

#### Broadcast
- Write message
- Target: All Volunteers / Specific Task Force / Everyone
- Sends as `MESSAGE` row with sender_type = dma

---

### Module 3 — Assignment System

**Creating:**
1. DMA reviews victim report card
2. Clicks "Create Task"
3. Fills:
   - Task description (natural language free text)
   - Location — via **Mapbox SearchBox** autocomplete component:
     - DMA types a place name → live suggestions appear
     - On selection: `location_label`, `latitude`, `longitude` auto-filled
     - Supports clustering: DMA can type a area name covering multiple victim report locations (e.g. "Chalakudy Riverbank, Sector 3–5")
   - Urgency (Critical / Urgent / Moderate)
   - Assign to: Individual Volunteer OR Task Force (dropdown, never both)
   - Optional timer (deadline)
4. Saved → status = `active` → assigned party notified via Supabase Realtime + PWA push to `push_token`

**Lifecycle:** open → active → completed / failed

**Rule:** One assignment goes to either one volunteer OR one task force — never both simultaneously. Enforced at API route level. `assigned_to_volunteer` and `assigned_to_taskforce` are mutually exclusive nullable FKs.

**Data:** `ASSIGNMENT` — id, task, location_label, latitude, longitude, urgency, status, assigned_to_volunteer (nullable FK), assigned_to_taskforce (nullable FK), victim_report_id (FK), timer, created_at, updated_at

---

### Module 4 — Task Force System

**Creating:**
1. DMA opens Deployments tab
2. New Task Force → name it
3. Add members from available volunteer pool → assign `member_type` (police / ngo / ndrf / individual) and `role`
4. Task force created → messaging room auto-spawned (scoped by `task_force_id`)
5. Task force linked to its assignment via `TASK_FORCE.assignment_id`

**Member location sharing:**
- Within a task force, all members can see each other's live location on their map view
- Powered by Supabase Realtime subscription on `VOLUNTEER` lat/lng fields
- Rendered on Mapbox as labeled avatar markers

**Lifecycle:**
- Active → assignment in progress
- Completed → assignment marked done, room moves to History (read-only archive)
- Dissolved by DMA → room archived, members return to available pool

**Archived rooms** are accessible to members in read-only History tab — full message history preserved.

**Data:** `TASK_FORCE` — id, name, dma_id, status, assignment_id (FK), created_at  
**Data:** `TASK_FORCE_MEMBER` — id, task_force_id (FK), volunteer_id (FK), member_type, role

---

### Module 5 — Messaging System

Single `MESSAGE` table handles all channel types via 5 fields: `sender_type`, `sender_id`, `task_force_id`, `victim_report_id`, `receiver_id`.

**All 5 channel types:**

| Channel | sender_type | task_force_id | victim_report_id | receiver_id |
|---|---|---|---|---|
| Victim → DMA report thread | victim | null | report ID | dma ID |
| DMA → victim reply | dma | null | report ID | victim sender_id |
| Volunteer ↔ DMA direct | volunteer / dma | null | null | specific ID |
| Task force group room | volunteer / dma | TF id | null | null |
| DMA private reply in TF | dma | TF id | null | member ID |

**Real-time:** Supabase Realtime subscriptions — no manual WebSocket code.

**Flagging:** Volunteer taps flag on any message → `is_flagged_for_dma = true` → DMA receives PWA push notification + highlighted message in dashboard.

**Read tracking:** `read_at` timestamp updated when recipient opens the message — powers unread count badges in UI.

**Volunteer sees:** Only their own task force rooms, their direct DMA messages, and nothing else.

**DMA sees:** Every channel across all tables simultaneously.

---

### Module 6 — Volunteer PWA

**Bottom nav:** Tasks · Active · Map · Profile

**Tasks (My Missions):**
- Queue tab: incoming assignments waiting to be accepted
- History tab: completed / failed assignments + archived task force rooms (read-only)

**Active:**
- Current assignment card with task description, location label, timer
- Status buttons: On My Way / Arrived / Completed / Failed
- Open task force chat directly from this screen

**Map:**
- Volunteer's own location (live GPS dot)
- Assignment destination pin
- **Mapbox Directions API — live route rendered on map:**
  - Route drawn from volunteer's current GPS location to assignment `latitude/longitude`
  - Route updates in real-time as volunteer moves
  - Shows estimated distance and travel time
  - Recalculates automatically if volunteer deviates
- Other task force members' live locations shown as avatar markers (when in a TF)
- "Open in Google Maps" button as navigation fallback

**Chat (`/volunteer/chat/[taskforce_id]`):**
- WhatsApp-style message bubbles
- Sender name + timestamp
- Flag button on each message
- DMA messages visually distinct (different color/badge per UI PRD)

**Profile:**
- Name, type, skills, equipment
- Availability toggle → updates `VOLUNTEER.status` (active / offline)
- `push_token` registered on first login for Web Push notifications

---

### Module 7 — Resource Management

DMA-only. Manual updates.

**Per resource:** name, type, quantity, low_stock_threshold, unit, owner_info, location, updated_at

**DMA actions:**
- Add new resource entry
- Edit quantity manually after deployment
- Set `low_stock_threshold` per resource — triggers LOW warning badge in UI when quantity falls below it

**Mapbox integration:** DMA can see nearby hospitals and relief camp locations on the main map as a toggleable layer — Mapbox POI data, no extra backend needed.

---

## 6. Real-Time Features (All via Supabase Realtime)

| Feature | Table watched | Trigger | Notes |
|---|---|---|---|
| New victim report on DMA map | VICTIM_REPORT | INSERT | Includes city/district for filter |
| Victim sees DMA reply | MESSAGE | INSERT WHERE victim_report_id = X | Scoped by victim_report_id |
| Volunteer receives assignment | ASSIGNMENT | INSERT/UPDATE | Push via push_token on VOLUNTEER |
| Task force room messages | MESSAGE | INSERT WHERE task_force_id = X | All members subscribed |
| Volunteer live location on map | VOLUNTEER | UPDATE (lat/lng) | DMA map + TF member map |
| Volunteer online status | VOLUNTEER | UPDATE (last_seen) | DMA responder panel |
| DMA flagged notification | MESSAGE | INSERT WHERE is_flagged_for_dma = true | Push to DMA via Web Push API |
| Assignment status change | ASSIGNMENT | UPDATE (status) | Victim report status updates too |
| Resource low-stock alert | RESOURCE | UPDATE WHERE quantity < low_stock_threshold | DMA dashboard badge |

---

## 7. Auth (V1 Demo → V2 Real)

**V1 (Demo):**
- Supabase phone auth configured but OTP is mocked (fixed code like 123456)
- No real SMS sent — zero cost
- Sufficient for demos, testing, pitching

**V2 (Production):**
- Real Supabase phone OTP (Twilio under the hood)
- Switch is one config change in Supabase dashboard — no code changes

**DMA login:** Email + password via Supabase Auth. No OTP needed.

---

## 8. Routes

### Victim PWA
- `/` — Home (6 situation cards)
- `/report/[type]` — Report form with GPS capture
- `/report/status/[id]` — Live status + DMA reply thread

### Volunteer PWA
- `/volunteer/login` — Phone OTP
- `/volunteer/missions` — Queue + History tabs
- `/volunteer/active` — Live assignment with status buttons
- `/volunteer/map` — Live GPS map + Mapbox Directions route + TF member locations
- `/volunteer/chat/[taskforce_id]` — Task force group room
- `/volunteer/profile` — Profile + availability toggle

### DMA Dashboard
- `/dma/login` — Email + password login
- `/dma/dashboard` — Main map view (full screen Mapbox)
- `/dma/deployments` — Task force management
- `/dma/assignments` — All assignments list
- `/dma/resources` — Resource inventory
- `/dma/messages` — All message channels
- `/dma/broadcast` — Emergency broadcast

---

## 9. Resolved Decisions

| Question | Decision |
|---|---|
| Can victims receive DMA replies? | Yes — two-way thread scoped by victim_report_id on MESSAGE |
| Can volunteers see each other's location in TF? | Yes — Mapbox + Supabase Realtime within TF scope only |
| Urgency on victim report — self-reported or DMA? | DMA assigns manually after reviewing |
| Dissolved task force rooms accessible? | Yes — read-only History tab for members |
| Dedicated backend or Next.js API routes? | Next.js API routes — sufficient and secure for V1 |
| Native app or PWA? | PWA for all — victim, volunteer, DMA. Installable via Chrome. |
| Real OTP in V1? | No — mocked OTP for demo. Real OTP in V2 (one config change). |
| Assignment location entry? | Mapbox SearchBox autocomplete — auto-fills label + coordinates |
| Multiple victim locations in one assignment? | location_label covers area name, single center-point coordinates |
| Volunteer routing to assignment? | Mapbox Directions API — live route on map, updates as volunteer moves |
| Push notifications mechanism? | Web Push API — push_token stored on VOLUNTEER at login |

---

## 10. Out of Scope (V1)

- AI triage or auto-prioritization of reports
- SMS fallback for no-internet zones
- Multi-district / state coordination
- Flutter / React Native native app
- Analytics and reporting dashboard
- Payment or compensation system for volunteers

---

## 11. ERD Reference (Final — v3)

**Tables:** `VICTIM_REPORT` · `VOLUNTEER` · `ASSIGNMENT` · `TASK_FORCE` · `TASK_FORCE_MEMBER` · `MESSAGE` · `RESOURCE`

**VICTIM_REPORT:** id, phone_no, latitude, longitude, city, district, situation, custom_message, urgency, status, created_at

**VOLUNTEER:** id, name, mobile_no, type, latitude, longitude, skills, equipment, status, push_token, last_seen

**ASSIGNMENT:** id, task, location_label, latitude, longitude, urgency, status, assigned_to_volunteer (FK nullable), assigned_to_taskforce (FK nullable), victim_report_id (FK), timer, created_at, updated_at

**TASK_FORCE:** id, name, dma_id, status, assignment_id (FK), created_at

**TASK_FORCE_MEMBER:** id, task_force_id (FK), volunteer_id (FK), member_type, role

**MESSAGE:** id, content, sender_type, sender_id, task_force_id (FK nullable), victim_report_id (FK nullable), receiver_id (FK nullable), is_flagged_for_dma, created_at, read_at

**RESOURCE:** id, name, type, quantity, low_stock_threshold, unit, owner_info, location, updated_at

**Key rules:**
- Assignment → volunteer OR task force — never both. Enforced at API level.
- Message table handles all 5 channel types via sender_type + task_force_id + victim_report_id + receiver_id
- Task force room = all MESSAGE rows sharing a task_force_id
- Victim thread = all MESSAGE rows sharing a victim_report_id
- Volunteer location stored on VOLUNTEER, updated live via GPS
- push_token on VOLUNTEER powers all PWA push notifications
