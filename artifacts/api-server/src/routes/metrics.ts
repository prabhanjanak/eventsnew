import { Router } from "express";
import { db, activeSessionsTable, attendanceLogsTable, foodLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isNull, gt, and, gte } from "drizzle-orm";

const router = Router();

// ── In-Memory Ring-Buffer Metrics ────────────────────────────────────────────
const SLOT_SIZE_MS = 10_000; // 10-second slots
const HISTORY_SLOTS = 30;    // 30 slots = 5 minutes of history

interface Slot {
  ts: number;          // start timestamp of this slot
  requests: number;    // total requests in this slot
  errors: number;      // 4xx/5xx responses
  scans: number;       // attendance + food scans in this slot
}

const slots: Slot[] = [];
let currentSlot: Slot = { ts: slotStart(), requests: 0, errors: 0, scans: 0 };

function slotStart(now = Date.now()): number {
  return Math.floor(now / SLOT_SIZE_MS) * SLOT_SIZE_MS;
}

function getOrCreateCurrentSlot(): Slot {
  const ts = slotStart();
  if (currentSlot.ts !== ts) {
    // Archive finished slot
    slots.push({ ...currentSlot });
    if (slots.length > HISTORY_SLOTS) slots.shift();
    currentSlot = { ts, requests: 0, errors: 0, scans: 0 };
  }
  return currentSlot;
}

/** Express middleware — call this in app.ts before all routes */
export function requestCounterMiddleware(req: any, res: any, next: any) {
  getOrCreateCurrentSlot().requests++;
  const origEnd = res.end.bind(res);
  res.end = function (...args: any[]) {
    if (res.statusCode >= 400) {
      getOrCreateCurrentSlot().errors++;
    }
    return origEnd(...args);
  };
  next();
}

/** Call this whenever a scan happens (attendance or food) */
export function recordScanEvent() {
  getOrCreateCurrentSlot().scans++;
}

// ── GET /metrics/traffic ─────────────────────────────────────────────────────
router.get("/metrics/traffic", requireAuth(["super_admin"]), async (_req, res): Promise<void> => {
  // Ensure current slot is in the history view
  getOrCreateCurrentSlot();

  const allSlots = [...slots, currentSlot];

  // Rolling 60-second window (last 6 slots)
  const last6 = allSlots.slice(-6);
  const requestsPerMinute = last6.reduce((a, s) => a + s.requests, 0);
  const scansPerMinute = last6.reduce((a, s) => a + s.scans, 0);
  const errorCount = last6.reduce((a, s) => a + s.errors, 0);
  const totalReqs = last6.reduce((a, s) => a + s.requests, 0);
  const errorRate = totalReqs > 0 ? Math.round((errorCount / totalReqs) * 100) : 0;

  // Active sessions count from DB
  const now = new Date();
  const activeSessions = await db
    .select({ id: activeSessionsTable.id })
    .from(activeSessionsTable)
    .where(and(
      isNull(activeSessionsTable.revokedAt),
      gt(activeSessionsTable.expiresAt, now)
    ));

  // History: last 30 slots (each 10s)
  const history = allSlots.map(s => ({
    ts: s.ts,
    requests: s.requests,
    errors: s.errors,
    scans: s.scans,
  }));

  res.json({
    requestsPerMinute,
    scansPerMinute,
    errorRate,
    activeSessionsCount: activeSessions.length,
    history,
    slotSizeMs: SLOT_SIZE_MS,
  });
});

export default router;
