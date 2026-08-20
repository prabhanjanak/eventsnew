import { Router } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, activeSessionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /sessions/active — admin only: list all active (non-revoked, non-expired) sessions
router.get(
  "/sessions/active",
  requireAuth(["super_admin"]),
  async (_req, res): Promise<void> => {
    const now = new Date();
    // Fetch all non-revoked sessions, filter expired in JS
    const sessions = await db
      .select()
      .from(activeSessionsTable)
      .where(isNull(activeSessionsTable.revokedAt))
      .orderBy(activeSessionsTable.lastSeenAt);

    const active = sessions.filter((s) => s.expiresAt > now);

    res.json(
      active.map((s) => ({
        id: s.id,
        userId: s.userId,
        userType: s.userType,
        userName: s.userName,
        ipAddress: s.ipAddress,
        deviceType: s.deviceType,
        deviceName: s.deviceName,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      }))
    );
  }
);

// IMPORTANT: /purge-expired must be registered BEFORE /:id to avoid Express matching "purge-expired" as an id

// DELETE /sessions/purge-expired — admin only: clean up expired/revoked sessions from DB
router.delete(
  "/sessions/purge-expired",
  requireAuth(["super_admin"]),
  async (_req, res): Promise<void> => {
    const now = new Date();
    const allSessions = await db.select().from(activeSessionsTable);
    const toDelete = allSessions.filter(
      (s) => s.revokedAt !== null || s.expiresAt < now
    );

    let deleted = 0;
    for (const s of toDelete) {
      await db.delete(activeSessionsTable).where(eq(activeSessionsTable.id, s.id));
      deleted++;
    }

    res.json({ message: `Purged ${deleted} expired/revoked session(s)` });
  }
);

// DELETE /sessions/:id — admin only: force revoke a specific session
router.delete(
  "/sessions/:id",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const rawId = String(req.params["id"] ?? "");
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const [session] = await db
      .select()
      .from(activeSessionsTable)
      .where(eq(activeSessionsTable.id, id));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db
      .update(activeSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(activeSessionsTable.id, id));

    res.json({ message: "Session revoked successfully" });
  }
);

export default router;
