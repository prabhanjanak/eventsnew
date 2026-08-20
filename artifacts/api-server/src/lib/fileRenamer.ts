import path from "path";
import fs from "fs";
import { db, assignmentsTable, uploadedFilesTable, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function sanitizePathSegment(val: string | null | undefined, fallback: string): string {
  if (!val) return fallback;
  return val
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findWorkspaceRoot(): string {
  let startDir = process.cwd();
  try {
    if (typeof __dirname !== "undefined") {
      startDir = __dirname;
    }
  } catch (e) {
    // ignore
  }
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

const uploadsDir = path.resolve(findWorkspaceRoot(), "artifacts/api-server/uploads");

/**
 * Re-evaluates and renames all uploaded files for a given assignment based on current
 * database values for the assignment and its participant.
 */
export async function handleFileRenamingForAssignment(assignmentId: number): Promise<void> {
  try {
    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId));

    if (!assignment) {
      console.warn(`[RENAMER] Assignment not found for ID ${assignmentId}`);
      return;
    }

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, assignment.participantId));

    if (!participant) {
      console.warn(`[RENAMER] Participant not found for ID ${assignment.participantId}`);
      return;
    }

    const files = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.assignmentId, assignmentId));

    if (files.length === 0) {
      return;
    }

    const dateFolder = sanitizePathSegment(assignment.date, "No-Date");
    const trackFolder = sanitizePathSegment(assignment.track, "No-Track");
    const sessionFolder = sanitizePathSegment(assignment.sessionName, "No-Session");
    const timeFolder = sanitizePathSegment(assignment.time, "No-Time");
    const roleFolder = sanitizePathSegment(assignment.role, "No-Role");
    const regNum = sanitizePathSegment(participant.registrationNumber, "REGXXX");

    const relativeDir = path.join(dateFolder, trackFolder, sessionFolder, timeFolder);
    const targetDir = path.join(uploadsDir, relativeDir);

    for (const file of files) {
      const standardFilename = `${dateFolder}_${trackFolder}_${sessionFolder}_${timeFolder}_${roleFolder}_${regNum}_V${file.version}.${file.fileType}`;
      const newDbFilename = `${dateFolder}/${trackFolder}/${sessionFolder}/${timeFolder}/${standardFilename}`;

      if (file.filename !== newDbFilename) {
        const oldPath = path.join(uploadsDir, file.filename);
        const newPath = path.join(targetDir, standardFilename);

        console.log(`[RENAMER] Renaming file from ${file.filename} to ${newDbFilename}`);

        if (fs.existsSync(oldPath)) {
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.renameSync(oldPath, newPath);
        } else {
          console.warn(`[RENAMER] Physical file not found on disk at: ${oldPath}`);
        }

        await db
          .update(uploadedFilesTable)
          .set({ filename: newDbFilename })
          .where(eq(uploadedFilesTable.id, file.id));
      }
    }
  } catch (error) {
    console.error(`[RENAMER] Error renaming files for assignment ${assignmentId}:`, error);
  }
}
