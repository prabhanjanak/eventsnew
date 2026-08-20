import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

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
