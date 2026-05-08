# RescueGrid — UI / Design PRD
**Version:** 1.2  
**Format:** Markdown (developer reference)  
**Synced with:** PRD v1.2 · ERD v3  
**Surfaces:** DMA Dashboard (desktop) · Volunteer PWA (mobile) · Victim PWA (mobile)

---

## 1. Design Philosophy

RescueGrid is a **tactical operations platform** — not a consumer app, not a SaaS dashboard. The visual language borrows from military command interfaces and mission control rooms. Every element communicates urgency, hierarchy, and clarity. No decorative elements that don't carry information.

The interface must work at **3am in a flood zone** with a tired operator. High contrast, large tap targets, status readable at a glance, zero cognitive overhead.

**Three non-negotiable principles:**
1. **Status is always visible** — a user should never have to hunt for whether something is active, critical, or done
2. **No ambiguous actions** — every button says exactly what it does
3. **Information density without clutter** — pack data, but use whitespace and hierarchy to make it scannable

---

## 2. Design Language

### 2.1 The Signature Elements

**Angular clip-path buttons** — all interactive CTAs use a cut corner (`clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))`). This is the single most recognizable visual element. It communicates precision, military utility, and intentionality. Never use pill/rounded buttons anywhere in the system.

**Monospace metadata** — every ID, timestamp, coordinate, counter, and status label uses `JetBrains Mono`. Body text and headings use `Barlow` / `Barlow Condensed`. The contrast between the two typefaces creates a clear hierarchy between content and metadata.

**Thin accent lines** — a 2–3px colored top border on cards communicates status at a glance before the user reads anything. Red = critical, orange = active, green = complete, blue = informational.

**Scanline texture + grid overlay** — subtle CSS scanlines (repeating-linear-gradient) and an orange-tinted 40px grid overlay on the dark background create depth without heavy visuals. Opacity is very low (3%) — it's felt, not seen.

### 2.2 Tone
- Futuristic but immediately readable
- Serious, not clinical
- Dense information, not cluttered
- Accessible to a panicked user on a cheap Android phone (victim PWA)
- Impressive to a judge at a hackathon (DMA dashboard)

---

## 3. Color System

### Dark Theme (Primary)

| Token | Hex | Usage |
|---|---|---|
| `--bg0` | `#07080A` | Page background |
| `--bg1` | `#0D0F12` | App shell, topbar |
| `--bg2` | `#13161B` | Cards, panels |
| `--bg3` | `#1A1E25` | Elevated surfaces, chat header |
| `--bg4` | `#222830` | Input fields, avatar backgrounds |
| `--orange` | `#FF6B2B` | Primary actions, active states, brand |
| `--orange-dim` | `rgba(255,107,43,0.12)` | Orange surface fills |
| `--orange-glow` | `rgba(255,107,43,0.25)` | Orange hover borders |
| `--red-alert` | `#FF3B3B` | Critical alerts, danger, rescue pins |
| `--green-ok` | `#2ECC71` | Completed, ready, online status |
| `--blue-accent` | `#3B8BFF` | Assigned state, informational, intel |
| `--amber` | `#F5A623` | Warnings, low stock, mid urgency |
| `--text-primary` | `#F0EDE8` | Main readable text |
| `--text-secondary` | `#8A8F99` | Subtitles, descriptions |
| `--text-dim` | `#4A505C` | Metadata, timestamps, IDs |
| `--border` | `rgba(255,107,43,0.15)` | Orange-tinted borders |
| `--border-dim` | `rgba(255,255,255,0.06)` | Neutral card borders |

### Light Theme (System preference fallback)

| Token | Value | Usage |
|---|---|---|
| Page background | `#F5F6F8` | |
| Surface | `#FFFFFF` | Cards |
| Primary action | `#0066FF` | Replaces orange |
| Critical | `#E53E3E` | Same role |
| Text primary | `#0D1117` | |
| Text secondary | `#5A606E` | |
| Border | `#E2E5EA` | |

---

## 4. Typography

### Font Stack

```css
--font-display: 'Barlow Condensed', sans-serif;  /* Headings, labels, IDs */
--font-body:    'Barlow', sans-serif;             /* Body text, messages */
--font-mono:    'JetBrains Mono', monospace;      /* Metadata, codes, counters */
```

### Scale

