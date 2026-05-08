-- Add resource_location_id to volunteer table for tracking current resource allocation
-- Phase 10

ALTER TABLE volunteer ADD COLUMN IF NOT EXISTS resource_location_id uuid REFERENCES resource_allocation(id);

CREATE INDEX IF NOT EXISTS idx_volunteer_resource_location ON volunteer(resource_location_id);
