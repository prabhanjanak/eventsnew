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

const safeIsoDate = (d: any): string => {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  try {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? String(d) : parsed.toISOString();
  } catch {
    return String(d);
  }
};

// GET /dashboard/recent-activity
router.get("/dashboard/recent-activity", requireAuth(["super_admin", "admin", "event_coordinator", "track_coordinator", "food_coordinator", "scientific_committee", "pr_member", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  try {
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
        timestamp: safeIsoDate(l.timestamp),
      }))
    );
  } catch (error: any) {
    console.error("[RECENT ACTIVITY FETCH ERROR]", error);
    res.json([]);
  }
});

// GET /dashboard/logs - Detailed Super Admin & Staff Logs Panel
router.get("/dashboard/logs", requireAuth(["admin", "super_admin", "event_coordinator", "track_coordinator", "food_coordinator", "scientific_committee", "pr_member", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  try {
    // 1. Fetch Backend logs
    const backend = await db
      .select()
      .from(activityLogsTable)
      .orderBy(sql`${activityLogsTable.timestamp} desc`)
      .limit(150);

    // 2. Fetch Attendance scanning logs
    let attLogs: any[] = [];
    try {
      const attRes = await db.execute(sql`
        SELECT 
          a.id, 
          a.scanned_at as timestamp, 
          a.day, 
          COALESCE(a.scanned_by, 'Self Scanner') as "coordinatorName",
          p.name as "participantName", 
          p.registration_number as "registrationNumber"
        FROM attendance_logs a
        LEFT JOIN participants p ON a.participant_id = p.id
        ORDER BY a.scanned_at DESC
        LIMIT 100
      `);
      attLogs = attRes.rows || [];
    } catch (e) {
      console.warn("[ATT LOGS QUERY WARN]", e);
    }

    // 3. Fetch Food scanning logs
    let foodLogs: any[] = [];
    try {
      const foodRes = await db.execute(sql`
        SELECT 
          f.id, 
          f.scanned_at as timestamp, 
          COALESCE(f.session_name, 'Food Session') as "sessionName", 
          COALESCE(f.scanned_by, 'Catering Desk') as "coordinatorName",
          p.name as "participantName", 
          p.registration_number as "registrationNumber"
        FROM food_logs f
        LEFT JOIN participants p ON f.participant_id = p.id
        ORDER BY f.scanned_at DESC
        LIMIT 100
      `);
      foodLogs = foodRes.rows || [];
    } catch (e) {
      console.warn("[FOOD LOGS QUERY WARN]", e);
    }

    // Merge scanning logs and sort by timestamp
    const scanning = [
      ...attLogs.map((a: any) => ({
        id: `att-${a.id}`,
        type: "attendance",
        timestamp: safeIsoDate(a.timestamp),
        participantName: a.participantName || "Delegate",
        registrationNumber: a.registrationNumber || "—",
        details: `Attendance marked for ${a.day || "Day 1"}`,
        coordinatorName: a.coordinatorName || "Self Scanner",
      })),
      ...foodLogs.map((f: any) => ({
        id: `food-${f.id}`,
        type: "food",
        timestamp: safeIsoDate(f.timestamp),
        participantName: f.participantName || "Delegate",
        registrationNumber: f.registrationNumber || "—",
        details: `Food token redeemed for ${f.sessionName || "Food Session"}`,
        coordinatorName: f.coordinatorName || "Catering Desk",
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 150);

    // 4. Fetch Upload logs
    let uploads: any[] = [];
    try {
      const uploadsRes = await db.execute(sql`
        SELECT 
          u.id,
          COALESCE(u.file_name, u.stored_name, 'uploaded_file') as filename,
          COALESCE(u.original_name, u.file_name, 'file') as "originalName",
          COALESCE(u.file_type, u.mime_type, 'pptx') as "fileType",
          COALESCE(u.file_size, 0) as size,
          1 as version,
          COALESCE(u.uploaded_at, u.created_at, NOW()) as timestamp,
          COALESCE(p.name, 'Presenter') as "participantName",
          COALESCE(p.registration_number, '—') as "registrationNumber",
          'Faculty' as role,
          COALESCE(u.session_title, 'Presentation Slides') as "presentationTitle"
        FROM uploaded_files u
        LEFT JOIN participants p ON u.participant_id = p.id
        ORDER BY COALESCE(u.uploaded_at, u.created_at) DESC
        LIMIT 100
      `);
      uploads = uploadsRes.rows || [];
    } catch (e) {
      console.warn("[UPLOADS QUERY WARN]", e);
    }

    res.json({
      backend: backend.map((b) => ({
        id: b.id,
        type: b.type || "SYSTEM",
        message: b.message || "",
        timestamp: safeIsoDate(b.timestamp),
      })),
      scanning,
      uploads: uploads.map((u: any) => ({
        id: u.id,
        filename: u.filename || "",
        originalName: u.originalName || u.filename || "Uploaded File",
        fileType: u.fileType || "",
        size: Number(u.size) || 0,
        version: Number(u.version) || 1,
        timestamp: safeIsoDate(u.timestamp),
        participantName: u.participantName || "Presenter",
        registrationNumber: u.registrationNumber || "—",
        role: u.role || "Faculty",
        presentationTitle: u.presentationTitle || "Presentation Slides",
      })),
    });
  } catch (error: any) {
    console.error("[LOGS FETCH ERROR]", error);
    res.status(500).json({ error: "Failed to fetch log statistics", details: error?.message });
  }
});

// GET /dashboard/public-live-stats and /dashboard/live-stats
const handleLiveStats = async (_req: any, res: any): Promise<void> => {
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

    let sessions: any[] = [];
    try {
      sessions = await db
        .select({
          track: assignmentsTable.track,
          sessionName: assignmentsTable.sessionName,
          date: assignmentsTable.date,
          time: assignmentsTable.time,
          hall: assignmentsTable.hall,
        })
        .from(assignmentsTable);
    } catch (e: any) {
      console.warn("[LIVE STATS] assignments query warning:", e.message);
    }

    const rsvpMap = new Map<string, number>();
    for (const r of rsvpCounts) {
      const key = `${normalizeTrackName(r.trackName)}||${(r.sessionName || "").trim()}||${(r.sessionDate || "").trim()}`;
      rsvpMap.set(key, Number(r.count));
    }

    const sessionStats = [];
    const seenSessions = new Set<string>();

    for (const s of sessions) {
      if (!s.track || !s.sessionName) continue;
      const key = `${normalizeTrackName(s.track)}||${s.sessionName.trim()}||${(s.date || "").trim()}`;
      if (seenSessions.has(key)) continue;
      seenSessions.add(key);

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
};

router.get("/dashboard/public-live-stats", handleLiveStats);
router.get("/dashboard/live-stats", handleLiveStats);

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
