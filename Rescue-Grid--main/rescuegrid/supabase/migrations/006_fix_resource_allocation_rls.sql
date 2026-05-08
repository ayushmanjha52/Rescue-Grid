-- Fix RLS policies for resource_allocation to work with volunteer_session cookie
-- Phase 10.1

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Volunteers can view their allocations" ON resource_allocation;
DROP POLICY IF EXISTS "Volunteers can update their allocations" ON resource_allocation;

-- Create a function to get volunteer_id from cookie (for service_role bypass)
-- Since service_role bypasses RLS, we just need policies for when authenticated

-- Allow authenticated users to view their own allocations
CREATE POLICY "volunteers_view_own_allocations" ON resource_allocation
  FOR SELECT USING (
    volunteer_id IN (
      SELECT id FROM volunteer 
      WHERE auth.uid() IS NOT NULL AND id = auth.uid()
    )
    OR task_force_id IN (
      SELECT task_force_id FROM task_force_member 
      WHERE volunteer_id IN (
        SELECT id FROM volunteer WHERE auth.uid() IS NOT NULL AND id = auth.uid()
      )
    )
  );

-- Allow authenticated users to update their allocations
CREATE POLICY "volunteers_update_own_allocations" ON resource_allocation
  FOR UPDATE USING (
    volunteer_id IN (
      SELECT id FROM volunteer 
      WHERE auth.uid() IS NOT NULL AND id = auth.uid()
    )
    OR task_force_id IN (
      SELECT task_force_id FROM task_force_member 
      WHERE volunteer_id IN (
        SELECT id FROM volunteer WHERE auth.uid() IS NOT NULL AND id = auth.uid()
      )
    )
  );
