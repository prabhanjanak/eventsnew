import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Live Server Date & Time (synced to IST) ──────────────────────────────────
router.get("/time", (_req, res) => {
  const now = new Date();
  const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const istFormattedDate = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const istTimeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  res.json({
    iso: now.toISOString(),
    epoch: now.getTime(),
    todayDate: istDateStr, // e.g. "2026-09-15"
    formattedDate: istFormattedDate, // e.g. "Tuesday, 15 September 2026"
    timeString: istTimeStr, // e.g. "10:10:00 AM"
    timeZone: "Asia/Kolkata",
  });
});

router.get("/healthz", async (_req, res) => {
  try {
    // 1. Try a simple database query to test connection
    const dbTest = await db.execute(sql`SELECT NOW()`);
    
    // 2. Query participant and system user counts
    const participantCountResult = await db.execute(sql`SELECT COUNT(*) FROM participants`);
    const systemUserCountResult = await db.execute(sql`SELECT COUNT(*) FROM system_users`);
    
    const participantsCount = parseInt(participantCountResult.rows[0]?.count as string || "0");
    const systemUsersCount = parseInt(systemUserCountResult.rows[0]?.count as string || "0");

    // 3. Check table accessibility
    const sampleParticipant = await db.execute(sql`SELECT id, name FROM participants LIMIT 1`);
    const sampleSystemUser = await db.execute(sql`SELECT id, name FROM system_users LIMIT 1`);

    res.json({
      status: "ok",
      database: {
        connected: true,
        timestamp: dbTest.rows[0]?.now,
        participants: {
          count: participantsCount,
          sampleAccessible: sampleParticipant.rows.length >= 0 ? "yes" : "no"
        },
        systemUsers: {
          count: systemUsersCount,
          sampleAccessible: sampleSystemUser.rows.length >= 0 ? "yes" : "no"
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: {
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint
      },
      env: {
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        DATABASE_URL_STARTS_WITH: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 15) : "none",
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      }
    });
  }
});

export default router;
