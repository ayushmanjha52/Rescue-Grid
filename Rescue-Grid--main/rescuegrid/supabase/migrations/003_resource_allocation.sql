-- Resource Allocation Tracking - Phase 9
-- Tracks who received what resources

CREATE TABLE resource_allocation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resource(id),
  
  -- Who received it (one of these must be set, rest null)
  assignment_id uuid REFERENCES assignment(id),
  task_force_id uuid REFERENCES task_force(id),
  volunteer_id uuid REFERENCES volunteer(id),
  
  -- Allocation details
  quantity_allocated float NOT NULL,
  quantity_consumed float DEFAULT 0,
  quantity_returned float DEFAULT 0,
  
  -- Status tracking
  status text DEFAULT 'allocated',
  
  -- Metadata
  notes text,
  allocated_by uuid,
  allocated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE resource_allocation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DMA can manage all allocations" ON resource_allocation
  FOR ALL USING (true);

CREATE POLICY "Volunteers can view their allocations" ON resource_allocation
  FOR SELECT USING (
    volunteer_id = (SELECT id FROM volunteer WHERE auth.uid() = volunteer.id)
    OR task_force_id IN (
      SELECT task_force_id FROM task_force_member 
      WHERE volunteer_id = (SELECT id FROM volunteer WHERE auth.uid() = volunteer.id)
    )
  );

CREATE POLICY "Volunteers can update their allocations" ON resource_allocation
  FOR UPDATE USING (
    volunteer_id = (SELECT id FROM volunteer WHERE auth.uid() = volunteer.id)
    OR task_force_id IN (
      SELECT task_force_id FROM task_force_member 
      WHERE volunteer_id = (SELECT id FROM volunteer WHERE auth.uid() = volunteer.id)
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE resource_allocation;

CREATE INDEX idx_resource_allocation_resource ON resource_allocation(resource_id);
CREATE INDEX idx_resource_allocation_assignment ON resource_allocation(assignment_id);
CREATE INDEX idx_resource_allocation_task_force ON resource_allocation(task_force_id);
CREATE INDEX idx_resource_allocation_volunteer ON resource_allocation(volunteer_id);
