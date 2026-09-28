-- =============================================================================
-- 019 — DMA operators need a server-granted role
--
-- Before: any signed-in account with an email counted as an operator. Sign-ups
-- have to stay open for volunteers' phone logins, so anyone could register an
-- email account and read all operational data.
--
-- After: an operator must have app_metadata.role = 'dma_operator'. Only the
-- service key can set app_metadata (`bun run db:operator -- you@org.in`), so
-- users can't grant it to themselves. Same rule as lib/auth/dmaAccess.ts.
--
-- Grant the role to your operators BEFORE running this, or they lose access
-- until they have it. Run after 018. Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_dma_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'email', '') <> ''
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'dma_operator'
     AND NOT EXISTS (SELECT 1 FROM public.volunteer WHERE auth_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_dma_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dma_operator() TO authenticated, service_role;
