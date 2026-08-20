import bcrypt from "bcryptjs";
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

async function upsertUser() {
  const client = await pool.connect();
  try {
    console.log("Upserting Super Admin Prabhanjan...");
    const passwordHash = await bcrypt.hash("Sankara@123", 10);

    // Check if user exists by emp_id or email
    const existing = await client.query(
      `SELECT * FROM system_users WHERE emp_id = $1 OR email = $2`,
      ["010177", "prabhanjan@sankaraeye.com"]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE system_users 
         SET name = $1, email = $2, password_hash = $3, user_type = 'super_admin', must_change_password = false 
         WHERE id = $4`,
        ["Prabhanjan", "prabhanjan@sankaraeye.com", passwordHash, existing.rows[0].id]
      );
      console.log("✅ Super Admin user 010177 / prabhanjan@sankaraeye.com updated successfully with password Sankara@123");
    } else {
      await client.query(
        `INSERT INTO system_users (emp_id, name, email, user_type, password_hash, must_change_password)
         VALUES ($1, $2, $3, 'super_admin', $4, false)`,
        ["010177", "Prabhanjan", "prabhanjan@sankaraeye.com", passwordHash]
      );
      console.log("✅ Super Admin user 010177 / prabhanjan@sankaraeye.com created successfully with password Sankara@123");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

upsertUser().catch((err) => {
  console.error("Error upserting user:", err);
  process.exit(1);
});
