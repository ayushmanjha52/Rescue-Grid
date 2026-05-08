-- Phase 1: Volunteer Skills Normalized Schema
-- SAFE: additive only, nothing dropped

-- 1. Skill taxonomy
CREATE TABLE IF NOT EXISTS skill_categories (
  id   SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_definitions (
  id          SERIAL PRIMARY KEY,
  category_id INT  NOT NULL REFERENCES skill_categories(id),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL
);

-- Seed data
INSERT INTO skill_categories (code, name) VALUES
  ('MEDICAL',       'Medical'),
  ('RESCUE',        'Search & Rescue'),
  ('LOGISTICS',     'Logistics'),
  ('COMMUNICATION', 'Communication'),
  ('SPECIAL',       'Special Skills')
ON CONFLICT (code) DO NOTHING;

INSERT INTO skill_definitions (category_id, code, name) VALUES
  (1, 'first_aid',        'First Aid'),
  (1, 'paramedic',        'Paramedic'),
  (1, 'doctor',           'Doctor'),
  (1, 'nurse',            'Nurse'),
  (2, 'swimmer',          'Open Water Swimmer'),
  (2, 'rope_rescue',      'Rope Rescue'),
  (2, 'structural_search', 'Structural Search'),
  (3, 'driver',           'Driver (LMV)'),
  (3, 'heavy_vehicle',    'Heavy Vehicle'),
  (3, 'drone_operator',   'Drone Operator'),
  (4, 'ham_radio',        'Ham Radio'),
  (4, 'translator',      'Translator'),
  (5, 'psychologist',     'Psychologist'),
  (5, 'civil_engineer',   'Civil Engineer'),
  (5, 'firefighter',      'Firefighter')
ON CONFLICT (code) DO NOTHING;

-- 2. Junction table: one row per volunteer per skill
CREATE TABLE IF NOT EXISTS volunteer_skills (
  volunteer_id UUID NOT NULL REFERENCES volunteer(id) ON DELETE CASCADE,
  skill_id     INT  NOT NULL REFERENCES skill_definitions(id),
  PRIMARY KEY (volunteer_id, skill_id)
);

-- 3. Global tier on volunteers (1=untrained, 2=basic, 3=certified, 4=expert)
ALTER TABLE volunteer ADD COLUMN IF NOT EXISTS tier SMALLINT NOT NULL DEFAULT 1
  CHECK (tier BETWEEN 1 AND 4);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_volunteers_geo_status
  ON volunteer (latitude, longitude, status)
  INCLUDE (id, name, tier, mobile_no);

CREATE INDEX IF NOT EXISTS idx_volunteer_skills_skill
  ON volunteer_skills (skill_id, volunteer_id);

-- 5. DB-level scoring function
CREATE OR REPLACE FUNCTION calculate_volunteer_score(
  v_lat          FLOAT,
  v_lng          FLOAT,
  v_tier         SMALLINT,
  v_status       TEXT,
  v_last_seen    TIMESTAMPTZ,
  center_lat     FLOAT,
  center_lng     FLOAT,
  max_radius_km  FLOAT,
  required_skill_ids INT[]
) RETURNS FLOAT AS $$
DECLARE
  dist_km        FLOAT;
  proximity_score FLOAT;
  avail_score    FLOAT;
  skill_score    FLOAT;
BEGIN
  dist_km := 6371 * 2 * ASIN(
    SQRT(
      POWER(SIN(RADIANS(v_lat - center_lat) / 2), 2) +
      COS(RADIANS(center_lat)) * COS(RADIANS(v_lat)) *
      POWER(SIN(RADIANS(v_lng - center_lng) / 2), 2)
    )
  );

  IF dist_km > max_radius_km THEN RETURN 0; END IF;

  proximity_score := 1.0 - (dist_km / max_radius_km);

  avail_score := CASE
    WHEN v_status != 'active'                              THEN 0.0
    WHEN v_last_seen > NOW() - INTERVAL '15 minutes'      THEN 1.0
    WHEN v_last_seen > NOW() - INTERVAL '1 hour'           THEN 0.7
    WHEN v_last_seen > NOW() - INTERVAL '6 hours'          THEN 0.4
    ELSE 0.1
  END;

  skill_score := COALESCE(v_tier::FLOAT / 4.0, 0.25);

  RETURN ROUND(
    (0.40 * skill_score + 0.35 * proximity_score + 0.25 * avail_score)::NUMERIC, 4
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Helper for map endpoint
CREATE OR REPLACE FUNCTION get_top_scored_volunteers(
  center_lat FLOAT,
  center_lng FLOAT,
  min_lat FLOAT,
  max_lat FLOAT,
  min_lng FLOAT,
  max_lng FLOAT,
  max_results INT DEFAULT 50
) RETURNS TABLE (
  id UUID,
  name TEXT,
  latitude FLOAT,
  longitude FLOAT,
  tier SMALLINT,
  status TEXT,
  skills TEXT[],
  score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.latitude,
    v.longitude,
    v.tier,
    v.status,
    ARRAY_AGG(sd.code) FILTER (WHERE sd.code IS NOT NULL) AS skills,
    calculate_volunteer_score(
      v.latitude, v.longitude, v.tier, v.status, v.last_seen,
      center_lat, center_lng, 100, NULL
    ) AS score
  FROM volunteer v
  LEFT JOIN volunteer_skills vs ON vs.volunteer_id = v.id
  LEFT JOIN skill_definitions sd ON sd.id = vs.skill_id
  WHERE
    v.status = 'active'
    AND v.latitude  BETWEEN min_lat AND max_lat
    AND v.longitude BETWEEN min_lng AND max_lng
  GROUP BY v.id, v.name, v.latitude, v.longitude, v.tier, v.status, v.last_seen
  HAVING calculate_volunteer_score(
    v.latitude, v.longitude, v.tier, v.status, v.last_seen,
    center_lat, center_lng, 100, NULL
  ) > 0
  ORDER BY score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Helper for skill gaps endpoint
CREATE OR REPLACE FUNCTION get_skill_coverage_by_ring(
  center_lat FLOAT,
  center_lng FLOAT,
  ring_min_km FLOAT,
  ring_max_km FLOAT
) RETURNS TABLE (
  category TEXT,
  volunteer_count BIGINT,
  max_tier SMALLINT,
  avg_tier FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.code AS category,
    COUNT(DISTINCT v.id) AS volunteer_count,
    MAX(v.tier) AS max_tier,
    AVG(v.tier)::FLOAT AS avg_tier
  FROM volunteer v
  JOIN volunteer_skills vs ON vs.volunteer_id = v.id
  JOIN skill_definitions sd ON sd.id = vs.skill_id
  JOIN skill_categories sc ON sc.id = sd.category_id
  WHERE v.status = 'active'
    AND (6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v.latitude - center_lat) / 2), 2) +
      COS(RADIANS(center_lat)) * COS(RADIANS(v.latitude)) *
      POWER(SIN(RADIANS(v.longitude - center_lng) / 2), 2)
    ))) BETWEEN ring_min_km AND ring_max_km
  GROUP BY sc.code
  ORDER BY sc.code;
END;
$$ LANGUAGE plpgsql STABLE;
