-- Volunteer Auth with Supabase Phone OTP - Phase 10
-- Links volunteer records to Supabase Auth users

-- 1. Add auth_id column to volunteer table to link with auth.users
ALTER TABLE volunteer ADD COLUMN auth_id uuid UNIQUE;

-- 2. Create index for faster lookups
CREATE INDEX idx_volunteer_auth_id ON volunteer(auth_id);

-- 3. Update RLS policy to allow volunteers to read their own auth_id
-- (The update policy for session management will be handled in middleware)

-- 4. Create function to get volunteer from auth.uid()
CREATE OR REPLACE FUNCTION get_volunteer_from_auth()
RETURNS TABLE (
  id uuid,
  name text,
  mobile_no text,
  type text,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.name, v.mobile_no, v.type, v.status
  FROM volunteer v
  WHERE v.auth_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_volunteer_from_auth() TO authenticated;

-- 6. Add updated_at trigger for resource_allocation
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_resource_allocation_updated_at
  BEFORE UPDATE ON resource_allocation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
