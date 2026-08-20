import { db, systemUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function reset() {
  console.log("Inspecting system users...");
  const users = await db.select().from(systemUsersTable);
  console.log("Users:", users.map(u => ({ id: u.id, empId: u.empId, name: u.name, mobile: u.mobile, userType: u.userType })));

  const admin = users.find(u => u.empId === "EMP0000" || u.mobile === "9999900000");
  if (admin) {
    const ph = await bcrypt.hash("Admin@2026", 10);
    await db.update(systemUsersTable).set({ passwordHash: ph }).where(eq(systemUsersTable.id, admin.id));
    console.log(`Successfully reset password for admin ${admin.name} (EMP0000)`);
  } else {
    console.log("Admin user not found. Creating...");
    const ph = await bcrypt.hash("Admin@2026", 10);
    await db.insert(systemUsersTable).values({
      empId: "EMP0000",
      name: "Admin",
      mobile: "9999900000",
      userType: "admin",
      passwordHash: ph
    });
    console.log("Created admin user successfully");
  }
}

reset().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
