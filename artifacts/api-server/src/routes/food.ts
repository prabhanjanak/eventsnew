import { Router } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, foodSessionsTable, foodLogsTable, participantsTable, systemUsersTable, activityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  CreateFoodSessionBody,
  UpdateFoodSessionParams,
  UpdateFoodSessionBody,
  DeleteFoodSessionParams,
  ToggleFoodSessionParams,
  ToggleFoodSessionBody,
  ScanFoodQRBody,
  ListFoodLogsQueryParams,
} from "@workspace/api-zod";
import * as XLSX from "xlsx";
import { sendFoodScannedWhatsapp } from "../lib/mailer";

const router = Router();

// GET /food-sessions
router.get("/food-sessions", requireAuth(), async (req, res): Promise<void> => {
  const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
  const conditions = [];
  if (eventIdParam && !isNaN(eventIdParam)) {
    conditions.push(eq(foodSessionsTable.eventId, eventIdParam));
  }

  const query = conditions.length > 0
    ? db.select().from(foodSessionsTable).where(and(...conditions)).orderBy(foodSessionsTable.date)
    : db.select().from(foodSessionsTable).orderBy(foodSessionsTable.date);

  const sessions = await query;
  res.json(sessions.map((s) => ({
    id: s.id,
    eventId: s.eventId,
    name: s.name,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    enabled: s.enabled,
    createdAt: s.createdAt.toISOString(),
  })));
});

// POST /food-sessions
router.post("/food-sessions", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateFoodSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const eventIdParam = req.body.eventId ? Number(req.body.eventId) : undefined;
  const [session] = await db.insert(foodSessionsTable).values({
    ...parsed.data,
    eventId: eventIdParam,
  }).returning();

  res.status(201).json({
    id: session.id,
    eventId: session.eventId,
    name: session.name,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    enabled: session.enabled,
    createdAt: session.createdAt.toISOString(),
  });
});

// PATCH /food-sessions/:id
router.patch("/food-sessions/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = UpdateFoodSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFoodSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .update(foodSessionsTable)
    .set(parsed.data)
    .where(eq(foodSessionsTable.id, params.data.id))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Food session not found" });
    return;
  }
  res.json({ id: session.id, name: session.name, date: session.date, startTime: session.startTime, endTime: session.endTime, enabled: session.enabled, createdAt: session.createdAt.toISOString() });
});

// DELETE /food-sessions/:id
router.delete("/food-sessions/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteFoodSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(foodSessionsTable).where(eq(foodSessionsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Food session not found" });
    return;
  }
  res.sendStatus(204);
});

// POST /food-sessions/:id/toggle
router.post("/food-sessions/:id/toggle", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = ToggleFoodSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ToggleFoodSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .update(foodSessionsTable)
    .set({ enabled: parsed.data.enabled })
    .where(eq(foodSessionsTable.id, params.data.id))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Food session not found" });
    return;
  }
  res.json({ id: session.id, name: session.name, date: session.date, startTime: session.startTime, endTime: session.endTime, enabled: session.enabled, createdAt: session.createdAt.toISOString() });
});

