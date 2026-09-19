import fs from "fs";
import { SANQALP_AGENDA } from "../artifacts/api-server/src/lib/sanqualp-agenda";

const agendaJson = JSON.stringify(SANQALP_AGENDA).replace(/'/g, "''");
const pricingTiersJson = JSON.stringify([
  {
    id: "internal_staff",
    name: "Internal Staff Delegate",
    role: "delegate",
    price: 0,
    earlyBirdPrice: 0,
    description: "Official internal delegation pass for nominated Sankara Eye Hospital staff.",
    inclusions: [
      "All TQM Scientific Tracks & Workshops",
      "Conclave Delegate Kit",
      "Hospitality & Dining (All 2 Days)"
    ],
    popular: true
  }
]).replace(/'/g, "''");

const sqlContent = `-- ==============================================================================
-- SANKARA EVENTS PLATFORM - DIRECT PRODUCTION DATABASE SYNCHRONIZATION
-- Run this directly in PostgreSQL to instantly configure:
--   1. VISION 2020 as Concluded Flagship Conference (Past Event)
--   2. 12th SanQALP Conclave as Active Conclave (Upcoming Event with 30-session Agenda)
-- ==============================================================================

BEGIN;

-- 1. Ensure required columns exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_completed boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_visitor_count integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_gallery_json text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_summary text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_description text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_ending_notes text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS agenda_json text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS pricing_tiers_json text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS spoc_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS spoc_designation text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS spoc_phone text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS spoc_email text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_photos_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_photos_button_text text;

-- 2. Remove legacy / dummy events (leaving only Vision 2020 and SanQALP)
DELETE FROM events WHERE slug NOT IN ('vision-2020-annual-conference', 'sanqualp-bangalore');

-- 3. Upsert VISION 2020 as Concluded Flagship Conference (Past Event)
INSERT INTO events (
  slug, title, event_type, description, short_description, venue, city,
  start_date, end_date, time_from, time_to, is_paid, registration_fee, currency,
  requires_approval, registration_open, max_capacity, enable_attendance,
  attendance_days_count, enable_food, enable_goodies, enable_google_wallet,
  organizer_name, organizer_email, organizer_phone, theme_color, accent_color,
  badge_subtitle, badge_footer_text, status, post_event_completed,
  post_event_visitor_count, external_photos_url, external_photos_button_text
) VALUES (
  'vision-2020-annual-conference',
  '20th Annual National Conference — VISION 2020: The Right to Sight India',
  'conference',
  'The 20th Annual National Conference of VISION 2020: The Right to Sight India, hosted at Sankara Eye Hospital, Coimbatore. Bringing together over 1,500 ophthalmologists, optometrists, healthcare leaders, and policy makers from across India and South Asia.',
  '20th Annual National Conference — VISION 2020: The Right to Sight India (10–12 July 2026, Coimbatore).',
  'Sankara Eye Hospital, Auditorium Complex',
  'Coimbatore',
  '2026-07-10',
  '2026-07-12',
  '08:30 AM',
  '06:00 PM',
  false,
  0,
  'INR',
  false,
  false,
  1500,
  true,
  3,
  true,
  true,
  true,
  'Vision 2020 Secretariat / Sankara Eye Care Institutions',
  'conference@vision2020india.org',
  '+91 422 4236789',
  '#0F6E56',
  '#FAC775',
  'DELEGATE PASS',
  'Vision 2020 National Conference',
  'completed',
  true,
  1580,
  'https://app.samaro.ai/e/sankara-events',
  'Find My Photos with AI (Samaro)'
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  start_date = '2026-07-10',
  end_date = '2026-07-12',
  status = 'completed',
  post_event_completed = true,
  post_event_visitor_count = COALESCE(events.post_event_visitor_count, 1580),
  external_photos_url = 'https://app.samaro.ai/e/sankara-events',
  external_photos_button_text = 'Find My Photos with AI (Samaro)';

-- 4. Upsert 12th SanQALP Conclave as Active / Upcoming Conclave (with full 30-session agenda)
INSERT INTO events (
  slug, title, event_type, description, short_description, venue, city,
  location_map_url, start_date, end_date, time_from, time_to, is_paid, registration_fee,
  currency, requires_approval, registration_open, max_capacity, enable_attendance,
  attendance_days_count, enable_food, enable_goodies, enable_google_wallet,
  organizer_name, organizer_email, organizer_phone, spoc_name, spoc_designation,
  spoc_email, spoc_phone, cancellation_policy, theme_color, accent_color,
  badge_subtitle, badge_footer_text, agenda_json, pricing_tiers_json, status,
  post_event_completed, external_photos_url, external_photos_button_text
) VALUES (
  'sanqualp-bangalore',
  '12th SanQALP Conclave',
  'internal_staff',
  'The 12th SanQALP Conclave brings together clinical leaders, quality champions, hospital administrators, and operational teams across all Sankara Eye Hospital units nationwide. Focused on embedding Total Quality Management (TQM) principles into everyday healthcare delivery, the conclave explores policy management, daily work management (DWM), clinical safety protocols, patient value streams, and sustainable healthcare operations.',
  '12th SanQALP Conclave on 21st & 22nd September 2026 at Shri Shankara Vijayendram Auditorium (3rd floor), Sankara Eye Hospital, Bangalore. Theme: From Vision to Value (TQM). Internal staff delegation.',
  'Shri Shankara Vijayendram Auditorium (3rd floor), Sankara Eye Hospital',
  'Bangalore',
  'https://maps.google.com/?q=Sankara+Eye+Hospital+Varthur+Main+Road+Kundalahalli+Bangalore',
  '2026-09-21',
  '2026-09-22',
  '09:00 AM',
  '07:00 PM',
  false,
  0,
  'INR',
  true,
  false,
  350,
  true,
  2,
  true,
  false,
  false,
  'Sankara Eye Care Institutions (SEFI)',
  'quality@sankaraeye.in',
  '+91 80 2854 2727',
  'Dr Geeta',
  'DGM - Quality Assurance',
  'quality@sankaraeye.in',
  '+91 99169 73590',
  'Internal staff conclave. Participation is by institutional delegation and nomination across Sankara Eye Hospital units.',
  '#0F172A',
  '#3B82F6',
  '12TH SANQALP CONCLAVE · BANGALORE',
  'Sankara Quality Assurance Learning Program · Internal Staff',
  '${agendaJson}',
  '${pricingTiersJson}',
  'published',
  false,
  NULL,
  NULL
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  event_type = 'internal_staff',
  start_date = '2026-09-21',
  end_date = '2026-09-22',
  venue = EXCLUDED.venue,
  city = EXCLUDED.city,
  registration_open = false,
  requires_approval = true,
  status = 'published',
  post_event_completed = false,
  agenda_json = '${agendaJson}',
  pricing_tiers_json = '${pricingTiersJson}',
  spoc_name = EXCLUDED.spoc_name,
  spoc_designation = EXCLUDED.spoc_designation,
  spoc_email = EXCLUDED.spoc_email,
  spoc_phone = EXCLUDED.spoc_phone,
  external_photos_url = NULL,
  external_photos_button_text = NULL;

COMMIT;
`;

fs.writeFileSync("update_production_events.sql", sqlContent);
console.log("SUCCESS: update_production_events.sql generated successfully!");
