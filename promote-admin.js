import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vision2020",
});

async function main() {
  try {
    const res = await pool.query(
      "UPDATE system_users SET user_type = 'super_admin' WHERE name ILIKE '%prabhanjan%' RETURNING *"
    );
    console.log(`Updated ${res.rowCount} users.`);
    for (const row of res.rows) {
      console.log(`Promoted: ${row.name} (${row.email}) to super_admin`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

main();
