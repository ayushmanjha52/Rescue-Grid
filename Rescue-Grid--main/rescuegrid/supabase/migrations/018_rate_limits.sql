-- =============================================================================
-- 018 — Rate limiting for public endpoints
--
-- Fixed-window counters used by the API (lib/rateLimit.ts) to slow down abuse
-- of public endpoints: victim reports and messages, "My Reports" lookups and
-- SMS login codes (each code is a paid SMS). Keys are SHA-256 hashes, so no
-- IP addresses or phone numbers are stored.
--
-- Only the service role (the Next.js server) can use this: RLS is on with no
-- policies, and the function is not executable by anon/authenticated users.
--
-- Run after 017. Safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit (window_start);

-- Counts one hit against `p_key` and returns true while the caller is within
-- `p_limit` hits per `p_window_seconds`.
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

  -- Occasionally clear out stale windows so the table stays small.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;
