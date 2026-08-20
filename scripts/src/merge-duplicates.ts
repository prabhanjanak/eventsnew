import { 
  db, 
  participantsTable, 
  assignmentsTable, 
  attendanceLogsTable, 
  foodLogsTable, 
  goodiesLogsTable, 
  rsvpTable, 
  personalDetailsTable 
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("Starting duplicate participants merge...");

  try {
    const all = await db.select().from(participantsTable);
    const groups = new Map<string, typeof all>();

    for (const p of all) {
      if (p.name.includes("On Spot Slot")) continue; // Skip blank slots

      const cleanName = p.name.trim().replace(/\s+/g, " ").toLowerCase();
      const cleanInst = p.institution.trim().replace(/\s+/g, " ").toLowerCase();
      const key = `${cleanName}|${cleanInst}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    }

    let totalMerged = 0;

    for (const [key, list] of groups.entries()) {
      if (list.length < 2) continue;

      // Sort by ID to keep the oldest/first record
      list.sort((a, b) => a.id - b.id);
      const target = list[0];
      const duplicates = list.slice(1);

      console.log(`\nMerging duplicates for: "${target.name}" (${target.institution})`);
      console.log(`  Keeping target: ID ${target.id} (${target.registrationNumber})`);

      for (const dup of duplicates) {
        console.log(`  Merging duplicate: ID ${dup.id} (${dup.registrationNumber})`);

        // 1. assignmentsTable: Update all assignments to target ID
        const assignments = await db
          .select()
          .from(assignmentsTable)
          .where(eq(assignmentsTable.participantId, dup.id));
        for (const a of assignments) {
          await db
            .update(assignmentsTable)
            .set({ participantId: target.id })
            .where(eq(assignmentsTable.id, a.id));
          console.log(`    Updated assignment ID ${a.id} role ${a.role}`);
        }

        // 2. attendanceLogsTable: Check and update or delete
        const targetAttendance = await db
          .select()
          .from(attendanceLogsTable)
          .where(eq(attendanceLogsTable.participantId, target.id));
        const dupAttendance = await db
          .select()
          .from(attendanceLogsTable)
          .where(eq(attendanceLogsTable.participantId, dup.id));
        
        for (const att of dupAttendance) {
          if (targetAttendance.length > 0) {
            await db.delete(attendanceLogsTable).where(eq(attendanceLogsTable.id, att.id));
            console.log(`    Deleted duplicate attendance log ID ${att.id}`);
          } else {
            await db
              .update(attendanceLogsTable)
              .set({ participantId: target.id })
              .where(eq(attendanceLogsTable.id, att.id));
            console.log(`    Moved attendance log ID ${att.id} to target`);
          }
        }

        // 3. foodLogsTable: Check and update or delete
        const dupFood = await db
          .select()
          .from(foodLogsTable)
          .where(eq(foodLogsTable.participantId, dup.id));

        for (const fl of dupFood) {
          const [targetFoodMatch] = await db
            .select()
            .from(foodLogsTable)
            .where(
              and(
                eq(foodLogsTable.participantId, target.id),
                eq(foodLogsTable.foodSessionId, fl.foodSessionId)
              )
            );
          if (targetFoodMatch) {
            await db.delete(foodLogsTable).where(eq(foodLogsTable.id, fl.id));
            console.log(`    Deleted duplicate food log ID ${fl.id} for session ${fl.foodSessionId}`);
          } else {
            await db
              .update(foodLogsTable)
              .set({ participantId: target.id })
              .where(eq(foodLogsTable.id, fl.id));
            console.log(`    Moved food log ID ${fl.id} to target`);
          }
        }

        // 4. goodiesLogsTable: Check and update or delete
        const targetGoodies = await db
          .select()
          .from(goodiesLogsTable)
          .where(eq(goodiesLogsTable.participantId, target.id));
        const dupGoodies = await db
          .select()
          .from(goodiesLogsTable)
          .where(eq(goodiesLogsTable.participantId, dup.id));

        for (const g of dupGoodies) {
          if (targetGoodies.length > 0) {
            await db.delete(goodiesLogsTable).where(eq(goodiesLogsTable.id, g.id));
            console.log(`    Deleted duplicate goodies log ID ${g.id}`);
          } else {
            await db
              .update(goodiesLogsTable)
              .set({ participantId: target.id })
              .where(eq(goodiesLogsTable.id, g.id));
            console.log(`    Moved goodies log ID ${g.id} to target`);
          }
        }

        // 5. rsvpTable: Check and update or delete
        const dupRsvps = await db
          .select()
          .from(rsvpTable)
          .where(eq(rsvpTable.participantId, dup.id));

        for (const r of dupRsvps) {
          const [targetRsvpMatch] = await db
            .select()
            .from(rsvpTable)
            .where(
              and(
                eq(rsvpTable.participantId, target.id),
                eq(rsvpTable.trackName, r.trackName),
                eq(rsvpTable.sessionName, r.sessionName),
                eq(rsvpTable.sessionDate, r.sessionDate)
              )
            );
          if (targetRsvpMatch) {
            await db.delete(rsvpTable).where(eq(rsvpTable.id, r.id));
            console.log(`    Deleted duplicate RSVP ID ${r.id} for ${r.sessionName}`);
          } else {
            await db
              .update(rsvpTable)
              .set({ participantId: target.id })
              .where(eq(rsvpTable.id, r.id));
            console.log(`    Moved RSVP ID ${r.id} to target`);
          }
        }

        // 6. personalDetailsTable: Check and update or delete
        const [targetPd] = await db
          .select()
          .from(personalDetailsTable)
          .where(eq(personalDetailsTable.participantId, target.id));
        const [dupPd] = await db
          .select()
          .from(personalDetailsTable)
          .where(eq(personalDetailsTable.participantId, dup.id));

        if (dupPd) {
          if (targetPd) {
            await db.delete(personalDetailsTable).where(eq(personalDetailsTable.id, dupPd.id));
            console.log(`    Deleted duplicate personal details ID ${dupPd.id}`);
          } else {
            await db
              .update(personalDetailsTable)
              .set({ participantId: target.id })
              .where(eq(personalDetailsTable.id, dupPd.id));
            console.log(`    Moved personal details ID ${dupPd.id} to target`);
          }
        }

        // 7. Delete the duplicate participant record
        await db.delete(participantsTable).where(eq(participantsTable.id, dup.id));
        console.log(`    Deleted duplicate participant ID ${dup.id} successfully.`);
        totalMerged++;
      }
    }

    console.log(`\nMerge complete! Merged and cleaned up ${totalMerged} duplicate profiles.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to merge duplicates:", err);
    process.exit(1);
  }
}

run();
