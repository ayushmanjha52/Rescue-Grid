-- 015 — Security hardening, data integrity and performance
-- Run once on an existing RescueGrid database (after 014). Safe to re-run.
--
-- All writes from the apps go through the Next.js API with the service role key
-- (which bypasses RLS), so the policies below only govern what the public anon
-- key and logged-in DMA operators can read directly — mainly for Realtime.

-- ---------------------------------------------------------------------------
-- 1. Close write holes exposed through the public anon key
-- ---------------------------------------------------------------------------

-- "FOR ALL USING (true)" let anyone holding the anon key update or delete
-- resource allocations. Replace it with read-only access (needed for Realtime).
DROP POLICY IF EXISTS "DMA can manage all allocations" ON public.resource_allocation;
DROP POLICY IF EXISTS "volunteers_view_own_allocations" ON public.resource_allocation;
DROP POLICY IF EXISTS "volunteers_update_own_allocations" ON public.resource_allocation;
DROP POLICY IF EXISTS "read_resource_allocation" ON public.resource_allocation;
CREATE POLICY "read_resource_allocation" ON public.resource_allocation
  FOR SELECT TO anon, authenticated
  USING (true);

-- Victim reports are created through /api/victim/report (validated, de-duplicated).
-- Direct anon inserts bypassed that validation.
DROP POLICY IF EXISTS "anon_insert_victim_report" ON public.victim_report;

-- The skill taxonomy tables were created without RLS, so the anon key could
-- rewrite them. Make them read-only to clients.
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_skill_categories" ON public.skill_categories;
CREATE POLICY "read_skill_categories" ON public.skill_categories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_skill_definitions" ON public.skill_definitions;
CREATE POLICY "read_skill_definitions" ON public.skill_definitions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "operators_read_volunteer_skills" ON public.volunteer_skills;
CREATE POLICY "operators_read_volunteer_skills" ON public.volunteer_skills
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 2. Stop leaking personal data through the anon key
-- ---------------------------------------------------------------------------

-- Nothing public needs the volunteer table; it holds phone numbers and push tokens.
DROP POLICY IF EXISTS "anon_select_all_volunteers" ON public.volunteer;

-- Anyone could list every victim's phone number and GPS position. The victim
-- status page now reads its own report through the API instead.
DROP POLICY IF EXISTS "anon_select_victim_report_by_id" ON public.victim_report;

-- Operators need Realtime on the inventory (previously service_role only).
DROP POLICY IF EXISTS "authenticated_select_resource" ON public.resource;
CREATE POLICY "authenticated_select_resource" ON public.resource
  FOR SELECT TO authenticated USING (true);

-- The volunteer app refreshes when it is added to / removed from a task force.
DROP POLICY IF EXISTS "anon_read_task_force_member" ON public.task_force_member;
CREATE POLICY "anon_read_task_force_member" ON public.task_force_member
  FOR SELECT TO anon USING (true);

-- (Resolved by 016_per_user_rls.sql, which scopes these per volunteer.)
-- KNOWN LIMITATION: `message` and `assignment` stay readable by anon because the
-- volunteer app subscribes to Realtime without a Supabase Auth session. Moving
-- volunteers onto Supabase Auth (they already verify by phone OTP) would allow
-- these to be scoped per volunteer.