| Role | Font | Size | Weight | Transform |
|---|---|---|---|---|
| Page title / hero | Barlow Condensed | 48–64px | 700 | UPPERCASE |
| Section heading | Barlow Condensed | 32–36px | 600 | — |
| Card title | Barlow Condensed | 17–20px | 600 | UPPERCASE |
| Nav item | JetBrains Mono | 11px | 400 | UPPERCASE |
| Status badge | JetBrains Mono | 10px | 500 | UPPERCASE |
| Body text | Barlow | 14–15px | 400 | — |
| Message text | Barlow | 13px | 400 | — |
| Metadata / ID | JetBrains Mono | 10–11px | 400 | UPPERCASE |
| Counter number | Barlow Condensed | 48px | 700 | — |

### Rules
- Never use Inter, Roboto, or system fonts anywhere
- Monospace is for data, not for body text
- Letter spacing: `0.05–0.15em` on uppercase mono labels, `0` on display headings
- Line height: `1.3` for display, `1.6` for body, `1.5` for messages

---

## 5. Interactive Elements

### 5.1 Buttons

All buttons use the angular clip-path. No exceptions.

```css
clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
```

| Variant | Background | Text | Border | Use case |
|---|---|---|---|---|
| Primary | `#FF6B2B` | `#000` | none | Create Task, Accept, Confirm |
| Secondary | transparent | `#FF6B2B` | 1px orange | Deploy Force, Open Room |
| Ghost | `--bg3` | `--text-secondary` | 1px dim | Cancel, View, Secondary actions |
| Danger | transparent | `#FF3B3B` | 1px red | Mark Failed, Dissolve TF |
| Small | same variants | same | same | Inline actions in cards |

Padding: `10px 24px` standard, `7px 16px` small  
Font: Barlow Condensed 600, 13px, `letter-spacing: 0.15em`, UPPERCASE

### 5.2 Status Badges

All badges use JetBrains Mono 10px with a 5px colored dot prefix that pulses on Critical.

| Badge | Background | Text color | Dot color | Pulse |
|---|---|---|---|---|
| Critical | `rgba(255,59,59,0.15)` | `#FF6B6B` | `#FF3B3B` | Yes — 1.2s |
| On Mission | `rgba(255,107,43,0.12)` | `#FF6B2B` | `#FF6B2B` | No |
| Ready | `rgba(46,204,113,0.1)` | `#2ECC71` | `#2ECC71` | No |
| Standby | `--bg3` | `--text-secondary` | `--text-dim` | No |
| Completed | `rgba(59,139,255,0.1)` | `#3B8BFF` | `#3B8BFF` | No |

### 5.3 Input Fields

Left-border accent style — no full border on top/right/bottom, only a 3px left accent in orange.

```
border-left: 3px solid --orange
border-bottom: 1px solid --border-dim
background: --bg3
```

On focus: `background: --bg4`, full border switches to orange  
Label: JetBrains Mono 10px orange, `letter-spacing: 0.2em`, UPPERCASE, above the field

### 5.4 Location Search Field (Mapbox SearchBox)

Used in the Create Assignment form on the DMA dashboard.

- Standard input field style (left orange border)
- Label: `LOCATION`
- As DMA types → Mapbox SearchBox API fires → dropdown of suggestions appears below
- Suggestion items: place name (Barlow 14px) + coordinates (Mono 11px dim)
- On selection: `location_label` auto-fills the input, `latitude` + `longitude` hidden fields auto-populated
- Clear button (×) resets all three fields
- Supports area-level search — e.g. typing "Chalakudy" returns neighborhood/district level results

---

## 6. DMA Dashboard — Full Spec

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TOPBAR (52px, full width, fixed)                           │
├──────────────┬──────────────────────────────┬───────────────┤
│ LEFT SIDEBAR │                              │ RIGHT SIDEBAR │
│ 260px fixed  │    MAPBOX MAP (fills rest)   │ 320px fixed   │
│              │                              │               │
│ Filters      │                              │ Mission Ctrl  │
│ Resources    │                              │ Responders    │
│              │                              │ Messages      │
└──────────────┴──────────────────────────────┴───────────────┘
```

All three columns scroll independently. No full-page scroll. Map always fills center.

### 6.2 Topbar

Height: 52px, `background: --bg1`, `border-bottom: 1px solid --border`

Left to right:
- **Logo** — `RESCUE` (white) + `GRID` (orange), Barlow Condensed 20px 700, `letter-spacing: 0.08em`
- **Nav tabs** — Dashboard · Deployments · Resources · Broadcast · Messages  
  Font: JetBrains Mono 11px, `letter-spacing: 0.15em`, UPPERCASE  
  Active tab: orange text + 2px orange bottom border  
  Inactive: `--text-dim`, no border
- **Right side** (in order):
  - `N CRITICAL` counter — Mono 11px, number in red 14px bold
  - `N ACTIVE` counter — number in orange 14px bold
  - `N VOLS` counter — number in white 14px bold
  - Session timer — Mono 13px green, green-tinted background pill, live ticking
  - `+ CREATE TASK` button — Primary variant, small
  - `EMERGENCY BROADCAST` button — Danger variant, small

### 6.3 Left Sidebar — Filters + Resources

**Filters section:**

```
// FILTER BY NEED TYPE
[Food] [Water]
[Medical] [Rescue]
[Shelter] [Missing]

