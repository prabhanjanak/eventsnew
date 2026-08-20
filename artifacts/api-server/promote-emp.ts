import { db, systemUsersTable } from "@workspace/db";
import { or, eq, ilike } from "drizzle-orm";

async function main() {
  try {
    const res = await db.update(systemUsersTable)
      .set({ userType: "super_admin" })
      .where(or(
        eq(systemUsersTable.empId, "010177"),
        ilike(systemUsersTable.name, "%010177%")
      ))
      .returning();
      
    if (res.length === 0) {
      console.log("No user found with Emp 010177. Here are all system users:");
      const allUsers = await db.select().from(systemUsersTable);
      console.table(allUsers.map(u => ({ id: u.id, name: u.name, empId: u.empId, type: u.userType })));
    } else {
      console.log(`Updated ${res.length} users.`);
      for (const row of res) {
        console.log(`Promoted: ${row.name} (Emp: ${row.empId}) to super_admin`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
