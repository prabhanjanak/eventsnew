import { db, assignmentsTable, uploadedFilesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

async function mergeDuplicateAssignments() {
  console.log("Starting duplicate assignments merge...");

  try {
    const allAssignments = await db.select().from(assignmentsTable);
    console.log(`Found ${allAssignments.length} total assignments in the database.`);

    // Group assignments by participantId
    const participantAssignments = new Map<number, typeof allAssignments>();
    for (const a of allAssignments) {
      if (!participantAssignments.has(a.participantId)) {
        participantAssignments.set(a.participantId, []);
      }
      participantAssignments.get(a.participantId)!.push(a);
    }

    let deletedCount = 0;
    let fileMovedCount = 0;

    for (const [participantId, list] of participantAssignments.entries()) {
      // Group by normalized assignment key
      // Key format: role|track|sessionName|date|time|presentationTitle
      const groups = new Map<string, typeof list>();
      for (const a of list) {
        const role = (a.role || "").trim().toLowerCase();
        const track = (a.track || "").trim().toLowerCase();
        const sessionName = (a.sessionName || "").trim().toLowerCase();
        const date = (a.date || "").trim().toLowerCase();
        const time = (a.time || "").trim().toLowerCase();
        const presentationTitle = (a.presentationTitle || "").trim().toLowerCase();

        const key = `${role}|${track}|${sessionName}|${date}|${time}|${presentationTitle}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(a);
      }

      for (const [key, groupList] of groups.entries()) {
        if (groupList.length < 2) continue;

        // Sort by ID to keep the oldest assignment
        groupList.sort((a, b) => a.id - b.id);
        const target = groupList[0];
        const duplicates = groupList.slice(1);

        console.log(`\nDeduplicating group for Participant ID ${participantId}: "${key}"`);
        console.log(`  Keeping target assignment ID: ${target.id}`);

        for (const dup of duplicates) {
          console.log(`  Processing duplicate assignment ID: ${dup.id}`);

          // 1. Find if there are any uploaded files associated with this duplicate assignment
          const files = await db
            .select()
            .from(uploadedFilesTable)
            .where(eq(uploadedFilesTable.assignmentId, dup.id));

          for (const f of files) {
            // Re-assign the file to the target assignment
            // Note: We'll also update version numbers on the target to avoid version conflicts if necessary,
            // but for simplicity, we can let it be or increment it based on target's existing files.
            const targetFiles = await db
              .select()
              .from(uploadedFilesTable)
              .where(eq(uploadedFilesTable.assignmentId, target.id));
            const newVersion = targetFiles.length + 1;

            await db
              .update(uploadedFilesTable)
              .set({
                assignmentId: target.id,
                version: newVersion,
              })
              .where(eq(uploadedFilesTable.id, f.id));

            console.log(`    Moved uploaded file ID ${f.id} to target assignment, set version to V${newVersion}`);
            fileMovedCount++;
          }

          // 2. Delete the duplicate assignment
          await db
            .delete(assignmentsTable)
            .where(eq(assignmentsTable.id, dup.id));

          console.log(`    Deleted duplicate assignment ID ${dup.id}`);
          deletedCount++;
        }
      }
    }

    console.log(`\nMerge Complete!`);
    console.log(`Deleted duplicate assignments: ${deletedCount}`);
    console.log(`Moved uploaded files: ${fileMovedCount}`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to merge duplicate assignments:", err);
    process.exit(1);
  }
}

mergeDuplicateAssignments();
