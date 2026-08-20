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

async function addMissingColumns() {
  const client = await pool.connect();
  try {
    console.log("Checking and adding missing columns in participants table...");
    await client.query(`
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_on_spot_onboarded BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_on_spot_linked BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS event_reminder_sent BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS sponsor_type VARCHAR(100);
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS delegate_type VARCHAR(100);
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS rsvp (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER,
        track_name VARCHAR(255),
        session_name VARCHAR(255),
        session_date VARCHAR(100),
        session_time VARCHAR(100),
        participant_email VARCHAR(255),
        reminder1_sent_at TIMESTAMP,
        reminder2_sent_at TIMESTAMP,
        email_open_token VARCHAR(255),
        email_opened_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Missing columns added successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingColumns().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
