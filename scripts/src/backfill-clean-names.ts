import { db, participantsTable, getCleanName } from "@workspace/db";
import { sql } from "drizzle-orm";

async function backfill() {
  console.log("Starting backfill for clean_name column...");

  const participants = await db
    .select({ id: participantsTable.id, name: participantsTable.name })
    .from(participantsTable);

  console.log(`Found ${participants.length} participants in the database.`);

  let updatedCount = 0;
  for (const p of participants) {
    const clean = getCleanName(p.name);
    await db
      .update(participantsTable)
      .set({ cleanName: clean })
      .where(sql`${participantsTable.id} = ${p.id}`);
    updatedCount++;
  }

  console.log(`Successfully backfilled clean_name for ${updatedCount} participants.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
