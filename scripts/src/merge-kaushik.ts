import { 
  db, 
  participantsTable, 
  assignmentsTable, 
  attendanceLogsTable, 
  foodLogsTable, 
  goodiesLogsTable, 
  rsvpTable, 
  personalDetailsTable,
  getCleanName
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("Initializing manual merge for Kaushik Murali...");

  // Duplicate registration numbers from the screenshot
  const dup1Reg = "V2020-00577"; // Kaushik Murali, Sankara
  const dup2Reg = "V2020-00618"; // Kaushik Murali, Sankara Eye Institute
  const targetReg = "V2020-00617"; // Dr. Kaushik Murali, Sankara Eye Institute (Target)

  try {
    // 1. Fetch the target participant
    const [target] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, targetReg))
      .limit(1);

    if (!target) {
      console.error(`Target participant with registration number ${targetReg} not found in the database. Ensure the sync has been run first.`);
      process.exit(1);
    }

    // Update target details
    await db
      .update(participantsTable)
      .set({
        name: "Dr. Kaushik Murali",
        cleanName: getCleanName("Dr. Kaushik Murali"),
        institution: "Sankara Eye Institute"
      })
      .where(eq(participantsTable.id, target.id));
    console.log(`Updated target participant ID ${target.id} (${targetReg}) to name 'Dr. Kaushik Murali' and institution 'Sankara Eye Institute'`);

    // 2. Fetch duplicate records
    const duplicates = await db
      .select()
      .from(participantsTable)
      .where(and(
        eq(participantsTable.delegateType, "delegate"),
        inArray(participantsTable.registrationNumber, [dup1Reg, dup2Reg])
      ));

    for (const dup of duplicates) {
      console.log(`Merging duplicate profile: ID ${dup.id} (${dup.registrationNumber}) -> Target: ID ${target.id}`);

      // Reassign assignments
      const assigns = await db
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.participantId, dup.id));
      for (const a of assigns) {
        await db
          .update(assignmentsTable)
          .set({ participantId: target.id })
          .where(eq(assignmentsTable.id, a.id));
        console.log(`  Moved assignment ID ${a.id} (Role: ${a.role}) to target`);
      }

      // Reassign attendance logs
      const targetAttendance = await db
        .select()
        .from(attendanceLogsTable)
        .where(eq(attendanceLogsTable.participantId, target.id));
      const dupAttendance = await db
        .select()
        .from(attendanceLogsTable)
        .where(eq(attendanceLogsTable.participantId, dup.id));
      for (const att of dupAttendance) {
        if (targetAttendance.some(ta => ta.day === att.day)) {
          await db.delete(attendanceLogsTable).where(eq(attendanceLogsTable.id, att.id));
          console.log(`  Deleted duplicate attendance log ID ${att.id}`);
        } else {
          await db
            .update(attendanceLogsTable)
            .set({ participantId: target.id })
            .where(eq(attendanceLogsTable.id, att.id));
          console.log(`  Moved attendance log ID ${att.id} to target`);
        }
      }

      // Reassign food logs
      const dupFood = await db
        .select()
        .from(foodLogsTable)
        .where(eq(foodLogsTable.participantId, dup.id));
      for (const fl of dupFood) {
        const [targetFoodMatch] = await db
          .select()
          .from(foodLogsTable)
          .where(and(
            eq(foodLogsTable.participantId, target.id),
            eq(foodLogsTable.foodSessionId, fl.foodSessionId)
          ));
        if (targetFoodMatch) {
          await db.delete(foodLogsTable).where(eq(foodLogsTable.id, fl.id));
          console.log(`  Deleted duplicate food log ID ${fl.id} for food session ${fl.foodSessionId}`);
        } else {
          await db
            .update(foodLogsTable)
            .set({ participantId: target.id })
            .where(eq(foodLogsTable.id, fl.id));
          console.log(`  Moved food log ID ${fl.id} to target`);
        }
      }

      // Reassign goodies logs
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
          console.log(`  Deleted duplicate goodies log ID ${g.id}`);
        } else {
          await db
            .update(goodiesLogsTable)
            .set({ participantId: target.id })
            .where(eq(goodiesLogsTable.id, g.id));
          console.log(`  Moved goodies log ID ${g.id} to target`);
        }
      }

      // Reassign RSVPs
      const dupRsvps = await db
        .select()
        .from(rsvpTable)
        .where(eq(rsvpTable.participantId, dup.id));
      for (const r of dupRsvps) {
        const [targetRsvpMatch] = await db
          .select()
          .from(rsvpTable)
          .where(and(
            eq(rsvpTable.participantId, target.id),
            eq(rsvpTable.trackName, r.trackName),
            eq(rsvpTable.sessionName, r.sessionName)
          ));
        if (targetRsvpMatch) {
          await db.delete(rsvpTable).where(eq(rsvpTable.id, r.id));
          console.log(`  Deleted duplicate RSVP ID ${r.id}`);
        } else {
          await db
            .update(rsvpTable)
            .set({ participantId: target.id })
            .where(eq(rsvpTable.id, r.id));
          console.log(`  Moved RSVP ID ${r.id} to target`);
        }
      }

      // Reassign personal details
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
        } else {
          await db
            .update(personalDetailsTable)
            .set({ participantId: target.id })
            .where(eq(personalDetailsTable.id, dupPd.id));
        }
      }

      // Delete duplicate participant
      await db.delete(participantsTable).where(eq(participantsTable.id, dup.id));
      console.log(`Deleted duplicate participant profile ID ${dup.id} (${dup.registrationNumber}) successfully.`);
    }

    console.log("\nMerge operation completed successfully.");
    process.exit(0);
  } catch (err: any) {
    console.error("Failed to execute manual merge:", err.message);
    process.exit(1);
  }
}

// Helper to replace drizzle standard imports
import { inArray } from "drizzle-orm";

run();