// URGENCY LEVEL
● Critical    [ON toggle]
● Urgent      [ON toggle]
● Moderate    [ON toggle]

// DISTRICT FILTER          ← NEW in v1.2
[Dropdown: All Districts]
  └ Thrissur
  └ Ernakulam
  └ Chalakudy
  (populated from VICTIM_REPORT.district values)

// MAP LAYERS
○ Need Pins         [toggle]
○ Volunteer Locations [toggle]
○ Relief Camps      [toggle]
○ Nearby Hospitals  [toggle]
```

Filter chips: Barlow Condensed 13px, ghost button style, colored left border per type  
Toggle: standard pill toggle, orange when ON  
District dropdown: standard input field style, populates dynamically from DB

**Resource Summary section:**

```
// RESOURCE SUMMARY

RESCUE BOATS          4 / 8 units
████████░░░░░░░░      [3px bar, amber at 50%]

FOOD PACKETS — LOW    120 / 500 pcs
████░░░░░░░░░░░░░░    [3px bar, red at 24%]
                      ↑ shows when qty < low_stock_threshold

MEDICAL KITS          28 / 30 units
██████████████████    [3px bar, green at 93%]

[+ ADD RESOURCE]  [EDIT]
```

Resource name: Barlow Condensed 14px 600 UPPERCASE  
Quantity: JetBrains Mono 12px  
LOW badge: red, Mono 10px, only visible when `quantity < low_stock_threshold`  
Bar: 3px height, color changes: green (>60%), amber (30–60%), red (<30%) or below threshold  
DMA can click quantity to edit inline — input appears in place, Enter to save  
DMA can click resource name to edit `low_stock_threshold` in a small popover

### 6.4 Center — Mapbox Map

- Base style: Mapbox dark (`mapbox://styles/mapbox/dark-v11`)
- Satellite toggle: switches to `mapbox://styles/mapbox/satellite-streets-v12`
- Grid of 40x40px subtle lines overlay (CSS, not Mapbox layer)

**Victim report pins:**
- Circle markers, colored by situation type
- Red = Rescue, Amber = Medical, Blue = Water, Green = Food, Purple = Shelter, Gray = Missing
- Size scales with urgency: Critical = 20px, Urgent = 16px, Moderate = 12px
- Click → detail card slides in from right sidebar

**Volunteer markers:**
- Circle with first letter of name, `--bg4` background, `--border-dim` border
- Green dot indicator = online (last_seen < 2 min ago)
- Orange dot = on mission
- Gray dot = offline
- Live position updates via Supabase Realtime on `VOLUNTEER` lat/lng
- Click → volunteer detail card in right sidebar

**Task force member view:**
- When DMA opens a task force room, TF member markers highlight with orange ring
- Non-TF markers dim to 30% opacity
- Shows task force boundary as dashed orange polygon

**Relief camps + hospitals:**
- Toggleable layers via Mapbox POI
- Hospital icon: white cross on blue square marker
- Relief camp icon: tent icon on green square marker

### 6.5 Right Sidebar — Mission Control + Messaging

**Mission Control panel:**

```
⚡ MISSION CONTROL
   1 ACTIVE REPORTS

[QUEUE: 0] [ACTIVE: 1] [DUPLICATE: 0] [DONE: 4]

Standing By / Active Mission indicator
```

Status counters: Barlow Condensed 24px number + Mono 10px label below  
Active mission shows task force name, assignment title, timer ticking

**Live Responders panel:**

