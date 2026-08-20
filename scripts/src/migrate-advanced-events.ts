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

async function syncAdvancedEventSchema() {
  const client = await pool.connect();
  try {
    console.log("Migrating advanced events and coupons schema...");
    await client.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS time_from TEXT DEFAULT '09:00 AM';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS time_to TEXT DEFAULT '05:00 PM';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS razorpay_key_secret TEXT;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_attendance BOOLEAN DEFAULT TRUE;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_days_count INTEGER DEFAULT 1;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_food BOOLEAN DEFAULT TRUE;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_goodies BOOLEAN DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS event_coupons (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_value INTEGER NOT NULL DEFAULT 0,
        sponsor_name TEXT,
        description TEXT,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS event_coupons_code_idx ON event_coupons(code);
      CREATE INDEX IF NOT EXISTS event_coupons_event_id_idx ON event_coupons(event_id);
    `);

    // Insert standard test coupons
    const eventRes = await client.query("SELECT id FROM events WHERE slug = 'annual-ophthalmology-2026'");
    if (eventRes.rows.length > 0) {
      const eventId = eventRes.rows[0].id;
      await client.query(`
        INSERT INTO event_coupons (event_id, code, discount_type, discount_value, description, sponsor_name)
        VALUES 
          ($1, 'SANKARA20', 'percentage', 20, '20% Special Institutional Discount', 'Sankara Trust'),
          ($1, 'SPONSORED100', 'sponsor_free', 100, '100% Fully Sponsored Industry Pass', 'Alcon / Zeiss Platinum Sponsor'),
          ($1, 'FLAT500', 'fixed', 500, '₹500 Early Bird Rebate', 'Organizing Committee')
        ON CONFLICT DO NOTHING;
      `, [eventId]);
    }

    console.log("✅ Advanced events & coupons migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

syncAdvancedEventSchema().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
