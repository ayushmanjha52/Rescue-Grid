# RescueGrid Volunteer Login Fix + Real OTP Implementation

## Summary
Three related issues for the volunteer PWA:
1. **UI Bug**: Bottom taskbar appears on login page (should not show during auth)
2. **Missing Feature**: Need real Supabase OTP instead of demo phone lookup
3. **Confirmation**: Allocation UI exists - volunteers CAN see allocated resources and take actions

---

## Issue 1: Login Page Shows Bottom Taskbar

**Current State**: Login at `/volunteer/login` is inside `(volunteer)` route group, so volunteer layout wraps it.

**File**: `rescuegrid/app/(volunteer)/layout.tsx` (lines 222-254)

**Fix Options** (choose one):

| Option | Approach | Complexity |
|--------|----------|------------|
| A | Move login to `(auth)/volunteer/login` | Medium |
| B | Add conditional render in layout.tsx | Low |

**Recommended**: Option B - Add `hideNav` check in layout:
```tsx
const hideNav = pathname === '/volunteer/login' || pathname === '/volunteer/login/verify';
{!hideNav && <nav className="fixed bottom-0..."/>}
```

---

## Issue 2: Real Supabase OTP for Volunteers

### Current State (Demo Mode)
- Simple phone lookup → sets cookie session
- No OTP verification
- Files: `page.tsx` (login form), `route.ts` (API)

### Migration: Add Supabase Auth Phone OTP

**New Migration**: `004_volunteer_auth_otp.sql`

```sql
-- 1. Add auth_id column to volunteer table
ALTER TABLE volunteer ADD COLUMN auth_id uuid UNIQUE;

-- 2. Update RLS policy for volunteer table
-- (allows linking volunteer to auth.users on OTP success)
```

### New Two-Step Flow

**Step 1: Request OTP**
```
POST /api/volunteer/auth/otp/send
Body: { phone }
→ supabase.auth.signInWithOtp({ phone })
```

**Step 2: Verify OTP**
```
POST /api/volunteer/auth/otp/verify
Body: { phone, token }
→ supabase.auth.verifyOtp({ phone, token, type: 'sms' })
→ Create/update volunteer record with auth_id
→ Set session cookie
```

### UI Changes

**New Component**: `app/(volunteer)/volunteer/login/verify/page.tsx`
- OTP input field (6 digits)
- Resend timer (30s)
- Verify button

**Modified**: `app/(volunteer)/volunteer/login/page.tsx`
- Phone input → submit → redirect to verify page
- Store phone in localStorage for verify step

---

## Issue 3: Allocation UI Confirmation

### Current State: EXISTS

**Volunteer View**: `/volunteer/resources`
**File**: `rescuegrid/app/(volunteer)/volunteer/resources/page.tsx`

**Features**:
- Shows personal allocations (`MyResourceCard`)
- Shows task force shared resources (`TFSharedResources`)
- Real-time updates via Supabase subscriptions
- Actions: **Mark Consumed**, **Return Item** (with quantity)
- History section for completed allocations

**MyResourceCard Actions** (lines 110-151):
```tsx
{allocation.status !== "consumed" && allocation.status !== "returned" && (
  <Button onClick={handleMarkConsumed}>MARK CONSUMED</Button>
  <Button onClick={() => setShowReturnInput(true)}>RETURN ITEM</Button>
)}
```

### Status Flow
| Status | Meaning | Next Action |
|--------|---------|-------------|
| allocated | Item assigned, not yet used | Mark Consumed / Return |
| in_use | Currently using | Mark Consumed / Return partial |
| consumed | Fully used | None (history) |
| returned | Returned to inventory | None (history) |

### What's Missing?
- **Accept/Reject** at allocation level (not implemented)
- Currently volunteers can only mark consumed/returned, not explicitly "accept" or "reject" allocations
- If you need explicit acceptance flow, that's a new feature

---

## Implementation Plan

### Phase 1: Fix Login Taskbar (Quick Win)
1. Add pathname check to `layout.tsx`
2. Hide bottom nav on `/volunteer/login` and `/volunteer/login/verify`

