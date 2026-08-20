import "dotenv/config";
import { db, systemUsersTable } from "@workspace/db";
import { ilike } from "drizzle-orm";

async function main() {
  try {
    const res = await db.update(systemUsersTable)
      .set({ userType: "super_admin" })
      .where(ilike(systemUsersTable.name, "%prabhanjan%"))
      .returning();
      
    console.log(`Updated ${res.length} users.`);
    for (const row of res) {
      console.log(`Promoted: ${row.name} (${row.email}) to super_admin`);
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
