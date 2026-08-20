import { db, systemUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Locating Prabhanjan K (010177)...");
  const [prabhanjan] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.empId, "010177"));

  if (prabhanjan) {
    const ph = await bcrypt.hash("Prabhanjan@2026", 10);
    await db
      .update(systemUsersTable)
      .set({ passwordHash: ph, userType: "super_admin" })
      .where(eq(systemUsersTable.id, prabhanjan.id));
    console.log(`✓ Reset password successfully for ${prabhanjan.name} (${prabhanjan.empId}) to 'Prabhanjan@2026'`);
  } else {
    console.log("❌ Prabhanjan K not found in system_users!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
