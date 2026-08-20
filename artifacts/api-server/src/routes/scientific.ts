import { Router } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, participantsTable, assignmentsTable, uploadedFilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { ListSubmissionsQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /scientific/submissions
router.get("/scientific/submissions", requireAuth(["admin", "scientific_committee", "track_coordinator", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const parsed = ListSubmissionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, track, role, fileType } = parsed.data;

  const rows = await db
    .select({
      participantId: participantsTable.id,
      registrationNumber: participantsTable.registrationNumber,
      name: participantsTable.name,
      institution: participantsTable.institution,
      role: assignmentsTable.role,
      track: assignmentsTable.track,
      sessionName: assignmentsTable.sessionName,
      presentationTitle: assignmentsTable.presentationTitle,
      fileId: uploadedFilesTable.id,
      filename: uploadedFilesTable.filename,
      fileType: uploadedFilesTable.fileType,
      uploadedAt: uploadedFilesTable.uploadedAt,
    })
    .from(uploadedFilesTable)
    .innerJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
    .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .orderBy(uploadedFilesTable.uploadedAt);

  let result = rows.filter((r) => r.role && !r.role.toLowerCase().includes("staff"));
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.registrationNumber.toLowerCase().includes(s) ||
        r.institution.toLowerCase().includes(s)
    );
  }
  if (track) result = result.filter((r) => r.track.toLowerCase().includes(track.toLowerCase()));
  if (role) result = result.filter((r) => r.role === role);
  if (fileType) result = result.filter((r) => r.fileType === fileType);

  res.json(
    result.map((r) => ({
      participantId: r.participantId,
      registrationNumber: r.registrationNumber,
      name: r.name,
      institution: r.institution,
      role: r.role,
      track: r.track,
      sessionName: r.sessionName,
      presentationTitle: r.presentationTitle,
      fileId: r.fileId,
      filename: r.filename,
      fileType: r.fileType,
      uploadedAt: r.uploadedAt.toISOString(),
    }))
  );
});

export default router;
