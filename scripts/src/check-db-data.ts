import { db } from "@workspace/db";
import { participantsTable, assignmentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const pCount = await db.select({ count: sql<number>`count(*)` }).from(participantsTable);
    console.log("Participants Count:", pCount[0].count);

    const aCount = await db.select({ count: sql<number>`count(*)` }).from(assignmentsTable);
    console.log("Assignments Count:", aCount[0].count);

    // Group by track and date
    const counts = await db
      .select({
        track: assignmentsTable.track,
        date: assignmentsTable.date,
        count: sql<number>`count(*)`
      })
      .from(assignmentsTable)
      .groupBy(assignmentsTable.track, assignmentsTable.date);
    console.log("Assignments per track and date:", counts);

  } catch (err) {
    console.error("DB Check failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
