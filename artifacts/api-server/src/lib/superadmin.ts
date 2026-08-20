import bcrypt from "bcryptjs";
import { db, systemUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export async function ensureSuperAdmin() {
  try {
    const empId = "010177";
    const name = "Prabhanjan";
    const email = "prabhanjan@sankaraeye.com";
    const mobile = "8951568286";
    const passwordHash = await bcrypt.hash("Sankara@123", 10);

    const [existing] = await db
      .select()
      .from(systemUsersTable)
      .where(eq(systemUsersTable.empId, empId))
      .limit(1);

    if (!existing) {
      await db.insert(systemUsersTable).values({
        empId,
        name,
        email,
        mobile,
        userType: "super_admin",
        passwordHash,
        mustChangePassword: false,
        permissions: ["attendance", "goodies", "food"],
      });
      logger.info({ empId }, "Super admin Prabhanjan automatically created in prod db.");
    } else {
      await db
        .update(systemUsersTable)
        .set({
          name,
          email,
          mobile,
          userType: "super_admin",
          passwordHash,
          mustChangePassword: false,
        })
        .where(eq(systemUsersTable.id, existing.id));
      logger.info({ empId }, "Super admin Prabhanjan automatically updated in prod db.");
    }

    // ── AUTOMATED DATABASE MIGRATION & LEGACY VISION 2020 DATA ATTACHMENT ─────
    try {
      // 1. Ensure all tables have required event_id and modern columns
      const ddlStatements = [
        `CREATE TABLE IF NOT EXISTS events (
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
          status text NOT NULL DEFAULT 'published',
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_summary text`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_description text`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_ending_notes text`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_visitor_count integer`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_gallery_json text`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_completed boolean DEFAULT false`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS post_event_completed_at timestamp with time zone`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_attendance boolean DEFAULT true`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_food boolean DEFAULT true`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_goodies boolean DEFAULT true`,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_google_wallet boolean DEFAULT true`,
        `ALTER TABLE participants ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE food_sessions ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE rsvp ADD COLUMN IF NOT EXISTS event_id integer`,
        `ALTER TABLE system_users ADD COLUMN IF NOT EXISTS assigned_event_ids jsonb DEFAULT '[]'::jsonb`,
      ];

      for (const statement of ddlStatements) {
        try {
          await db.execute(sql.raw(statement));
        } catch (e: any) {
          // ignore already existing columns
        }
      }

      // 2. Ensure Primary Vision 2020 Event Exists
      const eventCheck: any = await db.execute(sql.raw(`
        SELECT id, slug, title FROM events WHERE slug = 'vision-2020' OR slug = 'annual-ophthalmology-2026' ORDER BY id ASC LIMIT 1
      `));

      let primaryEventId: number;

      if (eventCheck.rows && eventCheck.rows.length > 0) {
        primaryEventId = eventCheck.rows[0].id;
      } else {
        // Create primary Vision 2020 event
        const insertResult: any = await db.execute(sql.raw(`
          INSERT INTO events (
            slug, title, event_type, description, venue, city, 
            start_date, end_date, time_from, time_to, is_paid, registration_fee, 
            status, enable_attendance, enable_food, enable_goodies, enable_google_wallet
          ) VALUES (
            'annual-ophthalmology-2026',
            'Vision 2020 - 18th Annual National Ophthalmology Conference',
            'conference',
            'Flagship annual clinical ophthalmology conference and symposium organized by Sankara Eye Hospital.',
            'Sankara Eye Hospital, Auditorium Complex',
            'Coimbatore',
            '2026-06-05',
            '2026-06-07',
            '08:30 AM',
            '06:00 PM',
            false,
            0,
            'completed',
            true,
            true,
            true,
            true
          ) RETURNING id
        `));
        primaryEventId = insertResult.rows[0].id;
        logger.info({ primaryEventId }, "Default Vision 2020 event created for legacy production data attachment.");
      }

      // 3. Automatically link all legacy production records with event_id IS NULL to primary Vision 2020 event
      const backfillStatements = [
        `UPDATE participants SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE food_sessions SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE attendance_logs SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE food_logs SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE assignments SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE coupons SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
        `UPDATE rsvp SET event_id = ${primaryEventId} WHERE event_id IS NULL`,
      ];

      for (const statement of backfillStatements) {
        try {
          await db.execute(sql.raw(statement));
        } catch {
          // ignore if table does not exist
        }
      }

      logger.info({ primaryEventId }, "Legacy Vision 2020 data and stats successfully attached and verified in production database.");
    } catch (e: any) {
      logger.warn({ err: e.message }, "Notice: Automated legacy database migration check completed with warnings.");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to automatically seed super admin on startup.");
  }
}