// POST /food/scan
router.post("/food/scan", requireAuth(["admin", "food_coordinator"]), async (req, res): Promise<void> => {
  const parsed = ScanFoodQRBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { registrationNumber, foodSessionId } = parsed.data;

  // Find participant
  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, registrationNumber));
  if (!participant) {
    res.json({ success: false, message: "Participant not found", status: "not_found", participant: null });
    return;
  }

  // Enforce On-Spot assignments check
  const isOS = participant.isOnSpot || participant.registrationNumber.toUpperCase().includes("-OS");
  if (isOS) {
    if (!participant.isOnSpotLinked || participant.name === "On Spot Slot" || participant.mobile?.startsWith("OS")) {
      res.json({
        success: false,
        status: "not_linked",
        message: "This card is invalid. It has not been registered/linked at the registration desk yet.",
        participant: null
      });
      return;
    }
    if (!participant.isOnSpotOnboarded || participant.institution === "On Spot Slot Assigned") {
      res.json({
        success: false,
        status: "not_onboarded",
        message: "Participant profile onboarding is pending. Details must be submitted first.",
        participant: null
      });
      return;
    }
  }

  // Check session exists and is enabled
  const [session] = await db.select().from(foodSessionsTable).where(eq(foodSessionsTable.id, foodSessionId));
  if (!session || !session.enabled) {
    res.json({ success: false, message: "Food session is not active", status: "session_closed", participant: null });
    return;
  }

  // Check if already collected
  const [existing] = await db
    .select()
    .from(foodLogsTable)
    .where(and(eq(foodLogsTable.participantId, participant.id), eq(foodLogsTable.foodSessionId, foodSessionId)));
  if (existing) {
    res.json({ success: false, message: "Food already collected for this session", status: "already_collected", participant: {
      id: participant.id,
      registrationNumber: participant.registrationNumber,
      name: participant.name,
      email: participant.email || "",
      mobile: participant.mobile || "",
      institution: participant.institution,
      createdAt: participant.createdAt.toISOString(),
      hasPassword: !!participant.passwordHash,
      isPaid: participant.isPaid,
      isSponsored: participant.isSponsored,
      sponsorType: participant.sponsorType,
      delegateType: participant.delegateType,
      utrNumber: participant.utrNumber,
    }});
    return;
  }

  const coordinatorId = req.user?.userType !== "participant" ? req.user?.id : undefined;
  await db.insert(foodLogsTable).values({ participantId: participant.id, foodSessionId, coordinatorId });
  await db.insert(activityLogsTable).values({
    type: "food",
    message: `Food issued to ${participant.name} (${participant.registrationNumber}) - ${session.name}`,
  });

  if (participant.mobile) {
    let mealType = "Meal";
    const sessionLower = session.name.toLowerCase();
    if (sessionLower.includes("breakfast")) {
      mealType = "Breakfast";
    } else if (sessionLower.includes("lunch")) {
      mealType = "Lunch";
    } else if (sessionLower.includes("dinner")) {
      mealType = "Dinner";
    } else if (sessionLower.includes("snack") || sessionLower.includes("tea")) {
      mealType = "Snacks & Tea";
    } else {
      mealType = session.name;
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;
    sendFoodScannedWhatsapp(participant.mobile, participant.name, mealType, timeStr, dateStr)
      .catch((err) => console.error("[WHATSAPP] Failed to send food scan message:", err.message));
  }

  res.json({
    success: true,
    message: "Food issued successfully",
    status: "issued",
    participant: {
      id: participant.id,
      registrationNumber: participant.registrationNumber,
      name: participant.name,
      email: participant.email || "",
      mobile: participant.mobile || "",
      institution: participant.institution,
      createdAt: participant.createdAt.toISOString(),
      hasPassword: !!participant.passwordHash,
      isPaid: participant.isPaid,
      isSponsored: participant.isSponsored,
      sponsorType: participant.sponsorType,
      delegateType: participant.delegateType,
      utrNumber: participant.utrNumber,
    }
  });
});