```
👥 LIVE RESPONDERS (8)              [P] [M] [S]

P  Priya Devi          [ON MISSION]
   NDRF · FIRST_AID
   last seen: just now              ← NEW in v1.2

M  Manoj Singh         [READY]
   Police · FIRST_AID
   last seen: 3 min ago

S  Sunita Oraon        [ON MISSION]
   NGO · COOKING
   last seen: just now
```

Avatar: 32px square, letter, `--bg4` background  
Name: Barlow Condensed 14px 600  
Type + skill: Mono 10px `--text-dim`  
`last_seen`: Mono 10px dim — "just now" if < 2 min, "N min ago" if recent, "offline" if > 15 min  
Status badge: On Mission (orange), Ready (green), Offline (gray)

**Messages panel** (when Messages tab active — see §7 for full spec)

### 6.6 Create Assignment Modal

Triggered by `+ CREATE TASK` in topbar.

```
// CREATE ASSIGNMENT

TASK DESCRIPTION
[free text input, multiline]
"Rescue 30 civilians at riverbank sector 4..."

LOCATION                              ← Mapbox SearchBox
[Chalakudy Riverbank, Sector 3–5   ×]
 └ Chalakudy, Thrissur, Kerala     10.8505, 76.2711
 └ Chalakudy River Bridge          10.8512, 76.2698
 └ ...

URGENCY
[● CRITICAL]  [● URGENT]  [● MODERATE]

ASSIGN TO
[○ Individual Volunteer]  [○ Task Force]
  └ [Volunteer dropdown]    └ [TF dropdown]
  (only one active at a time)

TIMER (optional)
[HH : MM]

[CANCEL]  [CREATE ASSIGNMENT →]
```

Modal: centered overlay, `--bg2` background, 600px wide, orange top border 2px  
Location field uses Mapbox SearchBox component — live suggestions dropdown  
Assign to: radio toggle, selecting one greys out the other  
Create button: Primary variant, disabled until task + location + assignee filled

---

## 7. Messaging Panel — Full Spec

This is the most complex UI module. One panel, 5 channel types, all from one `MESSAGE` table.

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ MESSAGES                              [🔍 search channels]  │
├──────────────────┬──────────────────────────────────────────┤
│ CHANNEL LIST     │  ACTIVE CHANNEL                         │
│ 240px           │                                           │
│                  │  [channel header]                        │
│ ── VICTIM        │  ─────────────────────────────────────  │
│ REPORTS (3)      │  [message bubbles]                      │
│  ● Ravi Kumar    │                                           │
│  ● Anjali Singh  │                                           │
│  ● Unknown       │                                           │
│                  │                                           │
│ ── TASK FORCE    │                                           │
│ ROOMS (2)        │                                           │
│  ● TF-Alpha      │                                           │
│  ● TF-Beta       │                                           │
│                  │                                           │
│ ── DIRECT (4)    │  [input bar]                             │
│  ● Priya Devi    │                                           │
│  ● Manoj Singh   │                                           │
└──────────────────┴──────────────────────────────────────────┘
```

### 7.2 Channel List (left column)

Width: 240px, `background: --bg1`, `border-right: 1px solid --border-dim`

Three sections with section headers:
- `// VICTIM REPORTS` — channels scoped by `victim_report_id`
- `// TASK FORCE ROOMS` — channels scoped by `task_force_id`
- `// DIRECT` — channels where `task_force_id = null` and `victim_report_id = null`

Each section header: Mono 10px `--text-dim` UPPERCASE, `letter-spacing: 0.2em`

**Channel item:**
```
● Ravi Kumar                    [2]   ← unread count badge
  Rescue · Chalakudy            2m    ← situation type + time
```

- Active channel: `--bg3` background, orange left border 2px
- Unread count: orange circle badge, Mono 10px, disappears when `read_at` populated
- Green dot = victim replied recently, orange dot = awaiting DMA reply
- Flagged channel: red exclamation icon in top right of channel item

**Task Force room item:**
```
● TF-ALPHA ROOM                 [5]
  4 members · NDRF + NGO         1m
```

**Direct item:**
```
● Priya Devi                    ✓✓
  On Mission · NDRF              5m
```

### 7.3 Victim Report Thread

Channel type: `victim_report_id` is set, `task_force_id` is null

**Channel header:**
```
┌────────────────────────────────────────────────┐
│ 🆘 RAVI KUMAR · RESCUE                         │
│    Chalakudy, Thrissur · 10.8505, 76.2711      │
│    Reported: 14:32 IST · Status: OPEN          │
│    +91 98XXX XXXXX  [📞 CALL]  [ASSIGN →]      │
└────────────────────────────────────────────────┘
```

