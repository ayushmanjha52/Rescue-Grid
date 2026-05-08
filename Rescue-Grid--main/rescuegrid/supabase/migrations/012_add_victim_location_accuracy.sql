-- Add accuracy column to victim_report table to track location precision
ALTER TABLE public.victim_report ADD COLUMN IF NOT EXISTS accuracy double precision;

COMMENT ON COLUMN public.victim_report.accuracy IS 'Location accuracy in meters from GPS (lower is better). Null if unknown.';