// GET /food/logs
router.get("/food/logs", requireAuth(["admin", "food_coordinator", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const parsed = ListFoodLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { foodSessionId, search } = parsed.data;
  const conditions = [];

  const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
  if (eventIdParam && !isNaN(eventIdParam)) {
    conditions.push(or(eq(foodLogsTable.eventId, eventIdParam), eq(foodSessionsTable.eventId, eventIdParam), eq(participantsTable.eventId, eventIdParam)));
  }

  if (foodSessionId) {
    conditions.push(eq(foodLogsTable.foodSessionId, foodSessionId));
  }
  if (search) {
    conditions.push(
      or(
        ilike(participantsTable.name, `%${search}%`),
        ilike(participantsTable.registrationNumber, `%${search}%`)
      )
    );
  }

  let query = db
    .select({
      id: foodLogsTable.id,
      participantId: foodLogsTable.participantId,
      participantName: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      foodSessionId: foodLogsTable.foodSessionId,
      foodSessionName: foodSessionsTable.name,
      coordinatorName: systemUsersTable.name,
      collectedAt: foodLogsTable.collectedAt,
    })
    .from(foodLogsTable)
    .innerJoin(participantsTable, eq(foodLogsTable.participantId, participantsTable.id))
    .innerJoin(foodSessionsTable, eq(foodLogsTable.foodSessionId, foodSessionsTable.id))
    .leftJoin(systemUsersTable, eq(foodLogsTable.coordinatorId, systemUsersTable.id))
    .orderBy(foodLogsTable.collectedAt)
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const result = await query;

  res.json(
    result.map((l) => ({
      id: l.id,
      participantId: l.participantId,
      participantName: l.participantName,
      registrationNumber: l.registrationNumber,
      foodSessionId: l.foodSessionId,
      foodSessionName: l.foodSessionName,
      coordinatorName: l.coordinatorName,
      collectedAt: l.collectedAt.toISOString(),
    }))
  );
});

// GET /food/export
router.get("/food/export", requireAuth(["admin", "food_coordinator", "coordinator_view_only"]), async (req, res): Promise<void> => {
  try {
    const logs = await db
      .select({
        registrationNumber: participantsTable.registrationNumber,
        participantName: participantsTable.name,
        email: participantsTable.email,
        mobile: participantsTable.mobile,
        institution: participantsTable.institution,
        foodSessionName: foodSessionsTable.name,
        foodSessionDate: foodSessionsTable.date,
        collectedAt: foodLogsTable.collectedAt,
        coordinatorName: systemUsersTable.name,
      })
      .from(foodLogsTable)
      .innerJoin(participantsTable, eq(foodLogsTable.participantId, participantsTable.id))
      .innerJoin(foodSessionsTable, eq(foodLogsTable.foodSessionId, foodSessionsTable.id))
      .leftJoin(systemUsersTable, eq(foodLogsTable.coordinatorId, systemUsersTable.id))
      .orderBy(foodLogsTable.collectedAt);

    // Group logs by food session name
    const workbook = XLSX.utils.book_new();
    const sessionGroups = new Map<string, typeof logs>();

    for (const log of logs) {
      const name = log.foodSessionName || "Other";
      if (!sessionGroups.has(name)) {
        sessionGroups.set(name, []);
      }
      sessionGroups.get(name)!.push(log);
    }

    if (sessionGroups.size === 0) {
      const worksheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, worksheet, "No Logs");
    } else {
      for (const [sessionName, sessionLogs] of sessionGroups.entries()) {
        const sessionExportData = sessionLogs.map((l, index) => ({
          "S.No": index + 1,
          "Registration Number": l.registrationNumber,
          "Participant Name": l.participantName,
          "Email": l.email || "",
          "Mobile": l.mobile || "",
          "Institution": l.institution,
          "Session Date": l.foodSessionDate,
          "Issued At": l.collectedAt ? new Date(l.collectedAt).toLocaleString("en-IN") : "—",
          "Issued By": l.coordinatorName || "—",
        }));

        const worksheet = XLSX.utils.json_to_sheet(sessionExportData);
        // Excel worksheet names must be <= 31 characters and cannot contain forbidden characters: \ / ? * [ ]
        const cleanSheetName = sessionName
          .replace(/[\\\/\?\*\[\]]/g, "")
          .substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);
      }
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="food_coupon_logs_${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to export food logs" });
  }
});

// DELETE /food/logs — ADMIN ONLY
router.delete("/food/logs", requireAuth(["admin"]), async (req, res): Promise<void> => {
  try {
    await db.delete(foodLogsTable);
    await db.insert(activityLogsTable).values({
      type: "food",
      message: `All food coupon logs cleared by admin (ID: ${req.user?.id})`,
    });
    res.json({ success: true, message: "All food coupon logs cleared successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear food coupon logs" });
  }
});

// DELETE /food/logs/:id — ADMIN ONLY
router.delete("/food/logs/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid log entry ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(foodLogsTable)
      .where(eq(foodLogsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Food coupon log entry not found" });
      return;
    }

    await db.insert(activityLogsTable).values({
      type: "food",
      message: `Specific food coupon log entry ID ${id} deleted by admin (ID: ${req.user?.id})`,
    });
    res.json({ success: true, message: "Food coupon log entry deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete log entry" });
  }
});

export default router;