Header background: `--bg3`, left border 3px red  
Status badge inline in header  
`[ASSIGN →]` button creates assignment pre-filled with this report's location

**Message thread:**
```
                                    [V]  ← victim avatar
                         Ravi Kumar  14:32
                    ┌─────────────────────┐
                    │ Water level rising. │
                    │ 6 people on roof.   │
                    │ Please help fast.   │  ← right-aligned, dim bg
                    └─────────────────────┘

[D]  ← DMA avatar (orange tinted)
DMA · COMMAND  14:45
┌───────────────────────────────┐
│ Help is on the way. Stay on   │
│ the roof. Team ETA: 20 mins.  │  ← left-aligned, orange-dim bg
└───────────────────────────────┘
```

Victim messages: right-aligned, `--bg3` background  
DMA messages: left-aligned, `--orange-dim` background, orange "DMA · COMMAND" label  
Both: Barlow 13px, `line-height: 1.5`, Mono 10px timestamp below bubble

### 7.4 Task Force Group Room

Channel type: `task_force_id` is set

**Channel header:**
```
┌────────────────────────────────────────────────┐
│ ● TF-ALPHA ROOM              4 MEMBERS ONLINE  │
│   NDRF · NGO · 2 INDIVIDUAL                    │
│   Assignment: Rescue Chalakudy Sector 4        │
└────────────────────────────────────────────────┘
```

Orange dot pulse in header = room active  
Member count + types shown in subline  
Assignment name links to assignment detail

**Message bubbles:**
```
[P]
PRIYA DEVI · NDRF  14:36
┌─────────────────────────────────┐
│ 20 mins out. Need boat coords.  │
└─────────────────────────────────┘

[M]
MANOJ SINGH · POLICE  14:37
┌─────────────────────────────────────────┐
│ Road blocked at checkpoint 3. Use NH.   │
│                              ⚑ FLAGGED │  ← flag indicator
└─────────────────────────────────────────┘

[D] DMA · COMMAND  14:38           ← distinct DMA style
┌─────────────────────────────────────┐
│ 2 boats dispatched from SDRF. ETA   │
│ 15 mins. Proceed via NH 544.        │
└─────────────────────────────────────┘
```

DMA messages: orange-dim background, "DMA · COMMAND" label in orange Mono  
Flagged messages: red flag icon + "FLAGGED" text in Mono red below bubble, red left border on bubble  
Private DMA reply to one member: shows `→ PRIYA DEVI` tag above bubble, visible to all but styled differently  
Unread messages: bold sender name, subtle pulse on avatar dot

**Input bar:**
```
┌───────────────────────────────────────────────┐
│ [Message TF-Alpha...                      ] 📎 │
│ [SEND →]  [⚑ FLAG]                            │
└───────────────────────────────────────────────┘
```

DMA has additional `[PRIVATE →]` button that opens a member picker before sending

### 7.5 Direct Channel

Channel type: `task_force_id = null`, `victim_report_id = null`

Same bubble layout as group room but simpler header:
```
┌──────────────────────────────────────┐
│ [M] MANOJ SINGH · POLICE             │
│     Ready · Last seen: just now      │
└──────────────────────────────────────┘
```

### 7.6 Flagged Message Notification (DMA)

When `is_flagged_for_dma = true` is inserted:
- PWA push notification fires to DMA browser: `"⚑ Manoj Singh flagged a message in TF-Alpha"`
- In messages panel: channel moves to top of list, red badge appears
- Flagged bubble gets red left border + "⚑ FLAGGED" Mono label
- In topbar: bell icon shows red dot until DMA opens the channel

### 7.7 Read / Unread State

- `read_at` is null → message is unread → bold sender, unread count badge on channel
- `read_at` populated → read → normal weight, badge disappears
- `read_at` is updated via Supabase when the channel is opened and user is scrolled to bottom

---

## 8. Volunteer PWA — Full Spec

### 8.1 Shell

Full-height mobile layout. Fixed bottom nav (4 tabs). Content area scrolls within tab.

**Status bar strip** (top, 36px):
```
09:41        RescueGrid · Dhanbad
```
Mono 10px, `--bg0` background, device-like

