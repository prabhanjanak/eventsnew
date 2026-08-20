import { Router } from "express";
import { eq, count, sql, and, or } from "drizzle-orm";
import { db, participantsTable, attendanceLogsTable, uploadedFilesTable, foodLogsTable, foodSessionsTable, submissionSettingsTable, activityLogsTable, assignmentsTable, systemUsersTable, rsvpTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import * as xlsx from "xlsx";

const router = Router();

// GET /dashboard/stats
router.get("/dashboard/stats", requireAuth(["admin", "super_admin", "event_coordinator", "track_coordinator", "scientific_committee", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
  const hasEventFilter = eventIdParam && !isNaN(eventIdParam);

  const priorConditions = [eq(participantsTable.isOnSpot, false)];
  const onSpotConditions = [
    eq(participantsTable.isOnSpot, true),
    eq(participantsTable.isOnSpotLinked, true)
  ];

  if (hasEventFilter) {
    priorConditions.push(eq(participantsTable.eventId, eventIdParam));
    onSpotConditions.push(eq(participantsTable.eventId, eventIdParam));
  }

  const [priorRegs] = await db
    .select({ count: count() })
    .from(participantsTable)
    .where(and(...priorConditions));

  const [onSpotRegs] = await db
    .select({ count: count() })
    .from(participantsTable)
    .where(and(...onSpotConditions));

  const totalRegsCount = (priorRegs?.count ?? 0) + (onSpotRegs?.count ?? 0);

  // Attendance count
  const attConditions = [];
  if (hasEventFilter) {
    attConditions.push(eq(attendanceLogsTable.eventId, eventIdParam));
  }
  const [totalAttendance] = attConditions.length > 0
    ? await db.select({ count: count() }).from(attendanceLogsTable).where(and(...attConditions))
    : await db.select({ count: count() }).from(attendanceLogsTable);

  // Food stats per session
  const foodSessionConditions = [];
  if (hasEventFilter) {
    foodSessionConditions.push(eq(foodSessionsTable.eventId, eventIdParam));
  }

  const foodStats = await db
    .select({
      sessionName: foodSessionsTable.name,
      mealType: foodSessionsTable.name,
      servedCount: count(foodLogsTable.id),
    })
    .from(foodSessionsTable)
    .leftJoin(foodLogsTable, eq(foodLogsTable.foodSessionId, foodSessionsTable.id))
    .where(foodSessionConditions.length > 0 ? and(...foodSessionConditions) : undefined)
    .groupBy(foodSessionsTable.id, foodSessionsTable.name);

  // Role breakdown for event
  const roleConditions = [];
  if (hasEventFilter) {
    roleConditions.push(eq(participantsTable.eventId, eventIdParam));
  }
  const roleBreakdown = await db
    .select({
      role: participantsTable.delegateType,
      count: count(),
    })
    .from(participantsTable)
    .where(roleConditions.length > 0 ? and(...roleConditions) : undefined)
    .groupBy(participantsTable.delegateType);

  // Paid vs Unpaid breakdown
  const [paidCount] = await db
    .select({ count: count() })
    .from(participantsTable)
    .where(
      hasEventFilter
        ? and(eq(participantsTable.eventId, eventIdParam), eq(participantsTable.isPaid, true))
        : eq(participantsTable.isPaid, true)
    );

  res.json({
    totalRegistrations: totalRegsCount,
    priorRegistrations: priorRegs?.count ?? 0,
    onSpotRegistrations: onSpotRegs?.count ?? 0,
    totalAttendance: totalAttendance?.count ?? 0,
    paidCount: paidCount?.count ?? 0,
    foodStats: foodStats.map((s) => ({ sessionName: s.sessionName, mealType: s.mealType, servedCount: Number(s.servedCount) })),
    roleBreakdown: roleBreakdown.map((r) => ({ role: r.role || "Delegate", count: Number(r.count) })),
    trackBreakdown: [],
    sessionStats: [],
  });
});

// GET /dashboard/recent-activity
router.get("/dashboard/recent-activity", requireAuth(["admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(activityLogsTable)
    .orderBy(sql`${activityLogsTable.timestamp} desc`)
    .limit(20);
  res.json(
    logs.map((l) => ({
      id: l.id,
      type: l.type,
      message: l.message,
      timestamp: l.timestamp.toISOString(),
    }))
  );
});

// GET /dashboard/logs - Detailed Super Admin Logs Panel
router.get("/dashboard/logs", requireAuth(["admin", "super_admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  try {
    // 1. Fetch Backend logs
    const backend = await db
      .select()
      .from(activityLogsTable)
      .orderBy(sql`${activityLogsTable.timestamp} desc`)
      .limit(150);

    // 2. Fetch Attendance and Food scanning logs
    const attLogs = await db
      .select({
        id: attendanceLogsTable.id,
        timestamp: attendanceLogsTable.scannedAt,
        day: attendanceLogsTable.day,
        participantName: participantsTable.name,
        registrationNumber: participantsTable.registrationNumber,
        coordinatorName: systemUsersTable.name,
      })
      .from(attendanceLogsTable)
      .innerJoin(participantsTable, eq(attendanceLogsTable.participantId, participantsTable.id))
      .leftJoin(systemUsersTable, eq(attendanceLogsTable.scannedBy, systemUsersTable.id))
      .orderBy(sql`${attendanceLogsTable.scannedAt} desc`)
      .limit(100);

    const foodLogs = await db
      .select({
        id: foodLogsTable.id,
        timestamp: foodLogsTable.collectedAt,
        sessionName: foodSessionsTable.name,
        participantName: participantsTable.name,
        registrationNumber: participantsTable.registrationNumber,
        coordinatorName: systemUsersTable.name,
      })
      .from(foodLogsTable)
      .innerJoin(participantsTable, eq(foodLogsTable.participantId, participantsTable.id))
      .innerJoin(foodSessionsTable, eq(foodLogsTable.foodSessionId, foodSessionsTable.id))
      .leftJoin(systemUsersTable, eq(foodLogsTable.coordinatorId, systemUsersTable.id))
      .orderBy(sql`${foodLogsTable.collectedAt} desc`)
      .limit(100);

    // Merge scanning logs and sort by timestamp
    const scanning = [
      ...attLogs.map((a) => ({
        id: `att-${a.id}`,
        type: "attendance",
        timestamp: a.timestamp.toISOString(),
        participantName: a.participantName,
        registrationNumber: a.registrationNumber,
        details: `Attendance marked for ${a.day}`,
        coordinatorName: a.coordinatorName || "Self Scanner",
      })),
      ...foodLogs.map((f) => ({
        id: `food-${f.id}`,
        type: "food",
        timestamp: f.timestamp.toISOString(),
        participantName: f.participantName,
        registrationNumber: f.registrationNumber,
        details: `Food token redeemed for ${f.sessionName}`,
        coordinatorName: f.coordinatorName || "Catering Desk",
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 150);

    // 3. Fetch Upload logs
    const uploads = await db
      .select({
        id: uploadedFilesTable.id,
        filename: uploadedFilesTable.filename,
        originalName: uploadedFilesTable.originalName,
        fileType: uploadedFilesTable.fileType,
        size: uploadedFilesTable.size,
        version: uploadedFilesTable.version,
        uploadedAt: uploadedFilesTable.uploadedAt,
        participantName: participantsTable.name,
        registrationNumber: participantsTable.registrationNumber,
        role: assignmentsTable.role,
        presentationTitle: assignmentsTable.presentationTitle,
      })
      .from(uploadedFilesTable)
      .innerJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
      .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
      .orderBy(sql`${uploadedFilesTable.uploadedAt} desc`)
      .limit(100);

    res.json({
      backend: backend.map((b) => ({
        id: b.id,
        type: b.type,
        message: b.message,
        timestamp: b.timestamp.toISOString(),
      })),
      scanning,
      uploads: uploads.map((u) => ({
        id: u.id,
        filename: u.filename,
        originalName: u.originalName,
        fileType: u.fileType,
        size: u.size,
        version: u.version,
        timestamp: u.uploadedAt.toISOString(),
        participantName: u.participantName,
        registrationNumber: u.registrationNumber,
        role: u.role,
        presentationTitle: u.presentationTitle || "No title",
      })),
    });
  } catch (error: any) {
    console.error("[LOGS FETCH ERROR]", error);
    res.status(500).json({ error: "Failed to fetch log statistics" });
  }
});

// GET /dashboard/public-live-stats
router.get("/dashboard/public-live-stats", async (_req, res): Promise<void> => {
  try {
    const [totalAttendance] = await db.select({ count: count() }).from(attendanceLogsTable);
    const [totalFoodScans] = await db.select({ count: count() }).from(foodLogsTable);

    const foodSessions = await db
      .select({
        id: foodSessionsTable.id,
        name: foodSessionsTable.name,
        date: foodSessionsTable.date,
        startTime: foodSessionsTable.startTime,
        endTime: foodSessionsTable.endTime,
        scansCount: count(foodLogsTable.id),
      })
      .from(foodSessionsTable)
      .leftJoin(foodLogsTable, eq(foodLogsTable.foodSessionId, foodSessionsTable.id))
      .groupBy(foodSessionsTable.id, foodSessionsTable.name, foodSessionsTable.date, foodSessionsTable.startTime, foodSessionsTable.endTime);

    const [settings] = await db.select({ liveTvUrl: submissionSettingsTable.liveTvUrl }).from(submissionSettingsTable).limit(1);

    const rsvpCounts = await db
      .select({
        trackName: rsvpTable.trackName,
        sessionDate: rsvpTable.sessionDate,
        sessionTime: rsvpTable.sessionTime,
        sessionName: rsvpTable.sessionName,
        count: count(rsvpTable.id),
      })
      .from(rsvpTable)
      .groupBy(rsvpTable.trackName, rsvpTable.sessionDate, rsvpTable.sessionTime, rsvpTable.sessionName);

    const sessions = await db
      .select({
        track: assignmentsTable.track,
        sessionName: assignmentsTable.sessionName,
        date: assignmentsTable.date,
        time: assignmentsTable.time,
        hall: assignmentsTable.hall,
      })
      .from(assignmentsTable)
      .groupBy(
        assignmentsTable.track,
        assignmentsTable.sessionName,
        assignmentsTable.date,
        assignmentsTable.time,
        assignmentsTable.hall
      );

    const rsvpMap = new Map<string, number>();
    for (const r of rsvpCounts) {
      const key = `${normalizeTrackName(r.trackName)}||${(r.sessionName || "").trim()}||${(r.sessionDate || "").trim()}`;
      rsvpMap.set(key, Number(r.count));
    }

    const sessionStats = [];
    for (const s of sessions) {
      if (!s.track || !s.sessionName) continue;
      const key = `${normalizeTrackName(s.track)}||${s.sessionName.trim()}||${(s.date || "").trim()}`;
      const rsvpCount = rsvpMap.get(key) || 0;
      
      const { hallName, capacity } = getHallInfo(s.track, s.hall);
      
      sessionStats.push({
        track: s.track,
        sessionName: s.sessionName,
        date: s.date || "Day 1",
        time: s.time || "TBD",
        hall: hallName || "Main Hall",
        capacity,
        rsvpCount,
        availableSeats: Math.max(0, capacity - rsvpCount),
      });
    }

    res.json({
      totalAttendance: totalAttendance?.count ?? 0,
      totalFoodScans: totalFoodScans?.count ?? 0,
      foodSessions: foodSessions.map((s) => ({
        id: s.id,
        name: s.name,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        scansCount: Number(s.scansCount),
      })),
      liveTvUrl: settings?.liveTvUrl || null,
      sessionStats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load public live stats" });
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export function normalizeTrackName(t: string): string {
  if (!t) return "";
  const trim = t.trim();
  if (trim === "Track 1" || trim === "Track 01") return "Track 01";
  if (trim === "Track 2" || trim === "Track 02") return "Track 02";
  if (trim === "Track 3" || trim === "Track 03") return "Track 03";
  if (trim === "Track 4" || trim === "Track 04") return "Track 04";
  if (trim === "Track 5 Hall A" || trim === "Track 5.1") return "Track 5.1";
  if (trim === "Track 5 Hall B" || trim === "Track 5.2") return "Track 5.2";
  if (trim === "Poster Exhibition" || trim === "e-Posters Hall-A" || trim === "Poster Hall A" || trim === "e-Posters Hall A" || trim.includes("Poster Hall A") || trim.includes("Posters Hall-A")) return "e-Posters Hall-A";
  if (trim === "e-Posters Hall-B" || trim === "Poster Hall B" || trim === "e-Posters Hall B" || trim.includes("Poster Hall B") || trim.includes("Posters Hall-B")) return "e-Posters Hall-B";
  return trim;
}

export function getHallInfo(track: string, dbHall: string | null) {
  const normTrack = normalizeTrackName(track);
  
  let hallName = dbHall || "";
  if (!hallName) {
    if (normTrack === "Track 01") hallName = "Nethravathi Hall";
    else if (normTrack === "Track 02") hallName = "Hemavathi Hall";
    else if (normTrack === "Track 03") hallName = "Arkavathi Hall";
    else if (normTrack === "Track 04") hallName = "Vedavathi Hall";
    else if (normTrack === "Track 5.1") hallName = "Tunga Hall";
    else if (normTrack === "Track 5.2") hallName = "Bhadra Hall";
    else if (normTrack === "e-Posters Hall-A") hallName = "Ghataprabha Hall";
    else if (normTrack === "e-Posters Hall-B") hallName = "Malaprabha Hall";
  }
  
  const lower = hallName.toLowerCase();
  let capacity = 50; // Default capacity
  if (lower.includes("kaveri")) capacity = 750;
  else if (lower.includes("nethravathi") || lower.includes("netravathi")) capacity = 275;
  else if (lower.includes("vedavathi")) capacity = 150;
  else if (lower.includes("arkavathi")) capacity = 100;
  else if (lower.includes("hemavathi")) capacity = 80;
  else if (lower.includes("tunga")) capacity = 50;
  else if (lower.includes("bhadra") || lower.includes("badra")) capacity = 50;
  else if (lower.includes("varahi")) capacity = 50;
  else if (lower.includes("ghataprabha")) capacity = 50;
  else if (lower.includes("malaprabha")) capacity = 50;
  
  return { hallName, capacity };
}

// GET /dashboard/export-rsvps
router.get("/dashboard/export-rsvps", requireAuth(["admin", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  try {
    const rsvpCounts = await db
      .select({
        trackName: rsvpTable.trackName,
        sessionDate: rsvpTable.sessionDate,
        sessionTime: rsvpTable.sessionTime,
        sessionName: rsvpTable.sessionName,
        count: count(rsvpTable.id),
      })
      .from(rsvpTable)
      .groupBy(rsvpTable.trackName, rsvpTable.sessionDate, rsvpTable.sessionTime, rsvpTable.sessionName);

    const sessions = await db
      .select({
        track: assignmentsTable.track,
        sessionName: assignmentsTable.sessionName,
        date: assignmentsTable.date,
        time: assignmentsTable.time,
        hall: assignmentsTable.hall,
      })
      .from(assignmentsTable)
      .groupBy(
        assignmentsTable.track,
        assignmentsTable.sessionName,
        assignmentsTable.date,
        assignmentsTable.time,
        assignmentsTable.hall
      );

    const rsvpMap = new Map<string, number>();
    for (const r of rsvpCounts) {
      const key = `${normalizeTrackName(r.trackName)}||${(r.sessionName || "").trim()}||${(r.sessionDate || "").trim()}`;
      rsvpMap.set(key, Number(r.count));
    }

    const rows = [];
    for (const s of sessions) {
      if (!s.track || !s.sessionName) continue;
      const key = `${normalizeTrackName(s.track)}||${s.sessionName.trim()}||${(s.date || "").trim()}`;
      const rsvpCount = rsvpMap.get(key) || 0;
      
      const { hallName, capacity } = getHallInfo(s.track, s.hall);
      
      rows.push({
        "Date": s.date || "Day 1",
        "Time": s.time || "TBD",
        "Track": s.track,
        "Session Name": s.sessionName,
        "Hall Location": hallName || "Main Hall",
        "Capacity": capacity,
        "RSVP Count": rsvpCount,
        "Available Seats": Math.max(0, capacity - rsvpCount),
      });
    }

    // Sort by Date, Time, Track
    rows.sort((a, b) => {
      const dateCompare = a.Date.localeCompare(b.Date);
      if (dateCompare !== 0) return dateCompare;
      return a.Time.localeCompare(b.Time);
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 45 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
    ];

    xlsx.utils.book_append_sheet(wb, ws, "Session RSVPs");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="session_rsvps_${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to export RSVPs" });
  }
});

// POST /dashboard/reset-rsvps
router.post("/dashboard/reset-rsvps", requireAuth(["super_admin"]), async (_req, res): Promise<void> => {
  try {
    await db.delete(rsvpTable);
    res.json({ success: true, message: "All RSVPs have been reset successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset RSVPs" });
  }
});

export default router;
