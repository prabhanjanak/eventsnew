import { Router } from "express";
import { db, assignmentsTable, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Conference canonical dates
// Day 0 = 10-07-2026  |  Day 1 = 11-07-2026  |  Day 2 = 12-07-2026
function normalizeDate(raw: string | null): { dayKey: string; displayDate: string } | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();

  // Day 0/1/2 label
  if (s.includes("day 0") || s.includes("day0") || s === "0") {
    return { dayKey: "Day 0", displayDate: "10-07-2026  (Pre-conference)" };
  }
  if (s.includes("day 1") || s.includes("day1") || s === "1") {
    return { dayKey: "Day 1", displayDate: "11-07-2026" };
  }
  if (s.includes("day 2") || s.includes("day2") || s === "2") {
    return { dayKey: "Day 2", displayDate: "12-07-2026" };
  }

  // If contains "10" and either "jul" or "/07" or "-07"
  if (s.includes("10") && (s.includes("jul") || s.includes("07") || s.includes("/7") || s.includes("-7"))) {
    return { dayKey: "Day 0", displayDate: "10-07-2026  (Pre-conference)" };
  }
  if (s.includes("11") && (s.includes("jul") || s.includes("07") || s.includes("/7") || s.includes("-7"))) {
    return { dayKey: "Day 1", displayDate: "11-07-2026" };
  }
  if (s.includes("12") && (s.includes("jul") || s.includes("07") || s.includes("/7") || s.includes("-7"))) {
    return { dayKey: "Day 2", displayDate: "12-07-2026" };
  }

  // Fallback pattern matching for numbers
  const digits = s.match(/\d+/g);
  if (digits && digits.length > 0) {
    const firstNum = parseInt(digits[0], 10);
    if (firstNum === 10) return { dayKey: "Day 0", displayDate: "10-07-2026  (Pre-conference)" };
    if (firstNum === 11) return { dayKey: "Day 1", displayDate: "11-07-2026" };
    if (firstNum === 12) return { dayKey: "Day 2", displayDate: "12-07-2026" };
  }

  return null;
}

// Parse "HH:MM-HH:MM" → duration in minutes
function durationMinutes(timeStr: string): number {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  const start = parseInt(m[1]) * 60 + parseInt(m[2]);
  const end   = parseInt(m[3]) * 60 + parseInt(m[4]);
  return end - start;
}

