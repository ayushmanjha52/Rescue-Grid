-- 016 — Per-user Row Level Security
-- Run once after 015. Safe to re-run.
--
-- Volunteers now sign in with Supabase Auth (phone OTP) and use that session for
-- Realtime, so reads can finally be scoped per person:
--   * DMA operators (email accounts)  → read all operational data
--   * volunteers (phone accounts)     → only their own missions, task forces,
--                                       team chat, direct messages and supplies
--   * anon (public key, victims)      → nothing except the skill taxonomy
-- Victims get live updates through a Realtime *broadcast* ping instead of table access.
--
-- All writes still go through the Next.js API with the service role key, which
-- bypasses RLS, so there are no INSERT/UPDATE/DELETE policies for clients
-- (except operators' own AI briefing history).
--
-- NOTE: this drops EVERY existing policy on the tables listed below and
-- recreates the complete set, so the end state doesn't depend on history.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can look up membership without
-- recursing into the policies they are used in)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_volunteer_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.volunteer WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_volunteer_task_force_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tfm.task_force_id
  FROM public.task_force_member tfm
  JOIN public.volunteer v ON v.id = tfm.volunteer_id
  WHERE v.auth_id = auth.uid()
$$;

-- Mirrors isDmaUser() in the app: an email account that isn't a volunteer.
-- (The optional DMA_ALLOWED_EMAILS allow-list is enforced by the app; keep
-- public sign-ups disabled so only operators you create have email accounts.)
CREATE OR REPLACE FUNCTION public.is_dma_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'email', '') <> ''
     AND NOT EXISTS (SELECT 1 FROM public.volunteer WHERE auth_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.current_volunteer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_volunteer_task_force_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_dma_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_volunteer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_volunteer_task_force_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_dma_operator() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Clean slate
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'victim_report', 'volunteer', 'assignment', 'task_force', 'task_force_member',
        'message', 'resource', 'resource_allocation', 'skill_categories',
        'skill_definitions', 'volunteer_skills', 'chat_sessions', 'chat_messages'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.victim_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_force ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_force_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Operators: read all operational data
-- ---------------------------------------------------------------------------

CREATE POLICY "operators_read_victim_reports" ON public.victim_report
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_volunteers" ON public.volunteer
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_assignments" ON public.assignment
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_task_forces" ON public.task_force
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_task_force_members" ON public.task_force_member
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_messages" ON public.message
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_resources" ON public.resource
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_resource_allocations" ON public.resource_allocation
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));
CREATE POLICY "operators_read_volunteer_skills" ON public.volunteer_skills
  FOR SELECT TO authenticated USING ((SELECT public.is_dma_operator()));

-- ---------------------------------------------------------------------------
-- Volunteers: only their own slice
-- ---------------------------------------------------------------------------

CREATE POLICY "volunteers_read_self" ON public.volunteer
  FOR SELECT TO authenticated
  USING (id = (SELECT public.current_volunteer_id()));

CREATE POLICY "volunteers_read_own_assignments" ON public.assignment
  FOR SELECT TO authenticated
  USING (
    assigned_to_volunteer = (SELECT public.current_volunteer_id())
    OR assigned_to_taskforce IN (SELECT public.current_volunteer_task_force_ids())
  );

CREATE POLICY "volunteers_read_own_task_forces" ON public.task_force
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_volunteer_task_force_ids()));

CREATE POLICY "volunteers_read_teammates" ON public.task_force_member
  FOR SELECT TO authenticated
  USING (
    volunteer_id = (SELECT public.current_volunteer_id())
    OR task_force_id IN (SELECT public.current_volunteer_task_force_ids())
  );

-- Team rooms they belong to + their direct thread with DMA Command.
-- Victim threads stay between the victim and DMA.
CREATE POLICY "volunteers_read_own_messages" ON public.message
  FOR SELECT TO authenticated
  USING (
    task_force_id IN (SELECT public.current_volunteer_task_force_ids())
    OR receiver_id = (SELECT public.current_volunteer_id())
    OR sender_id = (SELECT public.current_volunteer_id())
  );

CREATE POLICY "volunteers_read_own_allocations" ON public.resource_allocation
  FOR SELECT TO authenticated
  USING (
    volunteer_id = (SELECT public.current_volunteer_id())
    OR task_force_id IN (SELECT public.current_volunteer_task_force_ids())
  );

CREATE POLICY "volunteers_read_own_skills" ON public.volunteer_skills
  FOR SELECT TO authenticated
  USING (volunteer_id = (SELECT public.current_volunteer_id()));

-- ---------------------------------------------------------------------------
-- Everyone: the public skill taxonomy
-- ---------------------------------------------------------------------------

CREATE POLICY "public_read_skill_categories" ON public.skill_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_skill_definitions" ON public.skill_definitions
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Operators' own AI briefing history
-- ---------------------------------------------------------------------------

CREATE POLICY "operators_read_own_chat_sessions" ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) AND (SELECT public.is_dma_operator()));
CREATE POLICY "operators_create_own_chat_sessions" ON public.chat_sessions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND (SELECT public.is_dma_operator()));
CREATE POLICY "operators_update_own_chat_sessions" ON public.chat_sessions
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND (SELECT public.is_dma_operator()))
  WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "operators_delete_own_chat_sessions" ON public.chat_sessions
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND (SELECT public.is_dma_operator()));

CREATE POLICY "operators_read_own_chat_messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM public.chat_sessions WHERE created_by = (SELECT auth.uid())));
CREATE POLICY "operators_write_own_chat_messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (SELECT id FROM public.chat_sessions WHERE created_by = (SELECT auth.uid()))
    AND (SELECT public.is_dma_operator())
  );
