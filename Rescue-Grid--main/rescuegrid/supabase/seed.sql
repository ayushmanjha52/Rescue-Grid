-- RescueGrid Seed Data
-- Updated with Dhanbad area locations (Jharkhand)
-- Phase 1.4 — Run after 001_initial_schema.sql

-- Volunteers (4) with location coordinates near Dhanbad
INSERT INTO volunteer (id, name, mobile_no, type, status, skills, equipment, latitude, longitude, last_seen) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Rajesh Kumar', '+919876543210', 'individual', 'active', 'First Aid,Search and Rescue', 'Flashlight,Rope', 23.7950, 86.4300, now()),
  ('a2222222-2222-2222-2222-222222222222', 'Station House Officer', '+919876543211', 'Police', 'on-mission', 'Law Enforcement,Traffic Control', 'Vehicle,Radio', 23.6720, 86.1510, now()),
  ('a3333333-3333-3333-3333-333333333333', 'Amit Sharma', '+919876543212', 'NGO', 'active', 'Medical,Food Distribution', 'Medical Kit,Vehicle', 23.8740, 86.4700, now()),
  ('a4444444-4444-4444-4444-444444444444', 'NDRF Team Alpha', '+919876543213', 'NDRF', 'standby', 'Heavy Rescue,Flood Response', 'Boat,JCB,Hydraulic Tools', 23.6300, 85.5100, now());

-- Task Forces (2) - assignment_id set after assignments are created
INSERT INTO task_force (id, name, dma_id, status) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Alpha Rescue', 'DMA-JH-001', 'active'),
  ('b2222222-2222-2222-2222-222222222222', 'Bravo Medical', 'DMA-JH-001', 'active');

-- Task Force Members
INSERT INTO task_force_member (task_force_id, volunteer_id, member_type, role) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'leader', 'Team Lead'),
  ('b1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 'member', 'Rescue Specialist'),
  ('b2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'leader', 'Medical Lead'),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'member', 'Security');

-- Victim Reports (5) - All near Dhanbad, Jharkhand
INSERT INTO victim_report (id, phone_no, latitude, longitude, city, district, situation, custom_message, urgency, status) VALUES
  ('c1111111-1111-1111-1111-111111111111', '+919988776655', 23.8020, 86.4150, 'Dhanbad', 'Dhanbad', 'rescue', 'Family trapped in flooded basement, water rising fast', 'critical', 'open'),
  ('c2222222-2222-2222-2222-222222222222', '+919988776656', 23.8750, 86.4850, 'Sindri', 'Dhanbad', 'food', '5 families without food for 3 days after mine collapse', 'urgent', 'open'),
  ('c3333333-3333-3333-3333-333333333333', '+919988776657', 23.7450, 86.3800, 'Jharia', 'Dhanbad', 'medical', 'Elderly woman needs insulin, coal mine dust causing breathing issues', 'moderate', 'open'),
  ('c4444444-4444-4444-4444-444444444444', '+919988776658', 23.6700, 86.1600, 'Bokaro Steel City', ' Bokaro', 'shelter', '100 people displaced after building collapse near factory', 'urgent', 'open'),
  ('c5555555-5555-5555-5555-555555555555', '+919988776659', 23.6350, 85.5200, 'Ramgarh', 'Ramgarh', 'water', 'Contaminated water supply in locality near coal mine drainage', 'open', 'open');

-- Assignments (3) - 1 to volunteer, 1 to TF, 1 unassigned
INSERT INTO assignment (id, task, location_label, latitude, longitude, urgency, status, assigned_to_volunteer, assigned_to_taskforce, victim_report_id) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Rescue family from flooded basement, evacuation to relief camp', 'Dhanbad Sector 5, Near Coal Mine Road', 23.8020, 86.4150, 'critical', 'active', 'a1111111-1111-1111-1111-111111111111', NULL, 'c1111111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222', 'Distribute food packets and relief supplies to affected families', 'Sindri Relief Camp, Near Industrial Area', 23.8750, 86.4850, 'urgent', 'active', NULL, 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222'),
  ('d3333333-3333-3333-3333-333333333333', 'Medical checkup camp and distribute masks near Jharia coal mines', 'Jharia Main Road, Near Railway Station', 23.7450, 86.3800, 'moderate', 'open', NULL, NULL, 'c3333333-3333-3333-3333-333333333333');

-- Update task forces with assignment references
UPDATE task_force SET assignment_id = 'd2222222-2222-2222-2222-222222222222' WHERE id = 'b2222222-2222-2222-2222-222222222222';

-- Messages (6) - victim thread, TF room, direct channel
INSERT INTO message (content, sender_type, sender_id, task_force_id, victim_report_id, receiver_id, is_flagged_for_dma) VALUES
  ('Help! Water is entering our house. Two children with us. Please send help immediately!', 'victim', NULL, NULL, 'c1111111-1111-1111-1111-111111111111', NULL, false),
  ('We have dispatched a rescue team. Stay on higher ground. ETA 20 mins. Keep children safe.', 'dma', NULL, NULL, 'c1111111-1111-1111-1111-111111111111', NULL, false),
  ('Team assembling at base. Medical supplies loaded for Sindri relief camp.', 'volunteer', 'a3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', NULL, NULL, false),
  ('All units check in once deployed. Primary focus on structural collapse at Bokaro.', 'dma', NULL, 'b2222222-2222-2222-2222-222222222222', NULL, NULL, false),
  ('Alpha team, be advised: water level rising in Dhanbad low-lying areas near mines.', 'dma', NULL, 'b1111111-1111-1111-1111-111111111111', NULL, NULL, false),
  ('Confirmed. Proceeding to extraction point with rescue equipment.', 'volunteer', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', NULL, NULL, false);

-- Resources (5) - one below threshold, locations near Dhanbad
INSERT INTO resource (name, type, quantity, low_stock_threshold, unit, owner_info, location) VALUES
  ('Food Packets', 'food', 500, 200, 'packets', 'District Relief Store', 'Dhanbad Central Warehouse'),
  ('Water Cans', 'water', 45, 100, 'cans', 'Water Authority Jharkhand', 'Sindri Depot'),
  ('Rescue Boats', 'equipment', 12, 5, 'boats', 'NDRF Dhanbad Station', 'Ramgarh Base Camp'),
  ('Medical Kits', 'medical', 80, 30, 'kits', 'Red Cross Jharkhand Chapter', 'Bokaro Hospital'),
  ('Thermal Blankets', 'shelter', 15, 50, 'blankets', 'NGO Consortium', 'Dhanbad Relief Center');
