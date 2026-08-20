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

async function fixUploadedFilesSchema() {
  const client = await pool.connect();
  try {
    console.log("Fixing uploaded_files table columns...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER,
        participant_id INTEGER,
        file_name TEXT,
        original_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        file_url TEXT,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS assignment_id INTEGER;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS participant_id INTEGER;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_name TEXT;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS original_name TEXT;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_type TEXT;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_size INTEGER;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_url TEXT;
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    console.log("✅ uploaded_files columns synced!");
  } finally {
    client.release();
    await pool.end();
  }
}

fixUploadedFilesSchema().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
