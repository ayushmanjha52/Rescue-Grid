-- Fix RLS Policies for Real-time Synchronization
-- This migration ensures that DMA (authenticated) and Volunteers (anon in V1)
-- can actually receive real-time updates for the tables they need to see.

-- 1. Allow DMA (authenticated users) to see ALL victim reports, volunteers, and assignments
-- Currently, 002_rls_policies.sql only allows volunteers to see their own row.
-- We add these policies to ensure the DMA Dashboard stays updated in real-time.

CREATE POLICY "dma_select_all_victim_reports" ON victim_report
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dma_select_all_volunteers" ON volunteer
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dma_select_all_assignments" ON assignment
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dma_select_all_messages" ON message
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dma_select_all_task_forces" ON task_force
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dma_select_all_task_force_members" ON task_force_member
  FOR SELECT TO authenticated
  USING (true);

-- 2. Allow Volunteers (anon in V1) to see assignments and messages
-- Since the volunteer app currently uses cookie auth and not Supabase Auth,
-- the client-side supabase instance is 'anon'. We need these to enable real-time.
-- NOTE: In a production app (V2), volunteers should use Supabase Auth to restrict this.

-- Drop existing restricted policies if they conflict with our new needs
-- (Actually, we just add new ones for 'anon' role)

CREATE POLICY "anon_select_all_assignments" ON assignment
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_select_all_messages" ON message
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_select_all_volunteers" ON volunteer
  FOR SELECT TO anon
  USING (true);

-- 3. Ensure REPLICA IDENTITY is set correctly (Double check)
-- This was done in 008, but we ensure it here too for the tables we just updated.
ALTER TABLE victim_report REPLICA IDENTITY FULL;
ALTER TABLE assignment REPLICA IDENTITY FULL;
ALTER TABLE volunteer REPLICA IDENTITY FULL;
ALTER TABLE message REPLICA IDENTITY FULL;
ALTER TABLE task_force REPLICA IDENTITY FULL;
ALTER TABLE task_force_member REPLICA IDENTITY FULL;
