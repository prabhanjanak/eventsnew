import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function createTestUser(name: string, email: string, mobile: string, regNum: string) {
  // Check if exists
  const [existing] = await db.select().from(participantsTable).where(eq(participantsTable.email, email));
  if (existing) {
    console.log(`User ${email} already exists with ID ${existing.id}. Updating...`);
    await db.update(participantsTable)
      .set({ name, mobile, registrationNumber: regNum })
      .where(eq(participantsTable.id, existing.id));
    console.log(`Updated ${email}.`);
  } else {
    console.log(`Creating user ${email}...`);
    const [inserted] = await db.insert(participantsTable)
      .values({
        name,
        email,
        mobile,
        registrationNumber: regNum,
        institution: "Test Institution",
        country: "India",
      })
      .returning();
    console.log(`Created test user: ${inserted.name} (ID: ${inserted.id})`);
  }
}

async function main() {
  try {
    await createTestUser("Saurabh Rai", "saurabhrai@sankaraeye.com", "9999999991", "TEST-001");
    await createTestUser("Prabhanjan Bhat", "prabh.bhat12@gmail.com", "9999999992", "TEST-002");
    console.log("Done.");
  } catch (err) {
    console.error("Error creating users:", err);
  }
  process.exit(0);
}

main();