### Phase 2: Supabase OTP Migration
1. Create migration `004_volunteer_auth_otp.sql`
2. Run migration on Supabase
3. Configure SMS provider in Supabase Dashboard

### Phase 3: OTP API Endpoints
1. `POST /api/volunteer/auth/otp/send` - Trigger OTP SMS
2. `POST /api/volunteer/auth/otp/verify` - Verify token + create session

### Phase 4: OTP UI Flow
1. Update login page to redirect to verify
2. Create verify page with OTP input
3. Add resend logic with timer

### Phase 5: Update Middleware
1. Change middleware.ts to use Supabase session (not cookie)
2. Link auth.users to volunteer table

### Phase 6: Testing
1. Test OTP flow end-to-end
2. Test allocation UI still works
3. Test session persistence

---

## Environment Variables Needed

```env
# Supabase (already configured for DMA)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# SMS Provider (in Supabase Dashboard, not env)
# Twilio / MessageBird / Vonage credentials configured in Supabase Auth > Phone
```

---

## Questions for You

1. **Accept/Reject Feature**: Do you need explicit "Accept" and "Reject" buttons for allocations, or is the current "Mark Consumed" / "Return" flow sufficient?

2. **SMS Provider**: Which SMS provider do you want to use (Twilio, MessageBird, Vonage)? Supabase supports these via Auth settings.

3. **Migration Priority**: Should I fix the taskbar issue first (separate PR) before implementing OTP?

4. **Fallback Mode**: Should demo mode remain as a fallback (e.g., `NEXT_PUBLIC_DEMO_MODE=true`) for local development without SMS costs?

---

## Acceptance Criteria

- [ ] Bottom nav hidden on login/verify pages
- [ ] Real OTP sent to volunteer phone on login
- [ ] Volunteer enters 6-digit code to authenticate
- [ ] Session linked to Supabase Auth (not custom cookie)
- [ ] Allocation UI continues working with new auth
- [ ] (Optional) Accept/Reject buttons added to allocation flow

---

## Issue 4: Volunteer Profile Skills/Equipment Editing

### Current State
Profile page at `/volunteer/profile` is **read-only**:
- Displays skills and equipment as text
- Only editable field is status (active/offline toggle)
- No API endpoint to update profile data

### Desired Behavior
Volunteers should be able to edit their own:
- **Skills** (text field - comma-separated list)
- **Equipment** (text field - comma-separated list)

### Implementation Plan

#### Phase 7: Update API Endpoint
**File**: `app/api/volunteer/me/route.ts`
- Add `PATCH` method to update `skills` and `equipment` fields
- Validate volunteer owns the record (via session cookie)
- Return updated volunteer data

**Request**: `PATCH /api/volunteer/me`
```json
{
  "skills": "First Aid, Search and Rescue, CPR",
  "equipment": "Rope, First Aid Kit, Flashlight"
}
```

#### Phase 8: Update Profile UI
**File**: `app/(volunteer)/volunteer/profile/page.tsx`
- Add "Edit" button to toggle edit mode
- Show text inputs for skills and equipment when in edit mode
- Show "Save" and "Cancel" buttons during edit
- Save updates via PATCH API
- Show loading state during save
- Show success/error feedback

**UI Flow**:
```
View Mode → [Edit] Click → Edit Mode (inputs + Save/Cancel) → API Call → View Mode (updated)
```

### Files to Modify
| File | Changes |
|------|---------|
| `app/api/volunteer/me/route.ts` | Add PATCH method |
| `app/(volunteer)/volunteer/profile/page.tsx` | Add edit mode UI |

---

## Updated Implementation Order

1. ✅ **Phase 1**: Fix login taskbar
2. ✅ **Phase 2**: OTP Migration (SQL)
3. ✅ **Phase 3**: OTP API Endpoints
4. ✅ **Phase 4**: OTP UI Flow
5. ⏳ **Phase 5**: Update Middleware
6. ⏳ **Phase 6**: Testing
7. ⏳ **Phase 7**: Profile API (PATCH)
8. ⏳ **Phase 8**: Profile UI (Edit Mode)
