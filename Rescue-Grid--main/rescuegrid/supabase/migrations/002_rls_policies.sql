-- RescueGrid Row Level Security Policies
-- Phase 1.3 — Run after 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE victim_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_force ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_force_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE message ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource ENABLE ROW LEVEL SECURITY;

-- VICTIM_REPORT policies
-- anon: INSERT allowed
CREATE POLICY "anon_insert_victim_report" ON victim_report
  FOR INSERT TO anon
  WITH CHECK (true);

-- anon: SELECT by id only (victims check their own report status)
CREATE POLICY "anon_select_victim_report_by_id" ON victim_report
  FOR SELECT TO anon
  USING (true);

-- service_role: full access
CREATE POLICY "service_role_all_victim_report" ON victim_report
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- VOLUNTEER policies
-- authenticated: SELECT own row
CREATE POLICY "volunteer_select_own" ON volunteer
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- authenticated: UPDATE own row
CREATE POLICY "volunteer_update_own" ON volunteer
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- service_role: full access
CREATE POLICY "service_role_all_volunteer" ON volunteer
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ASSIGNMENT policies
-- volunteer: SELECT if assigned to them directly
CREATE POLICY "volunteer_select_assignment_direct" ON assignment
  FOR SELECT TO authenticated
  USING (assigned_to_volunteer = auth.uid());

-- volunteer: SELECT if assigned to their task force
CREATE POLICY "volunteer_select_assignment_taskforce" ON assignment
  FOR SELECT TO authenticated
  USING (
    assigned_to_taskforce IN (
      SELECT task_force_id FROM task_force_member
      WHERE volunteer_id = auth.uid()
    )
  );

-- service_role: full access
CREATE POLICY "service_role_all_assignment" ON assignment
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- TASK_FORCE policies
-- volunteer: SELECT if they are a member
CREATE POLICY "volunteer_select_taskforce" ON task_force
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT task_force_id FROM task_force_member
      WHERE volunteer_id = auth.uid()
    )
  );

-- service_role: full access
CREATE POLICY "service_role_all_task_force" ON task_force
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- TASK_FORCE_MEMBER policies
-- volunteer: SELECT if they are a member
CREATE POLICY "volunteer_select_task_force_member" ON task_force_member
  FOR SELECT TO authenticated
  USING (volunteer_id = auth.uid());

-- service_role: full access
CREATE POLICY "service_role_all_task_force_member" ON task_force_member
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- MESSAGE policies

-- Victim: SELECT messages for their own report thread (no auth needed)
DROP POLICY IF EXISTS "anon_select_message_victim_thread" ON message;
CREATE POLICY "anon_select_message_victim_thread" ON message
  FOR SELECT TO anon
  USING (victim_report_id IS NOT NULL);

-- volunteer: SELECT if in their task force
CREATE POLICY "volunteer_select_message_taskforce" ON message
  FOR SELECT TO authenticated
  USING (
    task_force_id IN (
      SELECT task_force_id FROM task_force_member
      WHERE volunteer_id = auth.uid()
    )
  );

-- volunteer: SELECT if sender or receiver
CREATE POLICY "volunteer_select_message_direct" ON message
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- volunteer: INSERT message to their task force
CREATE POLICY "volunteer_insert_message_taskforce" ON message
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    task_force_id IN (
      SELECT task_force_id FROM task_force_member
      WHERE volunteer_id = auth.uid()
    )
  );

-- volunteer: INSERT direct message
CREATE POLICY "volunteer_insert_message_direct" ON message
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    receiver_id IS NOT NULL
  );

-- service_role: full access
CREATE POLICY "service_role_all_message" ON message
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- RESOURCE policies
-- service_role only — no volunteer or anon access
CREATE POLICY "service_role_all_resource" ON resource
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
