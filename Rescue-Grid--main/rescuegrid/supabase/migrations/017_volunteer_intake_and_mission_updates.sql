-- =============================================================================
-- 017 — Spontaneous volunteers and mission updates
--
--   * volunteer.created_at  — when someone joined, so Command can spot and brief
--                             new volunteers. Rows that existed before this
--                             migration keep NULL ("joined before tracking").
--   * message.assignment_id — links a message to the mission it is about, so
--                             every status change / field update forms a
--                             timeline on that mission.
--
-- Run after 016. Safe to re-run.
-- =============================================================================

ALTER TABLE public.volunteer ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.volunteer ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.message ADD COLUMN IF NOT EXISTS assignment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_assignment_id_fkey') THEN
    ALTER TABLE public.message
      ADD CONSTRAINT message_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignment(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volunteer_created ON public.volunteer (created_at DESC) WHERE created_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_assignment ON public.message (assignment_id, created_at DESC) WHERE assignment_id IS NOT NULL;
