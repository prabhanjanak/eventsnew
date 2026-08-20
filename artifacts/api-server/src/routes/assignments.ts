import { Router } from "express";
import { eq, desc, or, ilike, and, sql } from "drizzle-orm";
import { db, assignmentsTable, uploadedFilesTable, participantsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { handleFileRenamingForAssignment } from "../lib/fileRenamer";
import {
  ListAssignmentsParams,
  CreateAssignmentParams,
  CreateAssignmentBody,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  DeleteAssignmentParams,
} from "@workspace/api-zod";

const router = Router();

function buildAssignment(a: typeof assignmentsTable.$inferSelect, file?: typeof uploadedFilesTable.$inferSelect | null) {
  return {
    id: a.id,
    participantId: a.participantId,
    role: a.role,
    track: a.track,
    sessionName: a.sessionName,
    hall: a.hall,
    date: a.date,
    time: a.time,
    presentationTitle: a.presentationTitle,
    fileId: file?.id ?? null,
    uploadedFile: file
      ? {
          id: file.id,
          assignmentId: file.assignmentId,
          filename: file.filename,
          originalName: file.originalName,
          fileType: file.fileType,
          version: file.version,
          size: file.size,
          uploadedAt: file.uploadedAt.toISOString(),
        }
      : null,
  };
}

// GET /assignments (Admin/Coordinators list of all assignments)
router.get(
  "/assignments",
  requireAuth(["admin", "track_coordinator", "scientific_committee"]),
  async (req, res): Promise<void> => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const track = typeof req.query.track === "string" ? req.query.track.trim() : "";
      const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
      const sessionName = typeof req.query.sessionName === "string" ? req.query.sessionName.trim() : "";
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "50", 10);
      const offset = (page - 1) * limit;

      const user = req.user!;
      const conditions = [];

      // Track coordinators can only view their assigned track
      if (user.userType === "track_coordinator" && user.assignedTrack) {
        conditions.push(eq(assignmentsTable.track, user.assignedTrack));
      } else if (track) {
        conditions.push(eq(assignmentsTable.track, track));
      }

      if (role) {
        conditions.push(eq(assignmentsTable.role, role));
      }

      if (sessionName) {
        conditions.push(ilike(assignmentsTable.sessionName, `%${sessionName}%`));
      }

      if (search) {
        conditions.push(
          or(
            ilike(participantsTable.name, `%${search}%`),
            ilike(participantsTable.registrationNumber, `%${search}%`),
            ilike(assignmentsTable.presentationTitle, `%${search}%`),
            ilike(assignmentsTable.sessionName, `%${search}%`)
          )
        );
      }

      let baseQuery = db
        .select({
          id: assignmentsTable.id,
          participantId: assignmentsTable.participantId,
          participantName: participantsTable.name,
          participantRegNum: participantsTable.registrationNumber,
          role: assignmentsTable.role,
          track: assignmentsTable.track,
          sessionName: assignmentsTable.sessionName,
          hall: assignmentsTable.hall,
          date: assignmentsTable.date,
          time: assignmentsTable.time,
          presentationTitle: assignmentsTable.presentationTitle,
        })
        .from(assignmentsTable)
        .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id));

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
      }

      // Count total matching
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(assignmentsTable)
        .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const total = Number(countResult[0]?.count || 0);

      // Fetch the paginated data
      const data = await baseQuery
        .orderBy(desc(assignmentsTable.id))
        .limit(limit)
        .offset(offset);

      // Fetch uploaded file info for each assignment
      const result = await Promise.all(
        data.map(async (a) => {
          const [file] = await db
            .select()
            .from(uploadedFilesTable)
            .where(eq(uploadedFilesTable.assignmentId, a.id))
            .orderBy(desc(uploadedFilesTable.version))
            .limit(1);

          return {
            ...a,
            uploadedFile: file
              ? {
                  id: file.id,
                  filename: file.filename,
                  originalName: file.originalName,
                  fileType: file.fileType,
                  version: file.version,
                  size: file.size,
                  uploadedAt: file.uploadedAt.toISOString(),
                }
              : null,
          };
        })
      );

      res.json({
        data: result,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch assignments" });
    }
  }
);

// GET /participants/:participantId/assignments
router.get(
  "/participants/:participantId/assignments",
  requireAuth(),
  async (req, res): Promise<void> => {
    const params = ListAssignmentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = req.user!;
    if (user.userType === "participant" && user.participantId !== params.data.participantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, params.data.participantId));

    const result = await Promise.all(
      assignments.map(async (a) => {
        const [file] = await db
          .select()
          .from(uploadedFilesTable)
          .where(eq(uploadedFilesTable.assignmentId, a.id))
          .orderBy(desc(uploadedFilesTable.version));
        return buildAssignment(a, file ?? null);
      })
    );
    res.json(result);
  }
);

// POST /participants/:participantId/assignments
router.post(
  "/participants/:participantId/assignments",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const params = CreateAssignmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [assignment] = await db
      .insert(assignmentsTable)
      .values({ participantId: params.data.participantId, ...parsed.data })
      .returning();
    res.status(201).json(buildAssignment(assignment, null));
  }
);

// PATCH /assignments/:id
router.patch(
  "/assignments/:id",
  requireAuth(["admin", "participant"]),
  async (req: any, res: any): Promise<void> => {
    const params = UpdateAssignmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existingAssignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, params.data.id));

    if (!existingAssignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    if (req.user.userType === "participant") {
      if (existingAssignment.participantId !== req.user.participantId) {
        res.status(403).json({ error: "Not authorized to modify this assignment" });
        return;
      }
      // Participants can only update presentationTitle
      const allowedData = { presentationTitle: parsed.data.presentationTitle };
      const [assignment] = await db
        .update(assignmentsTable)
        .set(allowedData)
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();
      
      await handleFileRenamingForAssignment(assignment.id);
      res.json(buildAssignment(assignment, null));
      return;
    }

    const [assignment] = await db
      .update(assignmentsTable)
      .set(parsed.data)
      .where(eq(assignmentsTable.id, params.data.id))
      .returning();
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    await handleFileRenamingForAssignment(assignment.id);
    res.json(buildAssignment(assignment, null));
  }
);

// DELETE /assignments/:id
router.delete(
  "/assignments/:id",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const params = DeleteAssignmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(assignmentsTable)
      .where(eq(assignmentsTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