// Parse start time "HH:MM" → minutes from midnight
function startMinutes(timeStr: string): number {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

// GET /timetable — public, no auth required
router.get("/timetable", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        participantName: participantsTable.name,
        role: assignmentsTable.role,
        track: assignmentsTable.track,
        sessionName: assignmentsTable.sessionName,
        hall: assignmentsTable.hall,
        date: assignmentsTable.date,
        time: assignmentsTable.time,
        presentationTitle: assignmentsTable.presentationTitle,
      })
      .from(assignmentsTable)
      .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
      .orderBy(assignmentsTable.date, assignmentsTable.time, assignmentsTable.track, assignmentsTable.sessionName);

    const VALID_TRACKS = ["Track 1", "Track 2", "Track 3", "Track 4", "Track 5 Hall A", "Track 5 Hall B"];

    // ── Session accumulator ─────────────────────────────────────────────────
    // dayKey → track → sessionKey → SessionEntry
    type SessionEntry = {
      sessionName: string;
      sessionCode?: string;
      hall: string | null;
      displayTime: string;      // widest time slot
      displayTimeDuration: number;
      speakers: Array<{ name: string; role: string; title: string | null; time?: string }>;
      seenSpeakers: Set<string>; // "name|role" for dedup
    };

    const sessionAcc: Record<string, Record<string, Record<string, SessionEntry>>> = {};
    const posterMap: Map<string, { title: string; presenter: string; time: string; date: string }> = new Map();

    for (const row of rows) {
      const rawTrack = (row.track || "").trim();
      const rawTime  = (row.time  || "").trim();
      const rawDate  = row.date;
      const role     = (row.role  || "").trim();

      if (!rawTrack || rawTrack === "General" || rawTrack === "TBD") {
        if (role === "Poster" && row.presentationTitle) {
          const title = (row.presentationTitle || "").trim();
          if (title && !posterMap.has(title)) {
            posterMap.set(title, {
              title,
              presenter: row.participantName,
              time: rawTime,
              date: rawDate || "",
            });
          }
        }
        continue;
      }
      if (!rawTime || rawTime === "TBD") continue;

      const dateInfo = normalizeDate(rawDate);
      if (!dateInfo) continue;

      if (role === "Poster") {
        const title = (row.presentationTitle || "").trim();
        if (title && !posterMap.has(title)) {
          posterMap.set(title, {
            title,
            presenter: row.participantName,
            time: rawTime,
            date: rawDate || "",
          });
        }
        continue;
      }

      let track = rawTrack;
      const lt  = rawTrack.toLowerCase();
      if      (lt.includes("track 1")) track = "Track 1";
      else if (lt.includes("track 2")) track = "Track 2";
      else if (lt.includes("track 3")) track = "Track 3";
      else if (lt.includes("track 4")) track = "Track 4";
      else if (lt.includes("track 5")) track = "Track 5 Raw";
      else continue;

      const { dayKey } = dateInfo;

      if (!sessionAcc[dayKey]) sessionAcc[dayKey] = {};
      if (!sessionAcc[dayKey][track]) sessionAcc[dayKey][track] = {};

      const sessionParts = (row.sessionName || "").split('::');
      const sessionCode = sessionParts.length > 1 ? sessionParts[0].trim() : "";
      const sessionTitle = sessionParts.length > 1 ? sessionParts.slice(1).join('::').trim() : sessionParts[0].trim();

      const sessionKey = (sessionTitle || `${role} Session`).trim();

      if (!sessionAcc[dayKey][track][sessionKey]) {
        sessionAcc[dayKey][track][sessionKey] = {
          sessionName: sessionKey,
          sessionCode: sessionCode,
          hall: row.hall || null,
          displayTime: rawTime,
          displayTimeDuration: durationMinutes(rawTime),
          speakers: [],
          seenSpeakers: new Set(),
        };
      }

      const entry = sessionAcc[dayKey][track][sessionKey];
      const dur = durationMinutes(rawTime);
      if (dur > entry.displayTimeDuration) {
        entry.displayTime = rawTime;
        entry.displayTimeDuration = dur;
      }

      const speakerKey = `${row.participantName}|${role}`;
      if (!entry.seenSpeakers.has(speakerKey)) {
        entry.seenSpeakers.add(speakerKey);
        entry.speakers.push({
          name: row.participantName,
          role,
          title: row.presentationTitle || null,
          time: rawTime,
        });
      }
    }

    // ── Build dayMap: dayKey → displayTime → track → SessionItem[] ─────────
    const dayMap: Record<string, Record<string, Record<string, any[]>>> = {};

    for (const dayKey of Object.keys(sessionAcc)) {
      if (!dayMap[dayKey]) dayMap[dayKey] = {};

      for (const track of Object.keys(sessionAcc[dayKey])) {
        // Skip Track 5 Raw — we will process it separately
        if (track === "Track 5 Raw") continue;

        for (const sessionKey of Object.keys(sessionAcc[dayKey][track])) {
          const entry = sessionAcc[dayKey][track][sessionKey];
          const time  = entry.displayTime;

          if (!dayMap[dayKey][time]) dayMap[dayKey][time] = {};
          if (!dayMap[dayKey][time][track]) dayMap[dayKey][time][track] = [];

          dayMap[dayKey][time][track].push({
            sessionName: entry.sessionName,
            sessionCode: entry.sessionCode,
            hall: entry.hall,
            speakers: entry.speakers,
          });
        }
      }
    }

    // ── Split Track 5 Raw per time slot ────────────────────────────────────
    for (const dayKey of Object.keys(sessionAcc)) {
      const rawTrack5 = sessionAcc[dayKey]["Track 5 Raw"];
      if (!rawTrack5) continue;

      // Group Track 5 Raw sessions by displayTime
      const timeGroup: Record<string, SessionEntry[]> = {};
      for (const sessionKey of Object.keys(rawTrack5)) {
        const entry = rawTrack5[sessionKey];
        const time = entry.displayTime;
        if (!timeGroup[time]) timeGroup[time] = [];
        timeGroup[time].push(entry);
      }

      // At each time slot, sort sessions alphabetically and split:
      // Even index → Track 5 Hall A, Odd index → Track 5 Hall B
      for (const time of Object.keys(timeGroup)) {
        const sorted = timeGroup[time].sort((a, b) => a.sessionName.localeCompare(b.sessionName));
        if (!dayMap[dayKey]) dayMap[dayKey] = {};
        if (!dayMap[dayKey][time]) dayMap[dayKey][time] = {};

        sorted.forEach((entry, idx) => {
          const targetTrack = idx % 2 === 0 ? "Track 5 Hall A" : "Track 5 Hall B";
          if (!dayMap[dayKey][time][targetTrack]) dayMap[dayKey][time][targetTrack] = [];

          dayMap[dayKey][time][targetTrack].push({
            sessionName: entry.sessionName,
            sessionCode: entry.sessionCode,
            hall: entry.hall,
            speakers: entry.speakers,
          });
        });
      }
    }

    // ── Canonical day order ─────────────────────────────────────────────────
    const DAY_ORDER = ["Day 0", "Day 1", "Day 2"];
    const DAY_DISPLAY: Record<string, string> = {
      "Day 0": "10-07-2026  (Pre-conference)",
      "Day 1": "11-07-2026",
      "Day 2": "12-07-2026",
    };

    const regularTracks = [...new Set(
      Object.values(dayMap).flatMap(d =>
        Object.values(d).flatMap(t => Object.keys(t))
      )
    )].filter(t => VALID_TRACKS.includes(t))
      .sort((a, b) => VALID_TRACKS.indexOf(a) - VALID_TRACKS.indexOf(b));

    const posters = [...posterMap.values()]
      .sort((a, b) => a.title.localeCompare(b.title));

    const days = DAY_ORDER
      .filter(dayKey => dayMap[dayKey])
      .map(dayKey => {
        const timeMap = dayMap[dayKey] || {};

        const timeSlots = Object.keys(timeMap)
          .sort((a, b) => startMinutes(a) - startMinutes(b))
          .map(time => ({
            time,
            sessions: regularTracks.map(track => ({
              track,
              items: timeMap[time]?.[track] || [],
            })),
          }));

        return {
          date: DAY_DISPLAY[dayKey] || dayKey,
          dayKey,
          timeSlots,
        };
      });

    res.json({
      tracks: regularTracks,
      days,
      posters,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load timetable" });
  }
});

export default router;
