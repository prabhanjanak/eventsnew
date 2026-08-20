import { db, uploadedFilesTable, assignmentsTable, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const uploads = await db
    .select({
      id: uploadedFilesTable.id,
      assignmentId: uploadedFilesTable.assignmentId,
      filename: uploadedFilesTable.filename,
      originalName: uploadedFilesTable.originalName,
      fileType: uploadedFilesTable.fileType,
      version: uploadedFilesTable.version,
      participantName: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
    })
    .from(uploadedFilesTable)
    .innerJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
    .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id));

  console.log("--- UPLOADED FILES IN DATABASE ---");
  console.log(JSON.stringify(uploads, null, 2));
  console.log("Total rows in table:", uploads.length);
}

main().catch(console.error);