-- ---------------------------------------------------------------------------
-- 3. AI briefing sessions: allow owners to rename/touch their sessions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update own sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own sessions" ON public.chat_sessions
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- The timestamp trigger ran as the caller and was silently blocked by RLS.
CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_volunteer_from_auth()
RETURNS TABLE (id uuid, name text, mobile_no text, type text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.name, v.mobile_no, v.type, v.status
  FROM public.volunteer v
  WHERE v.auth_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Atomic stock adjustment (used when allocations are consumed / lost)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_resource_quantity(p_resource_id uuid, p_delta double precision)
RETURNS double precision
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.resource
     SET quantity = GREATEST(0, COALESCE(quantity, 0) + p_delta),
         updated_at = now()
   WHERE id = p_resource_id
  RETURNING quantity;
$$;

REVOKE ALL ON FUNCTION public.adjust_resource_quantity(uuid, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_resource_quantity(uuid, double precision) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_resource_quantity(uuid, double precision) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Data integrity (NOT VALID = enforced for new/updated rows only, so any
--    legacy rows don't block the migration)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'victim_report_urgency_check') THEN
    ALTER TABLE public.victim_report ADD CONSTRAINT victim_report_urgency_check
      CHECK (urgency IN ('critical', 'urgent', 'moderate')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'victim_report_situation_check') THEN
    ALTER TABLE public.victim_report ADD CONSTRAINT victim_report_situation_check
      CHECK (situation IN ('food', 'water', 'medical', 'rescue', 'shelter', 'missing')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'victim_report_status_check') THEN
    ALTER TABLE public.victim_report ADD CONSTRAINT victim_report_status_check
      CHECK (status IN ('open', 'verified', 'assigned', 'en_route', 'arrived', 'resolved', 'duplicate')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_status_check') THEN
    ALTER TABLE public.assignment ADD CONSTRAINT assignment_status_check
      CHECK (status IN ('open', 'active', 'en_route', 'on_my_way', 'arrived', 'on-mission', 'completed', 'failed', 'duplicate')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_single_assignee_check') THEN
    ALTER TABLE public.assignment ADD CONSTRAINT assignment_single_assignee_check
      CHECK (NOT (assigned_to_volunteer IS NOT NULL AND assigned_to_taskforce IS NOT NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_quantities_check') THEN
    ALTER TABLE public.resource ADD CONSTRAINT resource_quantities_check
      CHECK (quantity >= 0 AND low_stock_threshold >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_allocation_status_check') THEN
    ALTER TABLE public.resource_allocation ADD CONSTRAINT resource_allocation_status_check
      CHECK (status IN ('allocated', 'in_use', 'consumed', 'returned', 'lost')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_allocation_quantities_check') THEN
    ALTER TABLE public.resource_allocation ADD CONSTRAINT resource_allocation_quantities_check
      CHECK (quantity_allocated > 0
             AND COALESCE(quantity_consumed, 0) >= 0
             AND COALESCE(quantity_returned, 0) >= 0
             AND COALESCE(quantity_consumed, 0) + COALESCE(quantity_returned, 0) <= quantity_allocated) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_force_member_unique') THEN
    -- Remove duplicate memberships before enforcing uniqueness.
    DELETE FROM public.task_force_member a
      USING public.task_force_member b
     WHERE a.ctid > b.ctid
       AND a.task_force_id = b.task_force_id
       AND a.volunteer_id = b.volunteer_id;
    ALTER TABLE public.task_force_member ADD CONSTRAINT task_force_member_unique UNIQUE (task_force_id, volunteer_id);
  END IF;
END $$;

-- Deleting a volunteer/task force shouldn't be blocked by (or orphan) memberships.
ALTER TABLE public.task_force_member DROP CONSTRAINT IF EXISTS task_force_member_volunteer_id_fkey;
ALTER TABLE public.task_force_member ADD CONSTRAINT task_force_member_volunteer_id_fkey
  FOREIGN KEY (volunteer_id) REFERENCES public.volunteer(id) ON DELETE CASCADE;
ALTER TABLE public.task_force_member DROP CONSTRAINT IF EXISTS task_force_member_task_force_id_fkey;
ALTER TABLE public.task_force_member ADD CONSTRAINT task_force_member_task_force_id_fkey
  FOREIGN KEY (task_force_id) REFERENCES public.task_force(id) ON DELETE CASCADE;

-- Keep assignment.updated_at honest even for writes that forget to set it.
DROP TRIGGER IF EXISTS assignment_updated_at_trigger ON public.assignment;
CREATE TRIGGER assignment_updated_at_trigger
  BEFORE UPDATE ON public.assignment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Indexes for the queries the API actually runs
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_assignment_volunteer ON public.assignment (assigned_to_volunteer) WHERE assigned_to_volunteer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_taskforce ON public.assignment (assigned_to_taskforce) WHERE assigned_to_taskforce IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_victim_report ON public.assignment (victim_report_id) WHERE victim_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_created ON public.assignment (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_victim_report_created ON public.victim_report (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_victim_report_phone ON public.victim_report (phone_no);
CREATE INDEX IF NOT EXISTS idx_victim_report_open_urgency ON public.victim_report (urgency) WHERE status NOT IN ('resolved', 'duplicate');
CREATE INDEX IF NOT EXISTS idx_message_receiver ON public.message (receiver_id) WHERE receiver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_sender ON public.message (sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_direct ON public.message (created_at DESC) WHERE task_force_id IS NULL AND victim_report_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_allocation_status ON public.resource_allocation (status);
