-- =============================================================================
-- RescueGrid — complete database schema for a FRESH Supabase project.
--
-- Run this once in the Supabase SQL editor (or `psql`), then optionally load
-- demo data with seed.sql and migrations/050_volunteer_seed_data.sql.
--
-- Existing databases that were built from the numbered migrations should NOT
-- run this file — apply migrations 015 to 019 (in order) instead.
-- The result of both paths is the same schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.victim_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_no text NOT NULL,
  latitude double precision,              -- nullable: SMS reports may arrive without GPS
  longitude double precision,
  accuracy double precision,              -- metres, from the device GPS
  city text,
  district text,
  situation text NOT NULL CHECK (situation IN ('food', 'water', 'medical', 'rescue', 'shelter', 'missing')),
  custom_message text,
  urgency text NOT NULL DEFAULT 'moderate' CHECK (urgency IN ('critical', 'urgent', 'moderate')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'assigned', 'en_route', 'arrived', 'resolved', 'duplicate')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile_no text NOT NULL UNIQUE,
  type text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  skills text,                            -- legacy free text; normalized in volunteer_skills
  equipment text,
  status text DEFAULT 'active',           -- active | standby | on-mission | offline
  tier smallint NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 4),
  push_token text,
  last_seen timestamptz,
  auth_id uuid UNIQUE,                    -- NULL for walk-ins registered by Command who haven't signed in yet
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_force (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dma_id text,
  status text DEFAULT 'active',           -- active | dissolved
  assignment_id uuid,                     -- FK added after assignment exists
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  location_label text,
  latitude double precision,
  longitude double precision,
  urgency text DEFAULT 'moderate',
  status text DEFAULT 'open' CHECK (status IN ('open', 'active', 'en_route', 'on_my_way', 'arrived', 'on-mission', 'completed', 'failed', 'duplicate')),
  assigned_to_volunteer uuid REFERENCES public.volunteer(id),
  assigned_to_taskforce uuid REFERENCES public.task_force(id),
  victim_report_id uuid REFERENCES public.victim_report(id),
  timer timestamptz,                      -- mission deadline
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT assignment_single_assignee_check CHECK (NOT (assigned_to_volunteer IS NOT NULL AND assigned_to_taskforce IS NOT NULL))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tf_assignment') THEN
    ALTER TABLE public.task_force
      ADD CONSTRAINT fk_tf_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignment(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_force_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_force_id uuid NOT NULL REFERENCES public.task_force(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES public.volunteer(id) ON DELETE CASCADE,
  member_type text,                       -- leader | member
  role text,
  CONSTRAINT task_force_member_unique UNIQUE (task_force_id, volunteer_id)
);

CREATE TABLE IF NOT EXISTS public.message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sender_type text NOT NULL,              -- victim | volunteer | dma
  sender_id uuid,                         -- volunteer id when sender_type = volunteer
  task_force_id uuid REFERENCES public.task_force(id),
  victim_report_id uuid REFERENCES public.victim_report(id),
  receiver_id uuid,                       -- volunteer id for DMA → volunteer direct messages
  assignment_id uuid REFERENCES public.assignment(id) ON DELETE SET NULL, -- mission this update is about
  is_flagged_for_dma boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.resource (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  quantity double precision DEFAULT 0,
  low_stock_threshold double precision DEFAULT 0,
  unit text,
  owner_info text,
  location text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT resource_quantities_check CHECK (quantity >= 0 AND low_stock_threshold >= 0)
);

CREATE TABLE IF NOT EXISTS public.resource_allocation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resource(id),
  assignment_id uuid REFERENCES public.assignment(id),
  task_force_id uuid REFERENCES public.task_force(id),
  volunteer_id uuid REFERENCES public.volunteer(id),
  quantity_allocated double precision NOT NULL,
  quantity_consumed double precision DEFAULT 0,
  quantity_returned double precision DEFAULT 0,
  status text DEFAULT 'allocated' CHECK (status IN ('allocated', 'in_use', 'consumed', 'returned', 'lost')),
  notes text,
  allocated_by uuid,
  allocated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT resource_allocation_quantities_check CHECK (
    quantity_allocated > 0
    AND COALESCE(quantity_consumed, 0) >= 0
    AND COALESCE(quantity_returned, 0) >= 0
    AND COALESCE(quantity_consumed, 0) + COALESCE(quantity_returned, 0) <= quantity_allocated
  )
);

CREATE TABLE IF NOT EXISTS public.skill_categories (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.skill_definitions (
  id serial PRIMARY KEY,
  category_id int NOT NULL REFERENCES public.skill_categories(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.volunteer_skills (
  volunteer_id uuid NOT NULL REFERENCES public.volunteer(id) ON DELETE CASCADE,
  skill_id int NOT NULL REFERENCES public.skill_definitions(id),
  PRIMARY KEY (volunteer_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT 'New Disaster Briefing',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Skill taxonomy
-- -----------------------------------------------------------------------------

INSERT INTO public.skill_categories (id, code, name) VALUES
  (1, 'MEDICAL', 'Medical'),
  (2, 'RESCUE', 'Search & Rescue'),
  (3, 'LOGISTICS', 'Logistics'),
  (4, 'COMMUNICATION', 'Communication'),
  (5, 'SPECIAL', 'Special Skills')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.skill_definitions (id, category_id, code, name) VALUES
  (1, 1, 'first_aid', 'First Aid'),
  (2, 1, 'paramedic', 'Paramedic'),
  (3, 1, 'doctor', 'Doctor'),
  (4, 1, 'nurse', 'Nurse'),
  (5, 2, 'swimmer', 'Open Water Swimmer'),
  (6, 2, 'rope_rescue', 'Rope Rescue'),
  (7, 2, 'structural_search', 'Structural Search'),
  (8, 3, 'driver', 'Driver (LMV)'),
  (9, 3, 'heavy_vehicle', 'Heavy Vehicle'),
  (10, 3, 'drone_operator', 'Drone Operator'),
  (11, 4, 'ham_radio', 'Ham Radio'),
  (12, 4, 'translator', 'Translator'),
  (13, 5, 'psychologist', 'Psychologist'),
  (14, 5, 'civil_engineer', 'Civil Engineer'),
  (15, 5, 'firefighter', 'Firefighter')
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.skill_categories_id_seq', (SELECT MAX(id) FROM public.skill_categories));
SELECT setval('public.skill_definitions_id_seq', (SELECT MAX(id) FROM public.skill_definitions));

-- -----------------------------------------------------------------------------
-- Functions & triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS victim_report_updated_at_trigger ON public.victim_report;
CREATE TRIGGER victim_report_updated_at_trigger BEFORE UPDATE ON public.victim_report
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS assignment_updated_at_trigger ON public.assignment;
CREATE TRIGGER assignment_updated_at_trigger BEFORE UPDATE ON public.assignment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_resource_allocation_updated_at ON public.resource_allocation;
CREATE TRIGGER update_resource_allocation_updated_at BEFORE UPDATE ON public.resource_allocation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_session_timestamp ON public.chat_messages;
CREATE TRIGGER trigger_update_session_timestamp AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_timestamp();

-- Atomic stock change used when allocations are consumed / lost (service role only).
CREATE OR REPLACE FUNCTION public.adjust_resource_quantity(p_resource_id uuid, p_delta double precision)
RETURNS double precision LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.resource
     SET quantity = GREATEST(0, COALESCE(quantity, 0) + p_delta), updated_at = now()
   WHERE id = p_resource_id
  RETURNING quantity;
$$;
REVOKE ALL ON FUNCTION public.adjust_resource_quantity(uuid, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_resource_quantity(uuid, double precision) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_resource_quantity(uuid, double precision) TO service_role;

CREATE OR REPLACE FUNCTION public.get_volunteer_from_auth()
RETURNS TABLE (id uuid, name text, mobile_no text, type text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.name, v.mobile_no, v.type, v.status FROM public.volunteer v WHERE v.auth_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_volunteer_from_auth() TO authenticated;

-- Great-circle distance in km (used by the AI assistant's SQL and reports).
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (same as migrations/016_per_user_rls.sql)
--   operators (email accounts) read everything; volunteers (phone accounts) read
--   only their own data; anon reads nothing but the skill taxonomy. All writes go
--   through the API with the service role key.
-- -----------------------------------------------------------------------------

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

-- Mirrors isDmaUser() in the app: an email account with the server-granted
-- app_metadata.role = 'dma_operator' (only the service key can set it; see
-- `bun run db:operator`), not linked to a volunteer. Sign-ups stay open for
-- volunteers' phone logins, so an email sign-up alone must not be enough.
CREATE OR REPLACE FUNCTION public.is_dma_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'email', '') <> ''
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'dma_operator'
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

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['victim_report', 'assignment', 'volunteer', 'message', 'task_force', 'task_force_member', 'resource', 'resource_allocation']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_volunteer_status_active ON public.volunteer (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_volunteer_name_lower ON public.volunteer (lower(name));
CREATE INDEX IF NOT EXISTS idx_volunteer_location ON public.volunteer (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volunteer_auth_id ON public.volunteer (auth_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_skills_skill ON public.volunteer_skills (skill_id, volunteer_id);
CREATE INDEX IF NOT EXISTS idx_assignment_status ON public.assignment (status);
CREATE INDEX IF NOT EXISTS idx_assignment_volunteer ON public.assignment (assigned_to_volunteer) WHERE assigned_to_volunteer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_taskforce ON public.assignment (assigned_to_taskforce) WHERE assigned_to_taskforce IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_victim_report ON public.assignment (victim_report_id) WHERE victim_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_created ON public.assignment (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taskforce_member_volunteer ON public.task_force_member (volunteer_id);
CREATE INDEX IF NOT EXISTS idx_victim_report_created ON public.victim_report (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_victim_report_phone ON public.victim_report (phone_no);
CREATE INDEX IF NOT EXISTS idx_victim_report_open_urgency ON public.victim_report (urgency) WHERE status NOT IN ('resolved', 'duplicate');
CREATE INDEX IF NOT EXISTS idx_message_taskforce ON public.message (task_force_id) WHERE task_force_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_victim ON public.message (victim_report_id) WHERE victim_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_receiver ON public.message (receiver_id) WHERE receiver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_sender ON public.message (sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_direct ON public.message (created_at DESC) WHERE task_force_id IS NULL AND victim_report_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_created ON public.message (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_assignment ON public.message (assignment_id, created_at DESC) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volunteer_created ON public.volunteer (created_at DESC) WHERE created_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_allocation_resource ON public.resource_allocation (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocation_volunteer ON public.resource_allocation (volunteer_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocation_task_force ON public.resource_allocation (task_force_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocation_assignment ON public.resource_allocation (assignment_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocation_status ON public.resource_allocation (status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_by ON public.chat_sessions (created_by);

-- -----------------------------------------------------------------------------
-- Rate limiting (server only; see migrations/018_rate_limits.sql)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limit (
  key text PRIMARY KEY,                   -- SHA-256 hash; no raw IPs or phone numbers
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit (window_start);

CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit AS r (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE r.count + 1
    END,
    window_start = CASE
      WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE r.window_start
    END
  RETURNING count INTO v_count;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;
