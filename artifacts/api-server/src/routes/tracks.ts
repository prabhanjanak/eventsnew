import { Router } from "express";
import { eq, ilike, and, count } from "drizzle-orm";
import { db, participantsTable, assignmentsTable, uploadedFilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { ListTrackParticipantsQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /tracks
router.get("/tracks", requireAuth(["admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  const tracks = await db
    .select({
      track: assignmentsTable.track,
      participantCount: count(assignmentsTable.participantId),
    })
    .from(assignmentsTable)
    .groupBy(assignmentsTable.track)
    .orderBy(assignmentsTable.track);

  const sessionCounts = await db
    .selectDistinctOn([assignmentsTable.track, assignmentsTable.sessionName], {
      track: assignmentsTable.track,
      sessionName: assignmentsTable.sessionName,
    })
    .from(assignmentsTable);

  const sessionsByTrack: Record<string, Set<string>> = {};
  for (const row of sessionCounts) {
    if (row.sessionName) {
      if (!sessionsByTrack[row.track]) sessionsByTrack[row.track] = new Set();
      sessionsByTrack[row.track].add(row.sessionName);
    }
  }

  res.json(
    tracks.map((t) => ({
      name: t.track,
      participantCount: Number(t.participantCount),
      sessionCount: sessionsByTrack[t.track]?.size ?? 0,
    }))
  );
});

// GET /track-participants
router.get("/track-participants", requireAuth(["admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const parsed = ListTrackParticipantsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { trackName, search, session, role } = parsed.data;

  // Track coordinators can only see their assigned track
  const user = req.user!;
  if (user.userType === "track_coordinator" && user.assignedTrack && user.assignedTrack !== trackName) {
    res.status(403).json({ error: "You can only view your assigned track" });
    return;
  }

  const conditions = [ilike(assignmentsTable.track, `%${trackName}%`)];
  if (session) conditions.push(ilike(assignmentsTable.sessionName!, `%${session}%`));
  if (role) conditions.push(eq(assignmentsTable.role, role));
  if (search) {
    conditions.push(
      ilike(participantsTable.name, `%${search}%`)
    );
  }

  const rows = await db
    .select({
      participantId: participantsTable.id,
      registrationNumber: participantsTable.registrationNumber,
      name: participantsTable.name,
      institution: participantsTable.institution,
      assignmentId: assignmentsTable.id,
      role: assignmentsTable.role,
      sessionName: assignmentsTable.sessionName,
      hall: assignmentsTable.hall,
      date: assignmentsTable.date,
      time: assignmentsTable.time,
      presentationTitle: assignmentsTable.presentationTitle,
    })
    .from(assignmentsTable)
    .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .where(and(...conditions))
    .orderBy(participantsTable.name);

  const result = await Promise.all(
    rows.map(async (r) => {
      const [file] = await db
        .select({ id: uploadedFilesTable.id })
        .from(uploadedFilesTable)
        .where(eq(uploadedFilesTable.assignmentId, r.assignmentId))
        .limit(1);
      return {
        participantId: r.participantId,
        registrationNumber: r.registrationNumber,
        name: r.name,
        institution: r.institution,
        role: r.role,
        sessionName: r.sessionName,
        hall: r.hall,
        date: r.date,
        time: r.time,
        presentationTitle: r.presentationTitle,
        hasFile: !!file,
        fileId: file?.id ?? null,
      };
    })
  );

  res.json(result);
});

export default router;
