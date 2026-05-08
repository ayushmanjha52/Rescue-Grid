-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assignment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task text NOT NULL,
  location_label text,
  latitude double precision,
  longitude double precision,
  urgency text DEFAULT 'moderate'::text,
  status text DEFAULT 'open'::text,
  assigned_to_volunteer uuid,
  assigned_to_taskforce uuid,
  victim_report_id uuid,
  timer timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignment_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_assigned_to_volunteer_fkey FOREIGN KEY (assigned_to_volunteer) REFERENCES public.volunteer(id),
  CONSTRAINT assignment_assigned_to_taskforce_fkey FOREIGN KEY (assigned_to_taskforce) REFERENCES public.task_force(id),
  CONSTRAINT assignment_victim_report_id_fkey FOREIGN KEY (victim_report_id) REFERENCES public.victim_report(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id)
);
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text DEFAULT 'New Disaster Briefing'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.message (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sender_type text NOT NULL,
  sender_id uuid,
  task_force_id uuid,
  victim_report_id uuid,
  receiver_id uuid,
  is_flagged_for_dma boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT message_pkey PRIMARY KEY (id),
  CONSTRAINT message_task_force_id_fkey FOREIGN KEY (task_force_id) REFERENCES public.task_force(id),
  CONSTRAINT message_victim_report_id_fkey FOREIGN KEY (victim_report_id) REFERENCES public.victim_report(id)
);
CREATE TABLE public.resource (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  quantity double precision DEFAULT 0,
  low_stock_threshold double precision DEFAULT 0,
  unit text,
  owner_info text,
  location text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT resource_pkey PRIMARY KEY (id)
);
CREATE TABLE public.resource_allocation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL,
  assignment_id uuid,
  task_force_id uuid,
  volunteer_id uuid,
  quantity_allocated double precision NOT NULL,
  quantity_consumed double precision DEFAULT 0,
  quantity_returned double precision DEFAULT 0,
  status text DEFAULT 'allocated'::text,
  notes text,
  allocated_by uuid,
  allocated_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT resource_allocation_pkey PRIMARY KEY (id),
  CONSTRAINT resource_allocation_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id),
  CONSTRAINT resource_allocation_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignment(id),
  CONSTRAINT resource_allocation_task_force_id_fkey FOREIGN KEY (task_force_id) REFERENCES public.task_force(id),
  CONSTRAINT resource_allocation_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.volunteer(id)
);
CREATE TABLE public.skill_categories (
  id integer NOT NULL DEFAULT nextval('skill_categories_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  CONSTRAINT skill_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.skill_definitions (
  id integer NOT NULL DEFAULT nextval('skill_definitions_id_seq'::regclass),
  category_id integer NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  CONSTRAINT skill_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT skill_definitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.skill_categories(id)
);
CREATE TABLE public.task_force (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dma_id text,
  status text DEFAULT 'active'::text,
  assignment_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_force_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tf_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignment(id)
);
CREATE TABLE public.task_force_member (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_force_id uuid NOT NULL,
  volunteer_id uuid NOT NULL,
  member_type text,
  role text,
  CONSTRAINT task_force_member_pkey PRIMARY KEY (id),
  CONSTRAINT task_force_member_task_force_id_fkey FOREIGN KEY (task_force_id) REFERENCES public.task_force(id),
  CONSTRAINT task_force_member_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.volunteer(id)
);
CREATE TABLE public.victim_report (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_no text NOT NULL,
  latitude double precision,
  longitude double precision,
  city text,
  district text,
  situation text NOT NULL,
  custom_message text,
  urgency text DEFAULT 'moderate'::text,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  accuracy double precision,
  CONSTRAINT victim_report_pkey PRIMARY KEY (id)
);
CREATE TABLE public.volunteer (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile_no text NOT NULL UNIQUE,
  type text,
  latitude double precision,
  longitude double precision,
  skills text,
  equipment text,
  status text DEFAULT 'active'::text,
  push_token text,
  last_seen timestamp with time zone,
  auth_id uuid UNIQUE,
  accuracy double precision,
  tier smallint NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 4),
  CONSTRAINT volunteer_pkey PRIMARY KEY (id)
);
CREATE TABLE public.volunteer_skills (
  volunteer_id uuid NOT NULL,
  skill_id integer NOT NULL,
  CONSTRAINT volunteer_skills_pkey PRIMARY KEY (volunteer_id, skill_id),
  CONSTRAINT volunteer_skills_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.volunteer(id),
  CONSTRAINT volunteer_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skill_definitions(id)
);