**Active mission strip** (persistent, above bottom nav, 44px):  
Shows when volunteer has an active assignment. Always visible regardless of active tab.
```
⚡ RESCUE · CHALAKUDY     00:24:15 [→ GO]
```
Orange background, black text, timer ticking. Tapping it navigates to Active tab.

**Bottom nav:**
```
[📋 Tasks] [⚡ Active] [🗺 Map] [👤 Profile]
```
Active tab: orange label + subtle orange dot above icon  
Inactive: `--text-dim`  
Font: Mono 9px UPPERCASE, `letter-spacing: 0.1em`

### 8.2 Tasks Screen (My Missions)

```
[M]  MY MISSIONS              [📋]
     DHANBAD DISPATCH

[QUEUE (1)] [HISTORY (2)]
──────────────────────────────
```

Tab selector: active tab has white background + border, inactive transparent  
Font: Mono 11px UPPERCASE `letter-spacing: 0.15em`

**Mission card (queue):**
```
┌──────────────────────────────────────┐
│ // MISSION-KL-042              [NEW] │
│ Deliver medical kits to              │
│ Sector 7 relief camp                 │
│                                      │
│ 📍 Sector 7, Jharia · 3.2km         │
│ ⏱ Urgent · No timer set             │
│──────────────────────────────────────│
│ [ACCEPT →]              [DETAILS]   │
└──────────────────────────────────────┘
```

Left border: 3px orange  
ID: Mono 10px orange  
Task: Barlow Condensed 18–20px 600  
Location: Barlow 13px `--text-secondary`  
Urgency badge: inline  

**Mission card (history):**
```
┌──────────────────────────────────────┐
│ // MISSION-KL-039           [DONE ✓] │
│ Patrol Sector 3 evacuation route     │
│ Completed · 2h 14m · 12 Oct 14:20   │
└──────────────────────────────────────┘
```

Left border: 3px green (done) or 3px red (failed)

### 8.3 Active Screen

```
// MISSION-KL-042                 [ACTIVE]

Deliver medical kits to Sector 7 relief camp

📍 Sector 7, Jharia, Dhanbad
   location_label from ASSIGNMENT

⏱ 00:45:12 remaining

[ON MY WAY →]  [ARRIVED]  [COMPLETED ✓]  [✗ FAILED]

──────────────────────────────────────
TF-ALPHA ROOM                   [→ OPEN CHAT]
4 members · 2 messages unread
```

Status buttons: full-width row, Primary/Ghost/Danger variants  
Only one status button active at a time based on current status  
Task force chat shortcut at bottom — shows unread count

### 8.4 Map Screen — Live Routing

This is the key navigation screen for active assignments.

```
┌──────────────────────────────────────┐
│  [Mapbox dark map, full screen]      │
│                                      │
│  📍 Blue dot = my location (GPS)     │
│                                      │
│  ──── Orange route line ────►        │
│                                      │
│  📍 Orange pin = assignment dest.    │
│                                      │
│  [P] [S] [R] TF member markers       │
│                                      │
└──────────────────────────────────────┘
│ SECTOR 7 RELIEF CAMP                 │
│ 3.2 km · ~12 min driving             │
│ [OPEN IN GOOGLE MAPS ↗]              │
└──────────────────────────────────────┘
```

**Mapbox Directions implementation:**
- `GET /directions/v5/mapbox/driving/{lng,lat};{dest_lng,dest_lat}`
- Route rendered as `LineLayer` on Mapbox GL JS, orange color (`#FF6B2B`), 4px width
- Source: volunteer's live GPS (`navigator.geolocation.watchPosition`)
- Destination: `ASSIGNMENT.latitude` + `ASSIGNMENT.longitude`
- Route recalculates automatically when volunteer deviates more than 50m from route
- ETA and distance shown in bottom strip (Barlow Condensed 18px)
- "Open in Google Maps" constructs `https://maps.google.com/?daddr=lat,lng` link

**Task force member markers:**
- Only shown when volunteer is in an active task force
- Pull from `TASK_FORCE_MEMBER` → `VOLUNTEER` lat/lng via Supabase Realtime
- Letter avatar markers, same style as DMA map but smaller (24px)

### 8.5 Chat Screen (Task Force Room)

Route: `/volunteer/chat/[taskforce_id]`

