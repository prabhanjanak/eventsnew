import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  participantsTable,
  attendanceLogsTable,
  goodiesLogsTable,
  foodLogsTable,
  foodSessionsTable,
  activityLogsTable,
  systemUsersTable,
  eventsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { sendRegistrationWelcomeWhatsapp, sendAttendanceScannedWhatsapp, sendFoodScannedWhatsapp } from "../lib/mailer";

const router = Router();

function hasPermission(user: { userType: string; id: number }, permissions: string[], action: string): boolean {
  if (user.userType === "admin" || user.userType === "super_admin" || user.userType === "event_coordinator") return true;
  return permissions.includes(action);
}

function formatScanParticipant(participant: any, event?: any) {
  return {
    id: participant.id,
    eventId: participant.eventId,
    name: participant.name,
    registrationNumber: participant.registrationNumber,
    institution: participant.institution,
    designation: participant.designation,
    isPaid: participant.isPaid,
    approvalStatus: participant.approvalStatus,
    isSponsored: participant.isSponsored,
    sponsorType: participant.sponsorType,
    delegateType: participant.delegateType,
    event: event ? {
      id: event.id,
      title: event.title,
      slug: event.slug,
      eventType: event.eventType,
    } : null,
  };
}

// POST /scan/qr
// Body: { registrationNumber, action: "attendance" | "goodies" | "food", foodSessionId?: number }
router.post("/scan/qr", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  if (user.userType === "participant") {
    res.status(403).json({ error: "Participants cannot use this endpoint" });
    return;
  }

  const { registrationNumber, action, foodSessionId, day } = req.body as {
    registrationNumber?: string;
    action?: string;
    foodSessionId?: number;
    day?: string;
  };

  if (!registrationNumber || !action) {
    res.status(400).json({ error: "registrationNumber and action are required" });
    return;
  }

  // Get user permissions from DB
  let userPermissions: string[] = [];
  if (user.userType !== "admin" && user.userType !== "super_admin") {
    const [sysUser] = await db
      .select({ permissions: systemUsersTable.permissions })
      .from(systemUsersTable)
      .where(eq(systemUsersTable.id, user.id));
    userPermissions = sysUser?.permissions ?? [];
  }

  // Check permission
  if (!hasPermission(user, userPermissions, action)) {
    res.status(403).json({ error: `You do not have permission to perform: ${action}` });
    return;
  }

  // Lookup participant
  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, registrationNumber.toUpperCase()));

  if (!participant) {
    // If not found in participants, check if this is a staff / system user
    let searchEmpId = registrationNumber.toUpperCase();
    if (searchEmpId.startsWith("STAFF-")) {
      searchEmpId = searchEmpId.substring(6);
    }

    const [systemUser] = await db
      .select()
      .from(systemUsersTable)
      .where(eq(systemUsersTable.empId, searchEmpId));

    if (systemUser) {
      if (action !== "attendance") {
        res.json({
          success: false,
          status: "not_found",
          message: `${action.toUpperCase()} scans are not available for Team Sankara Staff.`
        });
        return;
      }

      // Log check-in in activityLogsTable
      await db.insert(activityLogsTable).values({
        type: "attendance",
        message: `Staff scanned at attendance counter: ${systemUser.name} (${systemUser.empId})`,
      });

      res.json({
        success: true,
        status: "marked",
        action: "attendance",
        message: `Team Sankara Staff Check-in Logged`,
        participant: {
          id: -systemUser.id,
          name: systemUser.name,
          registrationNumber: `STAFF-${systemUser.empId}`,
          institution: "Team Sankara Staff",
          isPaid: true,
          delegateType: "staff",
          isSponsored: false,
          sponsorType: null,
          email: systemUser.email || "",
          mobile: systemUser.mobile || "",
          createdAt: systemUser.createdAt.toISOString(),
          isActive: true
        }
      });
      return;
    }

    res.json({ success: false, status: "not_found", message: "Participant not found" });
    return;
  }

  // Load participant's event
  let event = null;
  if (participant.eventId) {
    [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, participant.eventId));
  }

  // Coordinator event authorization check
  if (user.userType !== "admin" && user.userType !== "super_admin") {
    const [sysUser] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, user.id));
    const assigned = (sysUser?.assignedEventIds as number[]) || [];
    if (participant.eventId && assigned.length > 0 && !assigned.includes(participant.eventId)) {
      res.status(403).json({
        success: false,
        status: "unauthorized_event",
        message: "You are not authorized to scan delegates for this event.",
        participant: formatScanParticipant(participant, event),
      });
      return;
    }
  }

  // Enforce On-Spot assignments check
  const isOS = participant.isOnSpot || participant.registrationNumber.toUpperCase().includes("-OS");
  if (isOS) {
    if (!participant.isOnSpotLinked || participant.name === "On Spot Slot" || participant.mobile?.startsWith("OS")) {
      res.json({
        success: false,
        status: "not_linked",
        message: "This card is invalid. It has not been registered/linked at the registration desk yet.",
        participant: formatScanParticipant(participant, event)
      });
      return;
    }
    if (!participant.isOnSpotOnboarded || participant.institution === "On Spot Slot Assigned") {
      res.json({
        success: false,
        status: "not_onboarded",
        message: "Participant profile onboarding is pending. Details must be submitted first.",
        participant: formatScanParticipant(participant, event)
      });
      return;
    }
  }

  // Helper to determine the current conference day
  const getCurrentConferenceDay = (): string => {
    return "Day 1";
  };

  if (action === "attendance") {
    const targetDay = day || getCurrentConferenceDay();
    const [existing] = await db
      .select()
      .from(attendanceLogsTable)
      .where(and(
        eq(attendanceLogsTable.participantId, participant.id),
        eq(attendanceLogsTable.day, targetDay)
      ));

    if (existing) {
      res.json({
        success: false,
        status: "already_marked",
        action: "attendance",
        message: `Attendance already marked for ${targetDay}`,
        participant: formatScanParticipant(participant, event)
      });
      return;
    }

    try {
      await db.insert(attendanceLogsTable).values({ 
        eventId: participant.eventId || undefined,
        participantId: participant.id, 
        scannedBy: user.id,
        day: targetDay
      });
      
      if (participant.mobile) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const dateStr = `${dd}-${mm}-${yyyy}`;

        sendRegistrationWelcomeWhatsapp(participant.mobile, participant.name, participant.registrationNumber).catch(() => {});
        sendAttendanceScannedWhatsapp(participant.mobile, participant.name, timeStr, dateStr).catch(() => {});
      }

      db.insert(activityLogsTable).values({
        type: "attendance",
        message: `Attendance marked (${targetDay}): ${participant.name} (${participant.registrationNumber})`,
      }).catch(() => {});

      res.json({
        success: true,
        status: "marked",
        action: "attendance",
        message: `Attendance marked successfully for ${targetDay}`,
        participant: formatScanParticipant(participant, event)
      });
    } catch (err: any) {
      const isDuplicate = String(err?.code) === "23505" || String(err?.message).includes("unique");
      if (isDuplicate) {
        res.json({
          success: false,
          status: "already_marked",
          action: "attendance",
          message: `Attendance already marked for ${targetDay} (duplicate scan blocked)`,
          participant: formatScanParticipant(participant, event)
        });
      } else {
        throw err;
      }
    }
    return;
  }

  if (action === "goodies") {
    const [existing] = await db
      .select()
      .from(goodiesLogsTable)
      .where(eq(goodiesLogsTable.participantId, participant.id));
    if (existing) {
      res.json({
        success: false,
        status: "already_collected",
        action: "goodies",
        message: "Goodies already collected",
        collectedAt: existing.scannedAt.toISOString(),
        participant: formatScanParticipant(participant)
      });
      return;
    }
    try {
      await db.insert(goodiesLogsTable).values({ participantId: participant.id, scannedBy: user.id });
      db.insert(activityLogsTable).values({
        type: "goodies",
        message: `Goodies collected: ${participant.name} (${participant.registrationNumber})`,
      }).catch(() => {});
      res.json({
        success: true,
        status: "collected",
        action: "goodies",
        message: "Goodies / Reg Kit collected",
        participant: formatScanParticipant(participant)
      });
    } catch (err: any) {
      const isDuplicate = String(err?.code) === "23505" || String(err?.message).includes("unique");
      if (isDuplicate) {
        res.json({
          success: false,
          status: "already_collected",
          action: "goodies",
          message: "Goodies already collected (duplicate scan blocked)",
          participant: formatScanParticipant(participant)
        });
      } else {
        throw err;
      }
    }
    return;
  }

  if (action === "food") {
    if (!foodSessionId) {
      res.status(400).json({ error: "foodSessionId is required for food action" });
      return;
    }
    const [session] = await db.select().from(foodSessionsTable).where(eq(foodSessionsTable.id, foodSessionId));
    if (!session || !session.enabled) {
      res.json({ success: false, status: "session_closed", action: "food", message: "Food session is not active" });
      return;
    }

    // Strict Food Coupon Validation against Attendance
    const dayMatch = session.name.match(/Day\s*\d+/i);
    if (dayMatch) {
      const sessionDay = dayMatch[0];
      const [attendance] = await db
        .select()
        .from(attendanceLogsTable)
        .where(and(
          eq(attendanceLogsTable.participantId, participant.id),
          eq(attendanceLogsTable.day, sessionDay)
        ));
      if (!attendance) {
        res.json({
          success: false,
          status: "attendance_required",
          action: "food",
          message: `Attendance for ${sessionDay} is required before scanning food coupons!`
        });
        return;
      }
    }

    const [existing] = await db
      .select()
      .from(foodLogsTable)
      .where(and(eq(foodLogsTable.participantId, participant.id), eq(foodLogsTable.foodSessionId, foodSessionId)));
    if (existing) {
      res.json({
        success: false,
        status: "already_collected",
        action: "food",
        message: "Food already collected for this session",
        participant: formatScanParticipant(participant, event)
      });
      return;
    }
    try {
      await db.insert(foodLogsTable).values({ 
        eventId: participant.eventId || undefined,
        participantId: participant.id, 
        foodSessionId, 
        coordinatorId: user.id 
      });
      
      if (participant.mobile) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const dateStr = `${dd}-${mm}-${yyyy}`;

        sendFoodScannedWhatsapp(participant.mobile, participant.name, session.name, timeStr, dateStr).catch(() => {});
      }

      db.insert(activityLogsTable).values({
        type: "food",
        message: `Food issued: ${participant.name} (${participant.registrationNumber}) - ${session.name}`,
      }).catch(() => {});
      res.json({
        success: true,
        status: "issued",
        action: "food",
        message: `Food issued for ${session.name}`,
        participant: formatScanParticipant(participant, event)
      });
    } catch (err: any) {
      const isDuplicate = String(err?.code) === "23505" || String(err?.message).includes("unique");
      if (isDuplicate) {
        res.json({
          success: false,
          status: "already_collected",
          action: "food",
          message: "Food already collected for this session (duplicate scan blocked)",
          participant: formatScanParticipant(participant, event)
        });
      } else {
        throw err;
      }
    }
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
});

export default router;
