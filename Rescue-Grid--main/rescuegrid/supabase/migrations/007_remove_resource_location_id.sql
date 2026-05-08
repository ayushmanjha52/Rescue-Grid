-- Remove resource_location_id column - now using array of allocations instead
-- Phase 10.2

ALTER TABLE volunteer DROP COLUMN IF EXISTS resource_location_id;

DROP INDEX IF EXISTS idx_volunteer_resource_location;