```
← TF-ALPHA ROOM              4 online

──────────────────────────────────────
[P] PRIYA DEVI · NDRF        14:36
    "20 mins out. Need boat coords."

    [D] DMA · COMMAND         14:38   ← orange bubble
        "2 boats dispatched. ETA 15m."

[M] MANOJ SINGH · POLICE     14:40
    "Road clear on NH 544 now."
    [⚑]  ← flag button on each message

──────────────────────────────────────
[Type a message...            ] [→]
                          [⚑ FLAG DMA]
```

Back arrow returns to previous screen  
DMA messages: orange-tinted bubble, "DMA · COMMAND" orange label  
Flag button: small, on right side of each message on long-press or swipe  
`[⚑ FLAG DMA]` button in input bar flags the last sent message  
Unread messages scroll position auto-jumps to first unread on open

### 8.6 Profile Screen

```
[M]  MANOJ SINGH
     Police · Dhanbad Dispatch

AVAILABILITY
[██████████] ACTIVE  ←→  OFFLINE
(toggle updates VOLUNTEER.status)

──────────────────────────────────────
SKILLS        First Aid · Rescue
EQUIPMENT     Rope · Radio · Torch
TYPE          Police
MOBILE        +91 98XXX XXXXX
──────────────────────────────────────

PUSH NOTIFICATIONS
[ON] Assignment alerts
[ON] DMA direct messages
[ON] Task force activity
```

Availability: large toggle, orange = Active, gray = Offline  
Each field: Mono label (10px dim) + Barlow value (14px)  
Notification toggles update `push_token` registration state

---

## 9. Victim PWA — Full Spec

### 9.1 Home Screen

```
RESCUE GRID  [SOS]           Dhanbad ▼

▲ GPS ACTIVE · DHANBAD, JH

What do you need?
आपको क्या चाहिए?

┌─────────────┐  ┌─────────────┐
│ 🍱          │  │ 💧          │
│ Food        │  │ Water       │  ← green border
│ भोजन        │  │ पानी        │    ← blue border
└─────────────┘  └─────────────┘
┌─────────────┐  ┌─────────────┐
│ 🏥          │  │ 🆘          │
│ Medical     │  │ Rescue      │  ← amber border
│ चिकित्सा    │  │ बचाव        │    ← red border
└─────────────┘  └─────────────┘
┌─────────────┐  ┌─────────────┐
│ 🏠          │  │ 👤          │
│ Shelter     │  │ Missing     │  ← purple border
│ आश्रय        │  │ लापता        │    ← gray border
└─────────────┘  └─────────────┘

[📋 My Reports / मेरी रिपोर्ट]

[📞 Helpline: 1070]  ← sticky bottom, always visible
```

Cards: angular clip-path, `--bg2` background, colored left border by type  
English label: Barlow Condensed 18px 700 UPPERCASE  
Hindi label: Barlow 13px `--text-secondary`  
Card tap: brief orange flash animation, then navigate to report form  
SOS badge: red background, Mono 10px, top-right of logo  
Location chip: orange-dim bg, "▲ LOCATION, STATE" Mono 10px  
Helpline button: full-width, Primary variant, always sticky at bottom

### 9.2 Report Form

```
← RESCUE                    बचाव

📍 YOUR LOCATION
   [Map miniature — pin draggable]
   Chalakudy, Thrissur, Kerala
   [Use current location ↻]

PHONE NUMBER
[+91 XXXXXXXXXX           ]

TELL US MORE (optional)
[Water level rising, 6 people on roof...]

[SEND REPORT →]
```

Map miniature: 160px tall Mapbox static map, pin draggable to correct location  
Phone input: numeric keyboard on mobile  
Custom message: textarea, max 280 chars, character counter  
Send button: Primary, full width, disabled until phone filled  
On submit: spinner → success screen

### 9.3 Report Status Screen

Route: `/report/status/[id]`

```
REPORT #KL-2024-0042

STATUS: ASSIGNED         ← live badge, updates via Realtime
━━━━━━━━━━━━━━━━━━━━━━

RESCUE · CRITICAL
Chalakudy, Thrissur
Reported: 14:32 IST

──────────────────────────────────────
UPDATES FROM COMMAND
──────────────────────────────────────

                    DMA · COMMAND   14:45
             ┌──────────────────────────┐
             │ Help is on the way.      │
             │ Stay on the roof. Team   │
             │ ETA: 20 minutes.         │
             └──────────────────────────┘

You                                  14:46
┌──────────────────────────┐
│ Thank you. Water is now  │
│ at 2nd floor level.      │
└──────────────────────────┘

──────────────────────────────────────
[Type a message...      ] [SEND →]
──────────────────────────────────────

[📞 Call Helpline: 1070]
```

