import { db, eventsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

async function main() {
  console.log("Running migration for internal participants columns...");
  
  await db.execute(sql`
    ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "employee_id" text;
    ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "unit" text;
    ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "state" text;
    ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "district" text;
  `);

  console.log("✓ Added employee_id, unit, state, district columns to participants table.");

  // Update SanQALP event to internal_staff, registrationOpen: true, requiresApproval: true
  const [sanQalp] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.slug, "sanqualp-bangalore"))
    .limit(1);

  if (sanQalp) {
    await db
      .update(eventsTable)
      .set({
        eventType: "internal_staff",
        registrationOpen: true,
        requiresApproval: true,
        updatedAt: new Date(),
      })
      .where(eq(eventsTable.id, sanQalp.id));
    console.log(`✓ Updated SanQALP event (ID: ${sanQalp.id}): eventType='internal_staff', registrationOpen=true, requiresApproval=true`);
  } else {
    console.log("⚠️ SanQALP event with slug 'sanqualp-bangalore' not found.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
