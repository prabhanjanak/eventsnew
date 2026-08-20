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

async function fixSubmissionSettings() {
  const client = await pool.connect();
  try {
    console.log("Fixing submission_settings table columns...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_settings (
        id SERIAL PRIMARY KEY,
        session_timeout_minutes INTEGER DEFAULT 30,
        allow_faculty_uploads BOOLEAN DEFAULT TRUE,
        max_upload_size_mb INTEGER DEFAULT 50,
        allowed_file_types TEXT DEFAULT 'pdf,ppt,pptx,doc,docx',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE submission_settings ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 30;
      ALTER TABLE submission_settings ADD COLUMN IF NOT EXISTS allow_faculty_uploads BOOLEAN DEFAULT TRUE;
      ALTER TABLE submission_settings ADD COLUMN IF NOT EXISTS max_upload_size_mb INTEGER DEFAULT 50;
      ALTER TABLE submission_settings ADD COLUMN IF NOT EXISTS allowed_file_types TEXT DEFAULT 'pdf,ppt,pptx,doc,docx';

      INSERT INTO submission_settings (id, session_timeout_minutes)
      VALUES (1, 30)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("✅ submission_settings table ready!");
  } finally {
    client.release();
    await pool.end();
  }
}

fixSubmissionSettings().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
