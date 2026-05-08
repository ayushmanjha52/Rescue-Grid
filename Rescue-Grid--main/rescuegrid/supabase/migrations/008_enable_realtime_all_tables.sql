-- Enable real-time for all core tables in RescueGrid
-- This ensures that Supabase Realtime can broadcast changes to these tables.

-- Drop publication if it exists (though it usually does in Supabase)
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS victim_report, assignment, volunteer, message, task_force, task_force_member, resource, resource_allocation;

-- Add tables to the supabase_realtime publication
-- We use DO block to avoid errors if some tables are already in the publication
DO $$
BEGIN
  -- Re-add tables to ensures they are included in the publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE victim_report;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignment;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE volunteer;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_force;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_force_member;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE resource;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE resource_allocation;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Set REPLICA IDENTITY FULL for all tables to get full payload in updates
-- This is useful if we need to see what changed or if we need the old values
ALTER TABLE victim_report REPLICA IDENTITY FULL;
ALTER TABLE assignment REPLICA IDENTITY FULL;
ALTER TABLE volunteer REPLICA IDENTITY FULL;
ALTER TABLE message REPLICA IDENTITY FULL;
ALTER TABLE task_force REPLICA IDENTITY FULL;
ALTER TABLE task_force_member REPLICA IDENTITY FULL;
ALTER TABLE resource REPLICA IDENTITY FULL;
ALTER TABLE resource_allocation REPLICA IDENTITY FULL;
