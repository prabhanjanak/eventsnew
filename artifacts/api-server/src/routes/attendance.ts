import { Router } from "express";
import { eq, or, ilike, and } from "drizzle-orm";
import { db, participantsTable, attendanceLogsTable, activityLogsTable, systemUsersTable, goodiesLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { ScanAttendanceBody, ListAttendanceLogsQueryParams } from "@workspace/api-zod";
import * as XLSX from "xlsx";
import { sendAttendanceScannedWhatsapp, sendRegistrationWelcomeWhatsapp } from "../lib/mailer";

const router = Router();

// POST /attendance/scan
router.post("/attendance/scan", requireAuth(["admin", "super_admin", "food_coordinator"]), async (req, res): Promise<void> => {
  const parsed = ScanAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { registrationNumber } = parsed.data;

  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, registrationNumber));

  if (!participant) {
    res.json({ success: false, message: "Participant not found", participant: null });
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

  // Helper to determine the current conference day based on local India time
  const getCurrentConferenceDay = (): string => {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const dayVal = istTime.getUTCDate();
    const month = istTime.getUTCMonth() + 1;
    const year = istTime.getUTCFullYear();

    if (month === 7 && year === 2026) {
      if (dayVal === 10) return "Day 0";
      if (dayVal === 11) return "Day 1";
      if (dayVal === 12) return "Day 2";
    }
    return "Day 1";
  };

  const targetDay = req.body.day || getCurrentConferenceDay();

  // Check if attendance already marked for the target day
  const [existing] = await db
    .select()
    .from(attendanceLogsTable)
    .where(and(
      eq(attendanceLogsTable.participantId, participant.id),
      eq(attendanceLogsTable.day, targetDay)
    ));

  if (existing) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date(existing.scannedAt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const day = pad(d.getDate());
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${pad(hours)}:${minutes} ${ampm}`;
    const formatted = `${day}-${month}-${year} ${timeStr}`;

    const [goodiesLog] = await db
      .select()
      .from(goodiesLogsTable)
      .where(eq(goodiesLogsTable.participantId, participant.id));

    res.json({
      success: false,
      message: `Attendance already marked for ${targetDay} on ${formatted}`,
      goodiesCollected: !!goodiesLog,
      participant: {
        id: participant.id,
        registrationNumber: participant.registrationNumber,
        name: participant.name,
        email: participant.email,
        mobile: participant.mobile,
        institution: participant.institution,
        createdAt: participant.createdAt.toISOString(),
        hasPassword: !!participant.passwordHash,
        isPaid: participant.isPaid,
        isSponsored: participant.isSponsored,
        sponsorType: participant.sponsorType,
        delegateType: participant.delegateType,
        utrNumber: participant.utrNumber,
      },
    });
    return;
  }

  const scannedBy = req.user?.id;
  await db.insert(attendanceLogsTable).values({ participantId: participant.id, scannedBy, day: targetDay });
  await db.insert(activityLogsTable).values({
    type: "attendance",
    message: `Attendance marked (${targetDay}): ${participant.name} (${participant.registrationNumber})`,
  });

  if (participant.mobile) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;
    sendRegistrationWelcomeWhatsapp(participant.mobile, participant.name, participant.registrationNumber)
      .catch((err) => console.error("[WHATSAPP] Failed to send registration welcome message:", err.message));
    sendAttendanceScannedWhatsapp(participant.mobile, participant.name, timeStr, dateStr)
      .catch((err) => console.error("[WHATSAPP] Failed to send attendance scan message:", err.message));
  }

  const [goodiesLog] = await db
    .select()
    .from(goodiesLogsTable)
    .where(eq(goodiesLogsTable.participantId, participant.id));

  res.json({
    success: true,
    message: "Attendance recorded successfully",
    goodiesCollected: !!goodiesLog,
    participant: {
      id: participant.id,
      registrationNumber: participant.registrationNumber,
      name: participant.name,
      email: participant.email,
      mobile: participant.mobile,
      institution: participant.institution,
      createdAt: participant.createdAt.toISOString(),
      hasPassword: !!participant.passwordHash,
      isPaid: participant.isPaid,
      isSponsored: participant.isSponsored,
      sponsorType: participant.sponsorType,
      delegateType: participant.delegateType,
      utrNumber: participant.utrNumber,
    },
  });
});

// GET /attendance/logs
router.get("/attendance/logs", requireAuth(["admin", "super_admin", "food_coordinator", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const parsed = ListAttendanceLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search } = parsed.data;
  const conditions = [];

  const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
  if (eventIdParam && !isNaN(eventIdParam)) {
    conditions.push(eq(attendanceLogsTable.eventId, eventIdParam));
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
      id: attendanceLogsTable.id,
      participantId: attendanceLogsTable.participantId,
      participantName: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      institution: participantsTable.institution,
      scannedAt: attendanceLogsTable.scannedAt,
    })
    .from(attendanceLogsTable)
    .innerJoin(participantsTable, eq(attendanceLogsTable.participantId, participantsTable.id))
    .orderBy(attendanceLogsTable.scannedAt)
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
      institution: l.institution,
      scannedAt: l.scannedAt.toISOString(),
    }))
  );
});

// GET /attendance/export
router.get("/attendance/export", requireAuth(["admin", "food_coordinator", "coordinator_view_only"]), async (req, res): Promise<void> => {
  try {
    const logs = await db
      .select({
        registrationNumber: participantsTable.registrationNumber,
        participantName: participantsTable.name,
        email: participantsTable.email,
        mobile: participantsTable.mobile,
        institution: participantsTable.institution,
        scannedAt: attendanceLogsTable.scannedAt,
        scannedBy: systemUsersTable.name,
      })
      .from(attendanceLogsTable)
      .innerJoin(participantsTable, eq(attendanceLogsTable.participantId, participantsTable.id))
      .leftJoin(systemUsersTable, eq(attendanceLogsTable.scannedBy, systemUsersTable.id))
      .orderBy(attendanceLogsTable.scannedAt);

    const exportData = logs.map((l, index) => ({
      "S.No": index + 1,
      "Registration Number": l.registrationNumber,
      "Participant Name": l.participantName,
      "Email": l.email,
      "Mobile": l.mobile,
      "Institution": l.institution,
      "Scanned At": l.scannedAt ? new Date(l.scannedAt).toLocaleString("en-IN") : "—",
      "Scanned By": l.scannedBy || "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Logs");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="attendance_logs_${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to export attendance logs" });
  }
});

// DELETE /attendance/logs — ADMIN ONLY
router.delete("/attendance/logs", requireAuth(["admin"]), async (req, res): Promise<void> => {
  try {
    await db.delete(attendanceLogsTable);
    await db.insert(activityLogsTable).values({
      type: "attendance",
      message: `All attendance logs cleared by admin (ID: ${req.user?.id})`,
    });
    res.json({ success: true, message: "All attendance logs cleared successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear attendance logs" });
  }
});

// DELETE /attendance/logs/:id — ADMIN ONLY
router.delete("/attendance/logs/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid log entry ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(attendanceLogsTable)
      .where(eq(attendanceLogsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Attendance log entry not found" });
      return;
    }

    await db.insert(activityLogsTable).values({
      type: "attendance",
      message: `Specific attendance log entry ID ${id} deleted by admin (ID: ${req.user?.id})`,
    });
    res.json({ success: true, message: "Attendance log entry deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete log entry" });
  }
});

export default router;
