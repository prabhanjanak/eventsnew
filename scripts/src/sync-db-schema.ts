import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(dirname, "../../.env");
if (fs.existsSync(envPath) && !process.env.DATABASE_URL) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...values] = trimmed.split("=");
      if (key) process.env[key.trim()] = values.join("=").trim();
    }
  });
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function syncSchema() {
  const client = await pool.connect();
  try {
    console.log("Creating events table with exact matching schema...");
    
    // Recreate events table
    await client.query(`
      DROP TABLE IF EXISTS "events" CASCADE;
      CREATE TABLE "events" (
        "id" serial PRIMARY KEY,
        "slug" text NOT NULL UNIQUE,
        "title" text NOT NULL,
        "event_type" text NOT NULL DEFAULT 'conference',
        "description" text,
        "short_description" text,
        "venue" text NOT NULL DEFAULT 'Sankara Eye Hospital',
        "city" text DEFAULT 'Coimbatore',
        "location_map_url" text,
        "start_date" text NOT NULL,
        "end_date" text NOT NULL,
        "is_paid" boolean NOT NULL DEFAULT false,
        "registration_fee" integer NOT NULL DEFAULT 0,
        "currency" text NOT NULL DEFAULT 'INR',
        "requires_approval" boolean NOT NULL DEFAULT false,
        "registration_open" boolean NOT NULL DEFAULT true,
        "max_capacity" integer,
        "organizer_name" text DEFAULT 'Sankara Eye Care Institutions',
        "organizer_email" text,
        "organizer_phone" text,
        "theme_color" text NOT NULL DEFAULT '#F58220',
        "accent_color" text NOT NULL DEFAULT '#6F42C1',
        "banner_url" text,
        "logo_url" text,
        "agenda_pdf_url" text,
        "razorpay_key_id" text,
        "razorpay_key_secret" text,
        "badge_subtitle" text,
        "badge_footer_text" text,
        "status" text NOT NULL DEFAULT 'published',
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" ("slug");
      CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events" ("status");
      CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events" ("event_type");
    `);

    // Ensure participants event_id foreign key
    await client.query(`
      ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
      ALTER TABLE "food_sessions" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
      ALTER TABLE "food_logs" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
      ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
    `);

    console.log("✅ Events table created successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

syncSchema().catch((err) => {
  console.error("Schema sync error:", err);
  process.exit(1);
});
