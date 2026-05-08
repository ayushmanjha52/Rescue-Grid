-- Add updated_at column to victim_report for audit trail consistency
-- This tracks when DMA manually updates report status

ALTER TABLE victim_report 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Set default value for existing rows
UPDATE victim_report 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add trigger to auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_victim_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS victim_report_updated_at_trigger ON victim_report;

CREATE TRIGGER victim_report_updated_at_trigger
  BEFORE UPDATE ON victim_report
  FOR EACH ROW
  EXECUTE FUNCTION update_victim_report_updated_at();
