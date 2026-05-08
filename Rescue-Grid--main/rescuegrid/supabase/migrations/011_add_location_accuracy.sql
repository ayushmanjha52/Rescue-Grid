-- Add accuracy column to volunteer table to track location precision
ALTER TABLE public.volunteer ADD COLUMN IF NOT EXISTS accuracy double precision;

-- Add comment explaining the column
COMMENT ON COLUMN public.volunteer.accuracy IS 'Location accuracy in meters from GPS (lower is better). Null if unknown.';
