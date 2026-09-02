-- ==============================================================================
-- SANKARA EVENTS & CME PLATFORM - COMPLETE DATABASE INITIALIZATION DDL
-- Database: events
-- ==============================================================================

-- 1. SYSTEM USERS (Staff, Admin, Super Admin)
CREATE TABLE IF NOT EXISTS system_users (
  id serial PRIMARY KEY,
  emp_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  mobile text UNIQUE,
  user_type text NOT NULL,
  password_hash text NOT NULL,
  assigned_track text,
  assigned_event_ids json DEFAULT '[]',
  must_change_password boolean NOT NULL DEFAULT true,
  permissions json DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. EVENTS (CME, Conferences, Symposiums, Live Surgeries)
CREATE TABLE IF NOT EXISTS events (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'conference',
  description text,
  short_description text,
  venue text NOT NULL DEFAULT 'Sankara Eye Hospital',
  city text DEFAULT 'Coimbatore',
  location_map_url text,
  start_date text NOT NULL,
  end_date text NOT NULL,
  time_from text DEFAULT '09:00 AM',
  time_to text DEFAULT '05:00 PM',
  is_paid boolean NOT NULL DEFAULT false,
  registration_fee integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  razorpay_key_id text,
  razorpay_key_secret text,
  requires_approval boolean NOT NULL DEFAULT false,
  registration_open boolean NOT NULL DEFAULT true,
  max_capacity integer,
  enable_attendance boolean NOT NULL DEFAULT true,
  attendance_days_count integer NOT NULL DEFAULT 1,
  enable_food boolean NOT NULL DEFAULT true,
  enable_goodies boolean NOT NULL DEFAULT true,
  enable_google_wallet boolean NOT NULL DEFAULT true,
  organizer_name text DEFAULT 'Sankara Eye Care Institutions',
  organizer_email text,
  organizer_phone text,
  theme_color text NOT NULL DEFAULT '#18181B',
  accent_color text NOT NULL DEFAULT '#6366F1',
  banner_url text,
  logo_url text,
  agenda_pdf_url text,
  agenda_pdf_button_text text DEFAULT 'Download Event Agenda (PDF)',
  custom_pdf_url text,
  custom_pdf_button_text text DEFAULT 'View Document (PDF)',
  pdf_attachments_json text,
  agenda_json text,
  pricing_tiers_json text,
  badge_subtitle text,
  badge_footer_text text,
  post_event_summary text,
  post_event_description text,
  post_event_ending_notes text,
  post_event_visitor_count integer,
  post_event_gallery_json text,
  post_event_completed boolean NOT NULL DEFAULT false,
  post_event_completed_at timestamp with time zone,
  spoc_name text,
  spoc_designation text,
  spoc_phone text,
  spoc_email text,
  cancellation_policy text,
  require_document_upload boolean DEFAULT false,
  document_upload_label text DEFAULT 'Upload Medical Council Certificate / Student ID',
  document_upload_required boolean DEFAULT false,
  group_registration_enabled boolean DEFAULT true,
  awards_pdf_url text,
  awards_pdf_button_text text DEFAULT 'Download Awards & Winners List (PDF)',
  external_photos_url text,
  external_photos_button_text text DEFAULT 'View AI Event Photos (Samaro AI / Photomall)',
  feedback_form_json text,
  certificate_template_json text,
  pre_post_test_json text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. PARTICIPANTS (Delegates, Faculty, Speakers, PG Students, Group Bookings)
CREATE TABLE IF NOT EXISTS participants (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  registration_number text NOT NULL UNIQUE,
  qr_token text UNIQUE,
  name text NOT NULL,
  clean_name text,
  email text,
  mobile text,
  institution text NOT NULL,
  designation text,
  password_hash text,
  reset_token text,
  reset_token_expiry timestamp with time zone,
  otp_code text,
  otp_expires timestamp with time zone,
  address text,
  age text,
  gender text,
  is_on_spot boolean DEFAULT false,
  is_on_spot_linked boolean DEFAULT false,
  is_on_spot_onboarded boolean DEFAULT false,
  event_reminder_sent boolean DEFAULT false NOT NULL,
  is_paid boolean DEFAULT false NOT NULL,
  payment_status text DEFAULT 'unpaid' NOT NULL,
  payment_amount integer DEFAULT 0,
  payment_id text,
  order_id text,
  utr_number text,
  approval_status text DEFAULT 'approved' NOT NULL,
  approved_at timestamp with time zone,
  approved_by integer,
  rejection_reason text,
  notes text,
  medical_council_reg_number text,
  document_url text,
  document_type text,
  category_tier_name text,
  group_registration_id integer,
  is_active boolean DEFAULT true NOT NULL,
  is_sponsored boolean DEFAULT false NOT NULL,
  sponsor_type text,
  delegate_type text DEFAULT 'delegate' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS participants_event_id_idx ON participants(event_id);
CREATE INDEX IF NOT EXISTS participants_email_idx ON participants(email);
CREATE INDEX IF NOT EXISTS participants_mobile_idx ON participants(mobile);
CREATE INDEX IF NOT EXISTS participants_clean_name_idx ON participants(clean_name);
CREATE INDEX IF NOT EXISTS participants_is_on_spot_idx ON participants(is_on_spot);
CREATE INDEX IF NOT EXISTS participants_approval_status_idx ON participants(approval_status);

-- 4. FACULTY & SPEAKER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
  id serial PRIMARY KEY,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  role text NOT NULL,
  track text NOT NULL,
  session_name text,
  hall text,
  date text,
  time text,
  presentation_title text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS assignments_participant_id_idx ON assignments(participant_id);

-- 5. UPLOADED FILES (PPTX, Posters, Papers)
CREATE TABLE IF NOT EXISTS uploaded_files (
  id serial PRIMARY KEY,
  assignment_id integer NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_name text NOT NULL,
  file_type text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  size integer,
  uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS uploaded_files_assignment_id_idx ON uploaded_files(assignment_id);

-- 6. FOOD SESSIONS & LOGS
CREATE TABLE IF NOT EXISTS food_sessions (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  session_code text,
  name text NOT NULL,
  date text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS food_logs (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  food_session_id integer NOT NULL REFERENCES food_sessions(id) ON DELETE CASCADE,
  coordinator_id integer REFERENCES system_users(id),
  collected_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS food_logs_event_id_idx ON food_logs(event_id);
CREATE INDEX IF NOT EXISTS food_logs_participant_id_idx ON food_logs(participant_id);
CREATE INDEX IF NOT EXISTS food_logs_food_session_id_idx ON food_logs(food_session_id);

-- 7. ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS attendance_logs (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  scanned_by integer REFERENCES system_users(id),
  day text DEFAULT 'Day 1' NOT NULL,
  scanned_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS attendance_logs_event_id_idx ON attendance_logs(event_id);
CREATE INDEX IF NOT EXISTS attendance_logs_participant_id_idx ON attendance_logs(participant_id);

-- 8. SYSTEM & INTEGRATION SETTINGS
CREATE TABLE IF NOT EXISTS submission_settings (
  id serial PRIMARY KEY,
  submissions_open boolean DEFAULT true NOT NULL,
  otp_mode text DEFAULT 'static' NOT NULL,
  test_otps text DEFAULT '111111,222222,333333' NOT NULL,
  whatsapp_api_key text,
  whatsapp_instance_id text,
  whatsapp_template text,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean DEFAULT false NOT NULL,
  smtp_user text,
  smtp_pass text,
  smtp_from_email text,
  smtp_from_name text,
  razorpay_key_id text,
  razorpay_key_secret text,
  session_timeout_minutes integer DEFAULT 30 NOT NULL,
  google_sheet_url text,
  conference_map_url text,
  live_tv_url text,
  google_service_account_email text,
  google_service_account_key text,
  google_client_id text,
  google_client_secret text,
  google_callback_url text,
  google_wallet_issuer_id text,
  google_wallet_service_account_email text,
  google_wallet_private_key text,
  gemini_api_key text,
  hf_token text,
  support_ticket_cc_emails text DEFAULT 'saurabhrai@sankaraeye.com, prabhanjan@sankaraeye.com',
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 9. ACTIVE SESSIONS & ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS active_sessions (
  id serial PRIMARY KEY,
  session_token text NOT NULL UNIQUE,
  user_id integer NOT NULL,
  user_type text NOT NULL,
  user_name text NOT NULL,
  ip_address text,
  user_agent text,
  device_type text,
  device_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id serial PRIMARY KEY,
  type text DEFAULT 'general' NOT NULL,
  message text NOT NULL,
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  user_id integer,
  user_name text,
  action text,
  details text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- 10. GOODIES & MERCHANDISE SCAN LOGS
CREATE TABLE IF NOT EXISTS goodies_logs (
  id serial PRIMARY KEY,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  scanned_by integer REFERENCES system_users(id),
  scanned_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS goodies_logs_participant_id_idx ON goodies_logs(participant_id);

-- 11. PERSONAL DETAILS
CREATE TABLE IF NOT EXISTS personal_details (
  id serial PRIMARY KEY,
  participant_id integer NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  food_preference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 12. RSVP LOGS
CREATE TABLE IF NOT EXISTS rsvp (
  id serial PRIMARY KEY,
  participant_id integer NOT NULL,
  track_name text NOT NULL,
  session_name text NOT NULL,
  session_date text NOT NULL,
  session_time text NOT NULL,
  participant_email text,
  reminder1_sent_at timestamp with time zone,
  reminder2_sent_at timestamp with time zone,
  email_open_token text UNIQUE,
  email_opened_at timestamp with time zone,
  event_id integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS rsvp_participant_id_idx ON rsvp(participant_id);

-- 13. GOOGLE SHEETS SYNC
CREATE TABLE IF NOT EXISTS sync_sessions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  google_sheet_id text NOT NULL,
  sheet_name text DEFAULT '',
  location_name text DEFAULT 'Sankara Eye Hospital' NOT NULL,
  is_active boolean DEFAULT false NOT NULL,
  field_mappings jsonb DEFAULT '{}' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 14. COUPONS & SPONSOR DISCOUNTS
CREATE TABLE IF NOT EXISTS event_coupons (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text DEFAULT 'percentage' NOT NULL,
  discount_value integer DEFAULT 0 NOT NULL,
  sponsor_name text,
  description text,
  max_uses integer,
  used_count integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS event_coupons_code_idx ON event_coupons(code);

-- 15. GOOGLE WALLET PASSES
CREATE TABLE IF NOT EXISTS google_wallet_passes (
  id serial PRIMARY KEY,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  wallet_object_id text NOT NULL UNIQUE,
  wallet_class_id text NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS gwallet_participant_id_idx ON google_wallet_passes(participant_id);
CREATE INDEX IF NOT EXISTS gwallet_event_id_idx ON google_wallet_passes(event_id);

-- 16. ID CARD DESIGNS
CREATE TABLE IF NOT EXISTS id_card_designs (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  card_type text DEFAULT 'preregistered' NOT NULL,
  template_image_url text,
  back_template_image_url text,
  width_inches text DEFAULT '3.46' NOT NULL,
  height_inches text DEFAULT '5.51' NOT NULL,
  dpi integer DEFAULT 300 NOT NULL,
  orientation text DEFAULT 'portrait' NOT NULL,
  is_double_sided boolean DEFAULT false NOT NULL,
  print_side_mode text DEFAULT 'duplex' NOT NULL,
  placeholders_json text,
  back_placeholders_json text,
  sheet_config_json text,
  status text DEFAULT 'draft' NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  published_version integer,
  created_by_id integer,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 17. CHAT LOGS & UNRESOLVED QUERIES
CREATE TABLE IF NOT EXISTS chat_logs (
  id serial PRIMARY KEY,
  session_id text NOT NULL,
  user_identifier text DEFAULT 'Anonymous Delegate',
  user_message text NOT NULL,
  bot_response text NOT NULL,
  model_used text DEFAULT 'meta-llama/Llama-3.1-8B-Instruct',
  latency_ms integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_logs_session_idx ON chat_logs(session_id);

CREATE TABLE IF NOT EXISTS unresolved_queries (
  id serial PRIMARY KEY,
  ticket_number text NOT NULL UNIQUE,
  user_identifier text DEFAULT 'Anonymous Delegate',
  user_email text NOT NULL,
  user_phone text,
  user_message text NOT NULL,
  bot_draft_response text,
  status text DEFAULT 'pending' NOT NULL,
  admin_reply text,
  resolved_by text,
  resolved_at timestamp with time zone,
  added_to_knowledge_base boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id serial PRIMARY KEY,
  topic text DEFAULT 'General' NOT NULL,
  question_keywords text NOT NULL,
  question_text text NOT NULL,
  verified_answer text NOT NULL,
  source text DEFAULT 'admin_resolution' NOT NULL,
  added_by text DEFAULT 'Super Admin',
  is_active boolean DEFAULT true NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 18. POST-CME FEEDBACK SUBMISSIONS
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  participant_id integer REFERENCES participants(id) ON DELETE CASCADE,
  participant_name text,
  participant_email text,
  ratings_json text DEFAULT '{}' NOT NULL,
  comments text,
  suggestions text,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_event_id_idx ON feedback_submissions(event_id);
CREATE INDEX IF NOT EXISTS feedback_participant_id_idx ON feedback_submissions(participant_id);

-- 19. E-CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
  id serial PRIMARY KEY,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  participant_id integer REFERENCES participants(id) ON DELETE CASCADE,
  certificate_type text DEFAULT 'delegate' NOT NULL,
  certificate_number text NOT NULL UNIQUE,
  recipient_name text NOT NULL,
  recipient_email text,
  recipient_institution text,
  credit_hours text DEFAULT '4 CME Credit Hours',
  presentation_title text,
  pdf_url text,
  qr_verification_token text UNIQUE,
  is_issued boolean DEFAULT true NOT NULL,
  is_downloaded boolean DEFAULT false NOT NULL,
  downloaded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS certificates_event_id_idx ON certificates(event_id);
CREATE INDEX IF NOT EXISTS certificates_participant_id_idx ON certificates(participant_id);

-- 20. GROUP / INSTITUTIONAL BOOKINGS
CREATE TABLE IF NOT EXISTS group_registrations (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  contact_person_name text NOT NULL,
  contact_person_email text NOT NULL,
  contact_person_phone text NOT NULL,
  group_booking_code text NOT NULL UNIQUE,
  total_delegates integer DEFAULT 1 NOT NULL,
  total_amount integer DEFAULT 0 NOT NULL,
  payment_status text DEFAULT 'unpaid' NOT NULL,
  payment_id text,
  order_id text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS groups_event_id_idx ON group_registrations(event_id);
CREATE INDEX IF NOT EXISTS groups_code_idx ON group_registrations(group_booking_code);
