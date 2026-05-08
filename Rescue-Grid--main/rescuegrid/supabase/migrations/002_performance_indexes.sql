-- Performance indexes for volunteer search and filtering
-- Run this migration to improve search performance at scale

-- Enable pg_trgm extension for fuzzy text search (run once per database)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for status filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_volunteer_status_active ON public.volunteer (status) WHERE status = 'active';

-- Index for name text search (B-tree, works without pg_trgm)
CREATE INDEX IF NOT EXISTS idx_volunteer_name_lower ON public.volunteer (lower(name));

-- Composite index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_volunteer_location ON public.volunteer (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for assignment lookups
CREATE INDEX IF NOT EXISTS idx_assignment_status ON public.assignment (status) WHERE status IN ('open', 'active');

-- Index for task_force_member lookups
CREATE INDEX IF NOT EXISTS idx_taskforce_member_volunteer ON public.task_force_member (volunteer_id);
CREATE INDEX IF NOT EXISTS idx_taskforce_member_taskforce ON public.task_force_member (task_force_id);

-- Index for message filtering
CREATE INDEX IF NOT EXISTS idx_message_taskforce ON public.message (task_force_id) WHERE task_force_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_victim ON public.message (victim_report_id) WHERE victim_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_created ON public.message (created_at DESC);

-- Function to calculate distance between two lat/lng points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 double precision,
    lon1 double precision,
    lat2 double precision,
    lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    R double precision := 6371; -- Earth radius in kilometers
    dlat double precision;
    dlon double precision;
    a double precision;
    c double precision;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$;

-- Comment on function
COMMENT ON FUNCTION public.calculate_distance IS 'Calculates the great-circle distance between two points on Earth using the Haversine formula. Returns distance in kilometers.';
