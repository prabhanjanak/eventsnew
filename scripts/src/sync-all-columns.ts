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

async function syncAllColumns() {
  const client = await pool.connect();
  try {
    console.log("Synchronizing all columns on participants table...");
    await client.query(`
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS event_id INTEGER;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_on_spot BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_on_spot_linked BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_on_spot_onboarded BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS event_reminder_sent BOOLEAN DEFAULT FALSE;
      
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 0;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS payment_id TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS order_id TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS utr_number TEXT;
      
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS approved_by INTEGER;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS notes TEXT;
      
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS sponsor_type TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS delegate_type TEXT DEFAULT 'delegate';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    console.log("✅ All participants columns synchronized!");
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllColumns().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