Status badge: live via Supabase Realtime on `VICTIM_REPORT.status`  
Progress steps (optional visual): Open → Assigned → In Progress → Resolved  
DMA messages: right-aligned, `--orange-dim` bg  
Victim messages: left-aligned, `--bg3` bg  
Reply input: same input style, sends MESSAGE with `victim_report_id` FK  
Realtime: new DMA messages appear instantly without refresh

---

## 10. Component States Reference

| Component | States |
|---|---|
| Victim report pin (map) | open (pulsing), assigned (solid), resolved (faded) |
| Volunteer marker (map) | online-ready (green dot), on-mission (orange dot), offline (gray dot) |
| Assignment card | open, active, completed, failed |
| Task force | active, completed (read-only), dissolved |
| Message bubble | unread (bold sender), read (normal), flagged (red border + icon) |
| Resource bar | ok (green, >60%), caution (amber, 30–60%), low (red, below threshold) |
| Availability toggle | active (orange), offline (gray) |
| Mission card | new (orange badge), accepted, in-progress, done, failed |

---

## 11. PWA Configuration

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

**Offline cache (service worker):**
- Victim home screen and report form cached for offline use
- Cached report form submits when connection restores (background sync)
- Volunteer missions list cached for last-known state
- Map tiles cached for last viewed area (Mapbox offline tiles)

**Push notification payloads:**

| Trigger | Title | Body |
|---|---|---|
| New assignment | `⚡ New Mission` | `Rescue · Chalakudy Sector 4` |
| DMA direct message | `💬 DMA Command` | `Message from command center` |
| Assignment status update | `✓ Mission Update` | `TF-Alpha marked completed` |
| DMA flagged (DMA device) | `⚑ Flag Alert` | `Manoj Singh flagged in TF-Alpha` |

---

## 12. Spacing System

Base unit: `4px`. All spacing is a multiple of 4.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon gap, tight inline |
| `space-2` | 8px | Badge padding, small gap |
| `space-3` | 12px | Component gap |
| `space-4` | 16px | Card padding, standard gap |
| `space-5` | 20px | Section inner padding |
| `space-6` | 24px | Page padding mobile |
| `space-8` | 32px | Section gap |
| `space-10` | 40px | Page padding desktop |
| `space-15` | 60px | Major section break |

---

## 13. Tailwind Config Tokens

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        void:    '#07080A',
        surface: {
          1: '#0D0F12',
          2: '#13161B',
          3: '#1A1E25',
          4: '#222830',
        },
        orange: {
          DEFAULT: '#FF6B2B',
          dim: 'rgba(255,107,43,0.12)',
          glow: 'rgba(255,107,43,0.25)',
        },
        alert:   '#FF3B3B',
        ops:     '#2ECC71',
        intel:   '#3B8BFF',
        caution: '#F5A623',
        ink:     '#F0EDE8',
        muted:   '#8A8F99',
        dim:     '#4A505C',
      },
      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        body:    ['Barlow', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      clipPath: {
        'tactical': 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        'tactical-sm': 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
      },
    },
  },
}
```

---

## 14. What Was Added in v1.2

| Addition | Where | Why |
|---|---|---|
| District filter dropdown in left sidebar | §6.3 | VICTIM_REPORT.city/district added to ERD v3 |
| `last_seen` display in responder panel | §6.5 | VOLUNTEER.last_seen added to ERD v3 |
| Mapbox SearchBox spec for Create Assignment | §6.6 | location_label/lat/lng flow finalized |
| Full messaging panel spec (all 5 channels) | §7 | Major gap in v1.0 — now fully documented |
| Victim reply thread UI | §7.3 | Two-way victim↔DMA thread added in PRD v1.2 |
| Flagged message notification flow | §7.6 | is_flagged_for_dma field in ERD v3 |
| Read/unread state spec | §7.7 | read_at field in ERD v3 |
| Active mission persistent strip | §8.1 | UX improvement for volunteer PWA |
| Mapbox Directions live routing full spec | §8.4 | Route rendering + recalculation behavior |
| Task force member map markers on volunteer map | §8.4 | Volunteer location sharing in TF |
| PWA manifest + offline cache + push payloads | §11 | PWA delivery format finalized |
| Component states reference table | §10 | Developer quick reference |
