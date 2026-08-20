import { Router } from "express";
import { eq, or, ilike, sql, and, inArray, desc, count, ne } from "drizzle-orm";
import { db, participantsTable, assignmentsTable, uploadedFilesTable, activityLogsTable, attendanceLogsTable, goodiesLogsTable, foodSessionsTable, foodLogsTable, submissionSettingsTable, rsvpTable, syncSessionsTable, eventsTable, systemUsersTable, getCleanName } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { handleFileRenamingForAssignment } from "../lib/fileRenamer";
import { checkEmailOrMobileRegistered } from "../lib/auth";
import {
  ListParticipantsQueryParams,
  CreateParticipantBody,
  GetParticipantParams,
  UpdateParticipantParams,
  UpdateParticipantBody,
  DeleteParticipantParams,
  GetParticipantByMobileParams,
  GetParticipantQRParams,
} from "@workspace/api-zod";
import multer from "multer";
import * as xlsx from "xlsx";
import path from "path";
import QRCode from "qrcode";
import { getClientBaseUrl } from "../lib/ip-helper";
import { ZipArchive } from "archiver";
import { getGoogleAuthClient, getSpreadsheetRows, updateSpreadsheetParticipant } from "../lib/googleSheets";
import { sendRegistrationConfirmationEmail } from "../lib/mailer";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Helper to generate a unique registration number for an event
async function generateEventRegNumber(eventId?: number, eventSlug?: string): Promise<string> {
  let prefix = "EVT";
  if (eventSlug) {
    const cleanSlug = eventSlug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    prefix = cleanSlug.slice(0, 4) || "EVT";
  }
  const year = new Date().getFullYear();
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participantsTable)
    .where(eventId ? eq(participantsTable.eventId, eventId) : undefined);

  let seq = (countResult?.count || 0) + 1;
  while (true) {
    const candidate = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
    const [existing] = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, candidate));
    if (!existing) {
      return candidate;
    }
    seq++;
  }
}

// POST /events/:slugOrId/register — Public event delegate registration
router.post("/events/:slugOrId/register", async (req, res): Promise<void> => {
  try {
    const slugOrId = req.params.slugOrId.trim();
    const isNumeric = /^\d+$/.test(slugOrId);

    let event;
    if (isNumeric) {
      [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, parseInt(slugOrId, 10)));
    } else {
      [event] = await db.select().from(eventsTable).where(eq(sql`LOWER(${eventsTable.slug})`, slugOrId.toLowerCase()));
    }

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    if (!event.registrationOpen) {
      res.status(400).json({ error: "Registration for this event is currently closed" });
      return;
    }

    // Check capacity if set
    if (event.maxCapacity) {
      const [pCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(participantsTable)
        .where(eq(participantsTable.eventId, event.id));
      if ((pCount?.count || 0) >= event.maxCapacity) {
        res.status(400).json({ error: "Registration capacity full for this event" });
        return;
      }
    }

    const {
      name,
      email,
      mobile,
      institution,
      designation,
      address,
      age,
      gender,
      notes,
      couponCode,
      payment,
      tierId,
      role,
      delegateType,
    } = req.body;
    if (!name || !institution) {
      res.status(400).json({ error: "Name and Institution are required" });
      return;
    }

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanMob = mobile ? mobile.replace(/[^0-9]/g, "").slice(-10) : null;

    // Strict 10-digit mobile number validation
    if (!cleanMob || !/^[6-9]\d{9}$/.test(cleanMob)) {
      res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)." });
      return;
    }

    // Internal Staff Event Access Gate (@sankaraeye.com required)
    if (event.eventType === "internal_staff") {
      if (!cleanEmail || (!cleanEmail.endsWith("@sankaraeye.com") && !cleanEmail.endsWith("@sankaraeye.in"))) {
        res.status(403).json({
          error: "This internal event is restricted strictly to Sankara staff. Please register using your official @sankaraeye.com email address.",
        });
        return;
      }
    }

    // Strict Unique Mobile check per event (Email/Gmail can be shared across multiple participants)
    const [dup] = await db
      .select({
        name: participantsTable.name,
        registrationNumber: participantsTable.registrationNumber,
      })
      .from(participantsTable)
      .where(and(eq(participantsTable.eventId, event.id), eq(participantsTable.mobile, cleanMob)));

    if (dup) {
      res.status(400).json({
        error: `Mobile number +91 ${cleanMob} is already registered for this event under "${dup.name}" (${dup.registrationNumber}). Each attendee must use a unique mobile number.`,
        registrationNumber: dup.registrationNumber,
      });
      return;
    }

    // Resolve Multi-Role Tier & Early Bird Pricing
    const { resolvePricingTiers } = await import("./events");
    const eventTiers = resolvePricingTiers(event);
    const selectedKey = tierId || role || delegateType || "delegate";
    const matchedTier =
      eventTiers.find((t: any) => t.id === selectedKey || t.role === selectedKey) ||
      eventTiers[0] || { price: event.registrationFee, role: "delegate" };

    let baseTierPrice = event.isPaid ? matchedTier.price : 0;
    let isEarlyBirdApplied = false;

    if (event.isPaid && matchedTier && matchedTier.earlyBirdPrice !== undefined) {
      const isEarlyBirdValid = matchedTier.earlyBirdDeadline
        ? new Date(matchedTier.earlyBirdDeadline) >= new Date()
        : true;
      if (isEarlyBirdValid) {
        baseTierPrice = matchedTier.earlyBirdPrice;
        isEarlyBirdApplied = true;
      }
    }

    // Process Coupon / Promo Code if provided
    let appliedCoupon: any = null;
    let finalAmount = baseTierPrice;
    let isSponsoredTicket = false;
    let sponsorName: string | null = null;

    if (couponCode && event.isPaid) {
      const cleanCoupon = couponCode.trim().toUpperCase();
      const { eventCouponsTable } = await import("@workspace/db");
      const [foundCoupon] = await db
        .select()
        .from(eventCouponsTable)
        .where(
          and(
            eq(sql`UPPER(${eventCouponsTable.code})`, cleanCoupon),
            eq(eventCouponsTable.isActive, true),
            or(eq(eventCouponsTable.eventId, event.id), sql`${eventCouponsTable.eventId} IS NULL`)
          )
        );

      if (foundCoupon) {
        if (!foundCoupon.maxUses || foundCoupon.usedCount < foundCoupon.maxUses) {
          appliedCoupon = foundCoupon;
          if (foundCoupon.discountType === "percentage") {
            const discount = Math.round((baseTierPrice * foundCoupon.discountValue) / 100);
            finalAmount = Math.max(0, baseTierPrice - discount);
          } else if (foundCoupon.discountType === "fixed") {
            finalAmount = Math.max(0, baseTierPrice - foundCoupon.discountValue);
          } else if (foundCoupon.discountType === "sponsor_free") {
            finalAmount = 0;
            isSponsoredTicket = true;
            sponsorName = foundCoupon.sponsorName || "Industry Partner";
          }

          // Increment coupon used count
          await db
            .update(eventCouponsTable)
            .set({ usedCount: sql`${eventCouponsTable.usedCount} + 1` })
            .where(eq(eventCouponsTable.id, foundCoupon.id));
        }
      }
    }

    const regNumber = await generateEventRegNumber(event.id, event.slug);
    const requiresPayment = event.isPaid && finalAmount > 0 && !payment?.paymentId;
    const isFullyPaid = (!event.isPaid) || finalAmount === 0 || Boolean(payment?.paymentId);
    const initialApproval = event.requiresApproval ? "pending" : (requiresPayment ? "pending" : "approved");

    const resolvedRole = matchedTier?.role || delegateType || "delegate";

    const [participant] = await db
      .insert(participantsTable)
      .values({
        eventId: event.id,
        registrationNumber: regNumber,
        name: name.trim(),
        cleanName: getCleanName(name),
        email: cleanEmail,
        mobile: cleanMob,
        institution: institution.trim(),
        designation: designation ? designation.trim() : null,
        address: address ? address.trim() : null,
        age: age ? String(age).trim() : null,
        gender: gender || null,
        notes: notes
          ? `${notes} (Tier: ${matchedTier.name || resolvedRole}${isEarlyBirdApplied ? " - Early Bird" : ""}${appliedCoupon ? `, Coupon: ${appliedCoupon.code}` : ""})`
          : `Tier: ${matchedTier.name || resolvedRole}${isEarlyBirdApplied ? " - Early Bird" : ""}${appliedCoupon ? `, Coupon: ${appliedCoupon.code}` : ""}`,
        isPaid: isFullyPaid,
        paymentStatus: isFullyPaid ? (finalAmount === 0 ? "waived" : "paid") : "unpaid",
        paymentAmount: finalAmount,
        paymentId: payment?.paymentId || null,
        orderId: payment?.orderId || null,
        isSponsored: isSponsoredTicket,
        sponsorType: sponsorName,
        delegateType: resolvedRole,
        approvalStatus: initialApproval,
        approvedAt: initialApproval === "approved" ? new Date() : null,
      })
      .returning();

    await db.insert(activityLogsTable).values({
      type: "registration",
      message: `New registration for "${event.title}": ${participant.name} (${participant.registrationNumber})`,
    });

    // Send instant confirmation email via SMTP to entered email address
    if (participant.email) {
      sendRegistrationConfirmationEmail({
        toEmail: participant.email,
        participantName: participant.name,
        registrationNumber: participant.registrationNumber,
        eventTitle: event.title,
        startDate: event.startDate || new Date().toISOString().split("T")[0],
        endDate: event.endDate || event.startDate || new Date().toISOString().split("T")[0],
        venue: event.venue || "Sankara Eye Hospital",
        city: event.city || "Coimbatore",
        timeFrom: event.timeFrom,
        timeTo: event.timeTo,
        isPaid: event.isPaid,
        paymentAmount: finalAmount,
        requiresApproval: event.requiresApproval,
      }).catch((mailErr) => {
        console.warn("[MAILER] Confirmation email delivery error:", mailErr.message);
      });
    }

    res.status(201).json({
      success: true,
      participant: {
        id: participant.id,
        eventId: participant.eventId,
        name: participant.name,
        registrationNumber: participant.registrationNumber,
        email: participant.email,
        mobile: participant.mobile,
        institution: participant.institution,
        isPaid: participant.isPaid,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        approvalStatus: participant.approvalStatus,
        isSponsored: participant.isSponsored,
      },
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        isPaid: event.isPaid,
        registrationFee: event.registrationFee,
        finalAmount,
        currency: event.currency,
        requiresApproval: event.requiresApproval,
      },
      appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, discountValue: appliedCoupon.discountValue } : null,
      nextStep: requiresPayment ? "payment_required" : (event.requiresApproval ? "approval_pending" : "confirmed"),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// POST /participants/:id/approve — Coordinator/Admin approves registration
router.post(
  "/participants/:id/approve",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req, res): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid participant ID" });
        return;
      }

      const [participant] = await db.select().from(participantsTable).where(eq(participantsTable.id, id));
      if (!participant) {
        res.status(404).json({ error: "Participant not found" });
        return;
      }

      const user = req.user!;
      const [updated] = await db
        .update(participantsTable)
        .set({
          approvalStatus: "approved",
          approvedAt: new Date(),
          approvedBy: user.id,
          rejectionReason: null,
        })
        .where(eq(participantsTable.id, id))
        .returning();

      res.json({ success: true, message: "Participant approved", participant: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to approve participant" });
    }
  }
);

// POST /participants/:id/reject — Coordinator/Admin rejects registration
router.post(
  "/participants/:id/reject",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req, res): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid participant ID" });
        return;
      }

      const reason = (req.body.reason || "Application rejected by coordinator").toString();
      const [updated] = await db
        .update(participantsTable)
        .set({
          approvalStatus: "rejected",
          rejectionReason: reason,
        })
        .where(eq(participantsTable.id, id))
        .returning();

      res.json({ success: true, message: "Participant rejected", participant: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to reject participant" });
    }
  }
);

// GET /participants/public-lookup/:regNumber — public, no auth required
router.get("/participants/public-lookup/:regNumber", async (req, res): Promise<void> => {
  const regNumber = (req.params.regNumber as string)?.toUpperCase();
  if (!regNumber) {
    res.status(400).json({ error: "Registration number is required" });
    return;
  }
  const [participant] = await db
    .select({
      id: participantsTable.id,
      eventId: participantsTable.eventId,
      name: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      institution: participantsTable.institution,
      designation: participantsTable.designation,
      email: participantsTable.email,
      mobile: participantsTable.mobile,
      isPaid: participantsTable.isPaid,
      approvalStatus: participantsTable.approvalStatus,
      isOnSpot: participantsTable.isOnSpot,
      isOnSpotLinked: participantsTable.isOnSpotLinked,
      isOnSpotOnboarded: participantsTable.isOnSpotOnboarded,
      delegateType: participantsTable.delegateType,
    })
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, regNumber));

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  // Load associated event details
  let event = null;
  if (participant.eventId) {
    [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, participant.eventId));
  }

  // Check if they have faculty assignments
  const assignments = await db
    .select({ role: assignmentsTable.role })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.participantId, participant.id));

  const facultyRoles = ["Speaker", "Presenter", "Poster", "Panelist", "Moderator", "Judge", "Chair", "CoChair"];
  const isFaculty = assignments.some((a) => facultyRoles.includes(a.role));

  // Load food sessions and collected logs for this participant
  let foodStatusList: any[] = [];
  if (participant.eventId) {
    const sessions = await db
      .select()
      .from(foodSessionsTable)
      .where(eq(foodSessionsTable.eventId, participant.eventId))
      .orderBy(foodSessionsTable.date, foodSessionsTable.startTime);

    const logs = await db
      .select()
      .from(foodLogsTable)
      .where(eq(foodLogsTable.participantId, participant.id));

    const loggedSessionIds = new Set(logs.map((l) => l.foodSessionId));
    const logMap = new Map(logs.map((l) => [l.foodSessionId, l.collectedAt]));

    foodStatusList = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      enabled: s.enabled,
      isRedeemed: loggedSessionIds.has(s.id),
      collectedAt: logMap.get(s.id) || null,
    }));
  }

  res.json({
    id: participant.id,
    eventId: participant.eventId,
    name: participant.name,
    registrationNumber: participant.registrationNumber,
    institution: participant.institution,
    designation: participant.designation,
    email: participant.email,
    mobile: participant.mobile,
    isPaid: participant.isPaid,
    approvalStatus: participant.approvalStatus,
    isOnSpot: participant.isOnSpot,
    isOnSpotLinked: participant.isOnSpotLinked,
    isOnSpotOnboarded: participant.isOnSpotOnboarded,
    delegateType: participant.delegateType || "delegate",
    isFaculty,
    foodSessions: foodStatusList,
    event: event ? {
      id: event.id,
      slug: event.slug,
      title: event.title,
      eventType: event.eventType,
      venue: event.venue,
      city: event.city,
      startDate: event.startDate,
      endDate: event.endDate,
      themeColor: event.themeColor,
      accentColor: event.accentColor,
      logoUrl: event.logoUrl,
      bannerUrl: event.bannerUrl,
      badgeSubtitle: event.badgeSubtitle,
      badgeFooterText: event.badgeFooterText,
      agendaPdfUrl: event.agendaPdfUrl,
      agendaPdfButtonText: event.agendaPdfButtonText || "Download Event Agenda (PDF)",
      customPdfUrl: event.customPdfUrl,
      customPdfButtonText: event.customPdfButtonText || "View Document (PDF)",
      pdfAttachmentsJson: event.pdfAttachmentsJson,
    } : null,
  });
});

// GET /participants/lookup/:regNumber — SECURED, auth required
router.get("/participants/lookup/:regNumber", requireAuth(), async (req, res): Promise<void> => {
  const regNumber = (req.params.regNumber as string)?.toUpperCase();
  if (!regNumber) {
    res.status(400).json({ error: "Registration number is required" });
    return;
  }
  const [participant] = await db
    .select({
      id: participantsTable.id,
      eventId: participantsTable.eventId,
      name: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      institution: participantsTable.institution,
      designation: participantsTable.designation,
      passwordHash: participantsTable.passwordHash,
      isOnSpot: participantsTable.isOnSpot,
      isOnSpotLinked: participantsTable.isOnSpotLinked,
      isOnSpotOnboarded: participantsTable.isOnSpotOnboarded,
      mobile: participantsTable.mobile,
      isPaid: participantsTable.isPaid,
      approvalStatus: participantsTable.approvalStatus,
    })
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, regNumber));

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  // Authorization Check:
  const user = req.user!;
  const allowedStaffTypes = ["admin", "super_admin", "event_coordinator", "track_coordinator", "scientific_committee", "coordinator_view_only"];
  
  if (user.userType === "participant") {
    if (participant.id !== user.id) {
      res.status(403).json({ error: "Access denied. You can only view your own profile." });
      return;
    }
  } else if (!allowedStaffTypes.includes(user.userType)) {
    res.status(403).json({ error: "Access denied. Insufficient permissions." });
    return;
  }

  let event = null;
  if (participant.eventId) {
    [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, participant.eventId));
  }

  const assignments = await db
    .select({ role: assignmentsTable.role })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.participantId, participant.id));

  const facultyRoles = ["Speaker", "Presenter", "Poster", "Panelist", "Moderator", "Judge", "Chair", "CoChair"];
  const isFaculty = assignments.some((a) => facultyRoles.includes(a.role));

  res.json({
    id: participant.id,
    eventId: participant.eventId,
    name: participant.name,
    registrationNumber: participant.registrationNumber,
    institution: participant.institution,
    designation: participant.designation,
    isFaculty,
    hasPassword: !!participant.passwordHash,
    isPaid: participant.isPaid,
    approvalStatus: participant.approvalStatus,
    isOnSpot: participant.isOnSpot,
    isOnSpotLinked: participant.isOnSpotLinked,
    isOnSpotOnboarded: participant.isOnSpotOnboarded,
    mobile: participant.mobile,
    event,
  });
});

function buildParticipantResponse(p: any, roles?: any) {
  const rolesList = Array.isArray(roles) ? roles : [];
  const dateStr = p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt);
  return {
    id: p.id,
    eventId: p.eventId,
    registrationNumber: p.registrationNumber,
    name: p.name,
    email: p.email || "",
    mobile: p.mobile || "",
    institution: p.institution,
    designation: p.designation,
    createdAt: dateStr,
    hasPassword: !!p.passwordHash,
    isPaid: p.isPaid,
    paymentStatus: p.paymentStatus || (p.isPaid ? "paid" : "unpaid"),
    paymentAmount: p.paymentAmount || 0,
    paymentId: p.paymentId,
    orderId: p.orderId,
    approvalStatus: p.approvalStatus || "approved",
    approvedAt: p.approvedAt,
    rejectionReason: p.rejectionReason,
    utrNumber: p.utrNumber,
    isActive: p.isActive,
    isSponsored: p.isSponsored,
    sponsorType: p.sponsorType,
    delegateType: p.delegateType,
    roles: rolesList,
  };
}

async function getNextUniqueRegNumber(eventId?: number): Promise<string> {
  return generateEventRegNumber(eventId);
}

async function getNextUniqueMobile(customIndex?: number): Promise<string> {
  const count = await db.select({ id: participantsTable.id }).from(participantsTable);
  let mobileIndex = customIndex || (count.length + 1);
  while (true) {
    const candidate = `98${String(mobileIndex + 10000000).slice(-8)}`;
    const existing = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.mobile, candidate));
    if (existing.length === 0) {
      return candidate;
    }
    mobileIndex++;
  }
}

// GET /participants
router.get(
  "/participants",
  requireAuth(["admin", "super_admin", "event_coordinator", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    const parsed = ListParticipantsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { search, track, role, page = 1, limit = 50 } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    const user = req.user!;

    // Event scoping
    const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
    if (eventIdParam && !isNaN(eventIdParam)) {
      conditions.push(eq(participantsTable.eventId, eventIdParam));
    } else if (user.userType !== "super_admin" && user.userType !== "admin") {
      // If coordinator has assigned events, restrict to them
      const [sysUser] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, user.id));
      const assigned = (sysUser?.assignedEventIds as number[]) || [];
      if (assigned.length > 0) {
        conditions.push(inArray(participantsTable.eventId, assigned));
      }
    }

    // Approval status filter
    const approvalStatusFilter = req.query.approvalStatus as string | undefined;
    if (approvalStatusFilter) {
      conditions.push(eq(participantsTable.approvalStatus, approvalStatusFilter));
    }

    // Payment status filter
    const paymentStatusFilter = req.query.paymentStatus as string | undefined;
    if (paymentStatusFilter === "paid") {
      conditions.push(eq(participantsTable.isPaid, true));
    } else if (paymentStatusFilter === "unpaid") {
      conditions.push(eq(participantsTable.isPaid, false));
    }

    const type = req.query.type as string;
    if (type === "on_spot") {
      conditions.push(eq(participantsTable.isOnSpot, true));
      conditions.push(eq(participantsTable.isOnSpotLinked, true));
    } else if (type === "prior_faculty") {
      conditions.push(eq(participantsTable.isOnSpot, false));
      conditions.push(
        sql`exists (select 1 from ${assignmentsTable} where ${assignmentsTable.participantId} = ${participantsTable.id})`
      );
    } else if (type === "prior_attendee") {
      conditions.push(eq(participantsTable.isOnSpot, false));
      conditions.push(
        sql`not exists (select 1 from ${assignmentsTable} where ${assignmentsTable.participantId} = ${participantsTable.id})`
      );
    } else if (type === "all") {
      // no condition
    }

    if (search) {
      conditions.push(
        or(
          ilike(participantsTable.name, `%${search}%`),
          ilike(participantsTable.registrationNumber, `%${search}%`),
          ilike(participantsTable.institution, `%${search}%`),
          ilike(participantsTable.mobile, `%${search}%`),
          ilike(participantsTable.email, `%${search}%`)
        )
      );
    }

    if (track || role) {
      const subConds = [sql`${assignmentsTable.participantId} = ${participantsTable.id}`];
      if (track) {
        subConds.push(ilike(assignmentsTable.track, `%${track}%`));
      }
      if (role) {
        subConds.push(eq(assignmentsTable.role, role));
      }
      conditions.push(sql`exists (select 1 from ${assignmentsTable} where ${and(...subConds)})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Get total count
    let countQuery = db
      .select({ count: count() })
      .from(participantsTable)
      .$dynamic();
    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }
    const [totalCountResult] = await countQuery;
    const total = Number(totalCountResult?.count ?? 0);

    // 2. Get paginated, sorted rows
    let dataQuery = db
      .select()
      .from(participantsTable)
      .orderBy(participantsTable.cleanName, participantsTable.registrationNumber)
      .limit(limit)
      .offset(offset)
      .$dynamic();

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }

    const allParticipants = await dataQuery;
    
    const participantIds = allParticipants.map((p) => p.id);
    const rolesMap = new Map<number, string[]>();
    
    if (participantIds.length > 0) {
      const assignments = await db
        .select({ participantId: assignmentsTable.participantId, role: assignmentsTable.role })
        .from(assignmentsTable)
        .where(inArray(assignmentsTable.participantId, participantIds));
        
      for (const a of assignments) {
        const list = rolesMap.get(a.participantId) || [];
        if (!list.includes(a.role)) {
          list.push(a.role);
        }
        rolesMap.set(a.participantId, list);
      }
    }

    const participants = allParticipants.map((p) => 
      buildParticipantResponse(p, rolesMap.get(p.id) || [])
    );

    res.json({ participants, total, page, limit });
  }
);

// GET /participants/qr-batch
router.get(
  "/participants/qr-batch",
  requireAuth(["admin", "super_admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    try {
      const allParticipants = await db.select().from(participantsTable);
      
      const archive = new ZipArchive({ zlib: { level: 9 } });
      res.setHeader("Content-Disposition", `attachment; filename="vision2020_qr_codes_${Date.now()}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      
      archive.on("error", (err: any) => {
        console.error("ZIP Archive Error:", err);
      });

      const baseUrl = getClientBaseUrl(req);

      for (const participant of allParticipants) {
        // Find their assignments to get roles
        const assignments = await db
          .select({ role: assignmentsTable.role })
          .from(assignmentsTable)
          .where(eq(assignmentsTable.participantId, participant.id));
        
        const roles = [...new Set(assignments.map(a => a.role))];
        const primaryRole = roles.length > 0 ? roles[0] : "Attendee";

        // Clean names for file compatibility
        const cleanName = participant.name
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        const cleanReg = participant.registrationNumber
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        const cleanRole = primaryRole
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        const qrUrl = `${baseUrl}/q/${participant.registrationNumber}`;
        const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2 });
        
        archive.append(qrBuffer, { name: `${cleanName}_${cleanReg}_${cleanRole}.png` });
      }

      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to batch export QR codes" });
      }
    }
  }
);

// POST /participants
router.post(
  "/participants",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req, res): Promise<void> => {
    const parsed = CreateParticipantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let regNum = parsed.data.registrationNumber;
    if (!regNum || regNum.trim() === "") {
      regNum = await generateEventRegNumber(parsed.data.eventId);
    }

    const regCheck = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, regNum))
      .limit(1);
    if (regCheck.length > 0) {
      res.status(400).json({ error: `Registration number "${regNum}" already exists` });
      return;
    }

    if (parsed.data.mobile) {
      parsed.data.mobile = cleanMobileNumber(parsed.data.mobile) || parsed.data.mobile;
    }

    const checkDuplicate = await checkEmailOrMobileRegistered({
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      eventId: parsed.data.eventId,
    });
    if (checkDuplicate) {
      res.status(400).json({ error: checkDuplicate.reason });
      return;
    }

    const [participant] = await db
      .insert(participantsTable)
      .values({
        ...parsed.data,
        registrationNumber: regNum,
        cleanName: getCleanName(parsed.data.name),
      })
      .returning();

    await db.insert(activityLogsTable).values({
      type: "registration",
      message: `New participant registered: ${participant.name} (${participant.registrationNumber})`,
    });

    res.status(201).json(buildParticipantResponse(participant));
  }
);

// POST /participants/non-participant
router.post(
  "/participants/non-participant",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    try {
      const { 
        name, mobile, email, institution,
        assignments // Array of { role, track, sessionName, date, time, presentationTitle }
      } = req.body;

      if (!name || !institution) {
        res.status(400).json({ error: "Name and Institution are required" });
        return;
      }

      // Generate a unique regNumber
      const regNumber = await getNextUniqueRegNumber();

      const inputMobile = mobile ? cleanMobileNumber(mobile) : null;
      const inputEmail = email?.trim();
      if (inputMobile || inputEmail) {
        const checkDuplicate = await checkEmailOrMobileRegistered({
          email: inputEmail || undefined,
          mobile: inputMobile || undefined,
        });
        if (checkDuplicate) {
          res.status(400).json({ error: checkDuplicate.reason });
          return;
        }
      }

      let finalMobile = inputMobile || null;

      let finalEmail = inputEmail || "";
      if (!finalEmail) {
        const emailBase = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/, "");
        finalEmail = `${emailBase}@conference.vision2020india.org`;
      }

      const [participant] = await db
        .insert(participantsTable)
        .values({
          registrationNumber: regNumber,
          name: name.trim(),
          cleanName: getCleanName(name),
          mobile: finalMobile,
          email: finalEmail,
          institution: institution.trim(),
          isPaid: true,
          isSponsored: false,
        })
        .returning();

      await db.insert(activityLogsTable).values({
        type: "registration",
        message: `New non-participant added manually: ${participant.name} (${participant.registrationNumber})`,
      });

      if (assignments && Array.isArray(assignments) && assignments.length > 0) {
        const assignmentValues = assignments.map((a: any) => ({
          participantId: participant.id,
          role: a.role,
          track: a.track || "General",
          sessionName: a.sessionName || null,
          date: a.date || null,
          time: a.time || null,
          presentationTitle: a.presentationTitle || null,
          hall: a.hall || null,
        }));
        await db.insert(assignmentsTable).values(assignmentValues);
      }

      res.status(201).json(buildParticipantResponse(participant));
    } catch (err: any) {
      console.error("Add Non-Participant Error:", err);
      res.status(500).json({ error: "Failed to add non-participant" });
    }
  }
);

// Helper functions for Excel & Google Sheets Sync

function cleanMobileNumber(mobile: any): string | null {
  if (!mobile) return null;
  const s = String(mobile).trim().toLowerCase();
  if (s === "na" || s === "n/a" || s === "n.a." || s === "#n/a" || s === "nil" || s === "none" || s === "null" || s === "undefined" || s === "-") {
    return null;
  }
  
  let val = String(mobile).trim();
  if (val.toLowerCase().includes("e")) {
    const num = Number(val);
    if (!isNaN(num)) val = String(Math.round(num));
  }
  if (val.includes(".")) {
    val = val.split(".")[0];
  }

  const digits = val.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}



function findRowValue(row: Record<string, any>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[\s\r\n\t_]/g, "");
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[\s\r\n\t_]/g, "");
      if (cleanKey === cleanAlias) {
        return String(row[key] ?? "").trim();
      }
    }
  }
  return "";
}

function mapRole(raw: string): string {
  const r = (raw || "").trim().toLowerCase();
  if (r.includes("poster")) return "Poster";
  if (r.includes("co-chair") || r.includes("cochair") || r.includes("co chair")) return "CoChair";
  if (r.includes("panelist") || r.includes("panellist")) return "Panelist";
  if (r.includes("discussion")) return "Discussion";
  if (r.includes("speaker")) return "Speaker";
  if (r.includes("presenter")) return "Presenter";
  if (r.includes("moderator")) return "Moderator";
  if (r.includes("judge")) return "Judge";
  if (r.includes("chair")) return "Chair";
  if (r.includes("warp-up") || r.includes("wrap-up")) return "Moderator";
  return "Speaker";
}

function mapDay(day: string | number): string {
  let str = String(day || "").trim();
  if (!str) return "11-07-2026";
  
  // Excel serial dates:
  // July 10, 2026 = 46211. July 11 = 46212. July 12 = 46213.
  // November 10, 2026 = 46336. November 11 = 46337. November 12 = 46338.
  if (str === "46211" || str === "46336" || str === "46214" || str.includes("46214")) return "10-07-2026";
  if (str === "46212" || str === "46337" || str === "46215" || str.includes("46215")) return "11-07-2026";
  if (str === "46213" || str === "46338" || str === "46216" || str.includes("46216")) return "12-07-2026";

  const lower = str.toLowerCase();
  if (lower.includes("day 0") || lower.includes("10th") || lower.includes("10")) return "10-07-2026";
  if (lower.includes("day 1") || lower.includes("11th") || lower.includes("11")) return "11-07-2026";
  if (lower.includes("day 2") || lower.includes("12th") || lower.includes("12")) return "12-07-2026";
  if (lower.includes("day 3")) return "12-07-2026";

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmYMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmYMatch) {
    const dd = parseInt(dmYMatch[1], 10);
    const mm = parseInt(dmYMatch[2], 10);
    if (dd === 10 || mm === 10) return "10-07-2026";
    if (dd === 11 || mm === 11) return "11-07-2026";
    if (dd === 12 || mm === 12) return "12-07-2026";
    return `${String(dd).padStart(2, "0")}-07-2026`;
  }

  // Match YYYY-MM-DD
  const YmdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (YmdMatch) {
    const mm = parseInt(YmdMatch[2], 10);
    const dd = parseInt(YmdMatch[3], 10);
    if (dd === 10 || mm === 10) return "10-07-2026";
    if (dd === 11 || mm === 11) return "11-07-2026";
    if (dd === 12 || mm === 12) return "12-07-2026";
    return `${String(dd).padStart(2, "0")}-07-2026`;
  }

  // Fallback Date parse
  const d = new Date(day);
  if (!isNaN(d.getTime())) {
    const dd = d.getDate();
    const mm = d.getMonth() + 1;
    if (dd === 10 || mm === 10) return "10-07-2026";
    if (dd === 11 || mm === 11) return "11-07-2026";
    if (dd === 12 || mm === 12) return "12-07-2026";
    return `${String(dd).padStart(2, "0")}-07-2026`;
  }

  return "11-07-2026"; // Fallback
}

function cleanTimeRange(rawTime: string): string {
  let str = String(rawTime || "").trim().toLowerCase();
  if (!str) return "";

  const parseSingleTime = (timeStr: string, isStart = true): string => {
    timeStr = timeStr.trim();
    if (!timeStr) return "";
    
    const hasAm = timeStr.includes("am");
    const hasPm = timeStr.includes("pm");
    
    let cleanStr = timeStr.replace(/[^\d:]/g, "");
    if (!cleanStr.includes(":")) {
      cleanStr += ":00";
    }
    
    let [hoursStr, minutesStr] = cleanStr.split(":");
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;
    
    if (hasPm && hours < 12) {
      hours += 12;
    } else if (hasAm && hours === 12) {
      hours = 0;
    } else if (!hasAm && !hasPm) {
      if (hours < 9) {
        hours += 12;
      }
    }
    
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}`;
  };

  const parts = str.split(/[-–—to]/);
  if (parts.length === 2) {
    const start = parseSingleTime(parts[0], true);
    const end = parseSingleTime(parts[1], false);
    if (start && end) {
      return `${start}-${end}`;
    }
  } else if (parts.length === 1) {
    const single = parseSingleTime(parts[0], true);
    if (single) return single;
  }
  
  return rawTime;
}

function mapTrack(rawTrack: string | number): string {
  const t = String(rawTrack || "").trim();
  if (!t) return "General";
  
  let trackName = t;
  const cleanTrack = t.toLowerCase().replace(/hall\s*[a-b]/i, "").trim();
  
  if (cleanTrack === "1" || cleanTrack === "track 1") {
    trackName = "Track 1: Innovations and Technological Solutions in Eye Care";
  } else if (cleanTrack === "2" || cleanTrack === "track 2") {
    trackName = "Track 2: Collaboration for Universal Eye Health";
  } else if (cleanTrack === "3" || cleanTrack === "track 3") {
    trackName = "Track 3: Impact, Equity, Sustainability and Quality in Eye Care";
  } else if (cleanTrack === "4" || cleanTrack === "track 4") {
    trackName = "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel";
  } else if (cleanTrack === "5" || cleanTrack === "track 5") {
    trackName = "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
  } else if (cleanTrack === "track 5 hall a" || cleanTrack === "5a") {
    trackName = "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
  } else if (cleanTrack === "track 5 hall b" || cleanTrack === "5b") {
    trackName = "Track 5 Hall B: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
  } else {
    const numMatch = cleanTrack.match(/^\d+$/);
    if (numMatch) {
      const num = numMatch[0];
      if (num === "1") trackName = "Track 1: Innovations and Technological Solutions in Eye Care";
      else if (num === "2") trackName = "Track 2: Collaboration for Universal Eye Health";
      else if (num === "3") trackName = "Track 3: Impact, Equity, Sustainability and Quality in Eye Care";
      else if (num === "4") trackName = "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel";
      else if (num === "5") trackName = "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
      else trackName = `Track ${num}`;
    }
  }
  return trackName;
}

interface SyncRow {
  name: string;
  institution: string;
  regNum: string;
  role: string;
  track: string;
  sessionName: string;
  hall: string;
  date: string;
  time: string;
  title: string;
  email?: string;
  mobile?: string;
  isPaid?: boolean;
}

function getSheetRows(sheet: any): Record<string, any>[] {
  const rawGrid = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawGrid.length, 10); i++) {
    const row = rawGrid[i];
    if (row && Array.isArray(row)) {
      const hasName = row.some(cell => {
        const val = String(cell || "").toLowerCase().trim();
        return val === "name" || val === "full name" || val === "presenter" || val === "poster no." || val === "poster no";
      });
      if (hasName) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headers = rawGrid[headerRowIndex].map(h => String(h || "").trim());
  const rows: Record<string, any>[] = [];
  for (let i = headerRowIndex + 1; i < rawGrid.length; i++) {
    const row = rawGrid[i];
    if (!row || !Array.isArray(row) || row.every(cell => cell === null || cell === undefined || cell === "")) {
      continue;
    }
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        obj[header] = row[j] !== undefined ? row[j] : "";
      }
    }
    rows.push(obj);
  }
  return rows;
}

function isValidParticipantName(name: string): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  if (!n) return false;

  const placeholders = [
    "tbd", "tbc", "vacant", "representative", "panel discussion", "discussion",
    "speaker", "chair", "co-chair", "cochair", "co chair", "moderator",
    "panelist", "panellist", "guest", "to be decided", "break", "lunch",
    "tea break", "hi-tea", "high tea", "registration", "inauguration",
    "q&a", "q & a", "discussion", "introductory remarks", "welcome address",
    "keynote address", "valedictory", "valedictory session", "award",
    "award presentation", "welcome & introduction", "concluding remarks",
    "wrap-up", "wrap up", "judges", "judge 1", "judge 2", "judge 3",
    "panelists", "panellists", "chairs", "co-chairs", "moderators"
  ];

  if (n.length <= 1) return false;
  if (placeholders.includes(n)) return false;

  for (const placeholder of placeholders) {
    if (n === placeholder || n.startsWith(placeholder + " ") || n.endsWith(" " + placeholder)) {
      return false;
    }
  }

  return true;
}

function parseRowToSyncRow(
  row: Record<string, any>,
  mappings?: Record<string, string>,
  sessionMaps?: {
    sessionMapByTopic: Map<string, string>;
    sessionMapByTrackTime: Map<string, string>;
  }
): SyncRow {
  const getFieldVal = (field: string, fallbacks: string[]) => {
    if (mappings && mappings[field]) {
      const primaryMapping = mappings[field].split(/[,|]/).map(s => s.trim()).filter(Boolean);
      if (primaryMapping.length > 0) {
        const val = findRowValue(row, primaryMapping);
        if (val) return val;
      }
    }
    return findRowValue(row, fallbacks);
  };

  const name = getFieldVal("name", ["name", "full name", "delegate name"]);
  const institution = getFieldVal("institution", ["hospital name", "institution", "organisation", "organization", "hospital", "hospitalname"]);
  const regNum = getFieldVal("regNum", ["poster / paper no", "poster/paper no", "poster/paperno", "paper no", "paperno", "poster no", "sr. no", "sr.no"]);
  const role = getFieldVal("role", ["role (chair/co-chair/moderator/panellist/speaker)", "role", "role(chair/co-chair/moderator/panellist/speaker)"]);
  const day = getFieldVal("date", ["day", "date"]);
  const track = getFieldVal("track", ["track/screen no.", "track/screen", "screen no.", "screen", "screen number", "track number", "tracknumber", "track"]);
  const time = getFieldVal("time", ["time", "timing", "time slot", "timeslot"]);
  const email = getFieldVal("email", ["email", "mail", "email id", "emailid"]);
  const mobile = getFieldVal("mobile", ["mobilenumer", "mobile numer", "mobile", "phone", "phone number", "phonenumber", "mobile number", "mobilenumber", "phone no", "phoneno"]);
  let hall = getFieldVal("hall", ["hall", "poster hall", "poster no", "poster no.", "posterno", "poster number", "hall name", "hallname"]);
  const paidVal = getFieldVal("isPaid", ["registered", "paid", "payment status", "status", "fee status", "fees status", "payment", "ispaid", "utr number", "utr number/s"]);

  let title = getFieldVal("title", ["title", "presentation title", "presentationtitle", "topic", "tittle", "topic heading", "topicheading"]);
  let sessionName = getFieldVal("sessionName", ["sessionno", "session no", "session", "session name", "sessionname", "topic heading", "topicheading"]);

  const mappedTrack = mapTrack(track);
  let mappedRole = mapRole(role);
  if (mappedRole === "Speaker" && mappedTrack.toLowerCase().includes("track 5")) {
    mappedRole = "Presenter";
  }

  // Handle overrides/lookups for Chairs/Moderators/Co-Chairs/Judges
  if (["Chair", "CoChair", "Moderator", "Panelist", "Judge"].includes(mappedRole)) {
    const nameLower = name.toLowerCase().trim();
    const instLower = institution.toLowerCase().trim();
    const topicVal = findRowValue(row, ["topic"]).toLowerCase().trim();
    const headingVal = findRowValue(row, ["topic heading", "topicheading"]).trim();

    if (headingVal) {
      title = headingVal;
      if (!sessionName.trim()) {
        sessionName = headingVal;
      }
    } else if (topicVal && (topicVal.includes(nameLower) || (instLower && topicVal.includes(instLower)) || topicVal.includes(","))) {
      title = "";
    }
  }

  // Populate session from maps if empty or if it was overwritten to headingVal
  if (sessionMaps) {
    const isCode = /^[a-zA-Z0-9\s-]+$/.test(sessionName) && sessionName.length < 15;
    if (!sessionName.trim() || !isCode) {
      const topicHeading = getFieldVal("topicHeading", ["topic heading", "topicheading"]);
      const mappedDate = mapDay(day);
      const timeVal = cleanTimeRange(time);
      const topicLower = topicHeading.trim().toLowerCase();
      const keyTopic = `${mappedDate}|${mappedTrack}|${topicLower}`;
      const keyTime = `${mappedDate}|${mappedTrack}|${timeVal}`;

      const matchedSession = sessionMaps.sessionMapByTopic.get(keyTopic) || 
                             sessionMaps.sessionMapByTrackTime.get(keyTime) || 
                             sessionMaps.sessionMapByTopic.get(topicLower);
      if (matchedSession) {
        if (topicHeading) {
          sessionName = `${matchedSession}::${topicHeading}`;
        } else {
          sessionName = matchedSession;
        }
      } else if (topicHeading) {
        sessionName = topicHeading;
      }
    }
  }

  // Handle final fallback if it's still missing from the mappings/match
  if (!sessionName.trim()) {
    const backupHeading = getFieldVal("topicHeading", ["topic heading", "topicheading"]).trim();
    const backupSession = getFieldVal("sessionno", ["sessionno", "session no", "session"]).trim();
    if (backupHeading && backupSession) {
      sessionName = `${backupSession}::${backupHeading}`;
    } else if (backupHeading) {
      sessionName = backupHeading;
    }
  }

  // Poster special formatting: clear title, extract poster location (PH1/PH2)
  if (mappedRole === "Poster") {
    title = "";
    if (sessionName) {
      const match = sessionName.match(/(PH\d+)/i);
      if (match) {
        const phLoc = match[1].toUpperCase();
        sessionName = phLoc;
        hall = phLoc;
      }
    }
  }

  // Robustly determine payment status
  let isPaid = true; // Default to paid if not found/empty
  if (paidVal !== undefined && paidVal !== null && String(paidVal).trim() !== "") {
    const cleanPaid = String(paidVal).toLowerCase().trim();
    if (
      cleanPaid.includes("unpaid") ||
      cleanPaid.includes("pending") ||
      cleanPaid === "no" ||
      cleanPaid === "false" ||
      cleanPaid === "0" ||
      cleanPaid.includes("not paid") ||
      cleanPaid.includes("not registered")
    ) {
      isPaid = false;
    } else if (cleanPaid === "r" || cleanPaid === "registered") {
      isPaid = true;
    }
  }

  return {
    name,
    institution,
    regNum,
    role: mappedRole,
    track: mappedTrack,
    sessionName,
    hall,
    date: mapDay(day),
    time: cleanTimeRange(time),
    title,
    email: email || undefined,
    mobile: mobile || undefined,
    isPaid,
  };
}

async function reconcileSync(syncRows: SyncRow[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const existingCount = await db.select({ id: participantsTable.id }).from(participantsTable);
  let mobileCounter = existingCount.length + 1;
  const participantKeyMap = new Map<string, number>();

  const activeAssignments: Array<{
    participantId: number;
    role: string;
    track: string;
    sessionName: string | null;
    hall: string | null;
    date: string | null;
    time: string | null;
    presentationTitle: string | null;
  }> = [];

  for (const row of syncRows) {
    try {
      const name = row.name.trim().replace(/\s+/g, " ");
      const institution = row.institution.trim().replace(/\s+/g, " ");
      if (!name || !isValidParticipantName(name)) { skipped++; continue; }

      const normName = name.toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/[^a-z0-9]/g, "");
      const regNumKey = row.regNum ? row.regNum.trim().toUpperCase() : "";
      const emailKey = row.email ? row.email.trim().toLowerCase() : "";
      const mobileKey = row.mobile ? cleanMobileNumber(row.mobile) || "" : "";

      let key = "";
      if (emailKey) {
        key = `email:${emailKey}`;
      } else if (regNumKey) {
        key = `regnum:${regNumKey}`;
      } else if (mobileKey) {
        key = `mobile:${mobileKey}`;
      } else {
        key = `name:${normName}`;
      }

      let participantId = participantKeyMap.get(key);

      if (participantId === undefined) {
        let existing = null;

        // Try 1: match strictly by Registration Number if available
        if (regNumKey) {
          const [r] = await db
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.delegateType, "delegate"),
                eq(participantsTable.registrationNumber, regNumKey)
              )
            )
            .limit(1);
          existing = r;
        }

        // Try 2: match by Email + Name (strict name check + email)
        if (!existing && emailKey) {
          const [r] = await db
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.delegateType, "delegate"),
                sql`lower(${participantsTable.email}) = ${emailKey}`,
                eq(participantsTable.cleanName, getCleanName(name))
              )
            )
            .limit(1);
          existing = r;
        }

        // Try 3: match by Mobile + Name (strict name check + mobile)
        if (!existing && mobileKey) {
          const [r] = await db
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.delegateType, "delegate"),
                eq(participantsTable.mobile, mobileKey),
                eq(participantsTable.cleanName, getCleanName(name))
              )
            )
            .limit(1);
          existing = r;
        }

        // Try 4: match by Name + Institution (strict name + institution match)
        if (!existing && institution) {
          const [r] = await db
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.delegateType, "delegate"),
                eq(participantsTable.cleanName, getCleanName(name)),
                sql`lower(${participantsTable.institution}) = ${institution.toLowerCase()}`
              )
            )
            .limit(1);
          existing = r;
        }



        if (existing) {
          participantId = existing.id;
          const updates: Record<string, any> = {};

          if (row.regNum && row.regNum !== existing.registrationNumber && !existing.isOnSpot) {
            updates.registrationNumber = row.regNum;
          }

          const cleanedMobile = row.mobile ? cleanMobileNumber(row.mobile) : null;
          if (cleanedMobile && cleanedMobile !== existing.mobile) {
            const [dupMobile] = await db
              .select({ id: participantsTable.id })
              .from(participantsTable)
              .where(and(
                eq(participantsTable.mobile, cleanedMobile),
                ne(participantsTable.id, existing.id)
              ))
              .limit(1);
            if (!dupMobile) {
              updates.mobile = cleanedMobile;
            }
          }

          if (row.email && row.email.trim() && row.email.trim().toLowerCase() !== existing.email) {
            updates.email = row.email.trim().toLowerCase();
          }

          if (row.isPaid !== undefined && row.isPaid !== existing.isPaid) {
            if (!existing.isPaid || row.isPaid === true) {
              updates.isPaid = row.isPaid;
            }
          }

          if (Object.keys(updates).length > 0) {
            await db
              .update(participantsTable)
              .set(updates)
              .where(eq(participantsTable.id, existing.id));
          }
        } else {
          let regNum = row.regNum;
          if (!regNum) {
            regNum = await getNextUniqueRegNumber();
          }

          let mobile = row.mobile ? cleanMobileNumber(row.mobile) : null;
          if (mobile) {
            const [dupMobile] = await db
              .select({ id: participantsTable.id })
              .from(participantsTable)
              .where(eq(participantsTable.mobile, mobile))
              .limit(1);
            if (dupMobile) {
              errors.push(`Warning: Duplicate mobile number ${mobile} detected for ${name}. Storing as null to avoid collision.`);
              mobile = null;
            }
          }

          let email = row.email && row.email.trim() ? row.email.trim().toLowerCase() : null;
          if (!email) {
            const emailBase = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/, "");
            email = `${emailBase}@conference.vision2020india.org`;
          }

          const [newP] = await db
            .insert(participantsTable)
            .values({
              registrationNumber: regNum,
              name,
              cleanName: getCleanName(name),
              email,
              mobile,
              institution: institution || "Unknown Institution",
              isPaid: row.isPaid !== undefined ? row.isPaid : true,
              delegateType: "delegate"
            })
            .returning();
          participantId = newP.id;

          await db.insert(activityLogsTable).values({
            type: "registration",
            message: `Imported Delegate: ${name} (${regNum})`,
          });
        }
        participantKeyMap.set(key, participantId);
      }

      activeAssignments.push({
        participantId,
        role: row.role,
        track: row.track,
        sessionName: row.sessionName || null,
        hall: row.hall || null,
        date: row.date || null,
        time: row.time || null,
        presentationTitle: row.title || null,
      });

    } catch (err: any) {
      errors.push(`Row processing failed: ${err.message}`);
      skipped++;
    }
  }

  const dbAssignments = await db
    .select({
      id: assignmentsTable.id,
      participantId: assignmentsTable.participantId,
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
    .where(
      and(
        eq(participantsTable.isOnSpot, false),
        eq(participantsTable.delegateType, "delegate")
      )
    );

  const matchedAssignmentIds = new Set<number>();
  const assignmentsToInsert = [];

  for (const sheetAssign of activeAssignments) {
    // Exact match: same participant, role, track, session, date, time, title
    let match = dbAssignments.find(
      (dbA) =>
        dbA.participantId === sheetAssign.participantId &&
        dbA.role === sheetAssign.role &&
        dbA.track === sheetAssign.track &&
        (dbA.sessionName || null) === sheetAssign.sessionName &&
        (dbA.date || null) === sheetAssign.date &&
        (dbA.time || null) === sheetAssign.time &&
        (dbA.presentationTitle || null) === sheetAssign.presentationTitle
    );

    // Fallback: if the incoming row has "General" track (no track in sheet),
    // check if a proper-track assignment already exists for same participant/role/date/time.
    // If so, treat it as a match to prevent duplicate "General" row insertion.
    if (!match && sheetAssign.track === "General") {
      match = dbAssignments.find(
        (dbA) =>
          dbA.participantId === sheetAssign.participantId &&
          dbA.role === sheetAssign.role &&
          dbA.track !== "General" &&
          (dbA.date || null) === sheetAssign.date &&
          (dbA.time || null) === sheetAssign.time
      );
    }

    if (match) {
      matchedAssignmentIds.add(match.id);
      if (match.hall !== sheetAssign.hall && sheetAssign.hall) {
        await db
          .update(assignmentsTable)
          .set({ hall: sheetAssign.hall })
          .where(eq(assignmentsTable.id, match.id));
      }
    } else {
      assignmentsToInsert.push(sheetAssign);
    }
  }

  // Also mark any existing "General" track assignments that are shadowed by a
  // proper-track assignment (same participant + role + date + time) so they get removed.
  const generalDuplicates = dbAssignments.filter(
    (dbA) =>
      dbA.track === "General" &&
      !matchedAssignmentIds.has(dbA.id) &&
      dbAssignments.some(
        (other) =>
          other.id !== dbA.id &&
          other.participantId === dbA.participantId &&
          other.role === dbA.role &&
          other.track !== "General" &&
          (other.date || null) === (dbA.date || null) &&
          (other.time || null) === (dbA.time || null)
      )
  );
  for (const dup of generalDuplicates) {
    matchedAssignmentIds.add(dup.id); // Exclude from delete list — we'll handle separately
  }

  const assignmentsToDelete = dbAssignments.filter((dbA) => !matchedAssignmentIds.has(dbA.id));
  if (assignmentsToDelete.length > 0) {
    const idsToDelete = assignmentsToDelete.map((a) => a.id);
    await db.delete(assignmentsTable).where(inArray(assignmentsTable.id, idsToDelete));
  }

  // Delete shadowed "General" duplicates that have proper-track equivalents
  if (generalDuplicates.length > 0) {
    const dupIds = generalDuplicates.map((a) => a.id);
    await db.delete(assignmentsTable).where(inArray(assignmentsTable.id, dupIds));
  }

  // Broad cleanup: delete any remaining non-Poster "General" track assignments
  // in the delegate pool — these are always garbage from rows with no track column.
  // (Poster assignments legitimately have no track number, so we keep them.)
  await db
    .delete(assignmentsTable)
    .where(
      and(
        eq(assignmentsTable.track, "General"),
        sql`${assignmentsTable.role} != 'Poster'`,
        sql`${assignmentsTable.participantId} in (
          select id from ${participantsTable}
          where is_on_spot = false and delegate_type = 'delegate'
        )`
      )
    );

  if (assignmentsToInsert.length > 0) {
    await db.insert(assignmentsTable).values(assignmentsToInsert);
    imported += assignmentsToInsert.length;
  }

  const allPriorDelegates = await db
    .select({ id: participantsTable.id })
    .from(participantsTable)
    .where(
      and(
        eq(participantsTable.isOnSpot, false),
        eq(participantsTable.delegateType, "delegate")
      )
    );

  for (const delegate of allPriorDelegates) {
    const assigns = await db
      .select({ id: assignmentsTable.id })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, delegate.id));

    if (assigns.length === 0) {
      const [hasAttendance] = await db.select().from(attendanceLogsTable).where(eq(attendanceLogsTable.participantId, delegate.id)).limit(1);
      const [hasFood] = await db.select().from(foodLogsTable).where(eq(foodLogsTable.participantId, delegate.id)).limit(1);
      const [hasGoodies] = await db.select().from(goodiesLogsTable).where(eq(goodiesLogsTable.participantId, delegate.id)).limit(1);
      const [hasRsvp] = await db.select().from(rsvpTable).where(eq(rsvpTable.participantId, delegate.id)).limit(1);

      if (!hasAttendance && !hasFood && !hasGoodies && !hasRsvp) {
        await db.delete(participantsTable).where(eq(participantsTable.id, delegate.id));
      }
    }
  }

  return { imported, skipped, errors };
}

// POST /participants/import
router.post(
  "/participants/import",
  requireAuth(["super_admin"]),
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const syncRows: SyncRow[] = [];

      const [activeSession] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.isActive, true))
        .limit(1);
      const mappings = activeSession?.fieldMappings || undefined;

      // 1. Check if "Summary" or "Summary Sheet" exists in the sheet list (case-insensitive)
      const summarySheetName = workbook.SheetNames.find(name => {
        const ln = name.toLowerCase().trim();
        return ln === "summary" || ln === "summary sheet";
      });

      if (summarySheetName) {
        const sheet = workbook.Sheets[summarySheetName];
        const rows = getSheetRows(sheet);
        for (const row of rows) {
          const parsed = parseRowToSyncRow(row, mappings);
          if (!parsed.name || !isValidParticipantName(parsed.name)) continue;

          if (!parsed.role) {
            parsed.role = "Speaker";
          }
          syncRows.push(parsed);
        }
      } else {
        // Fallback: parse multiple tabs if no Summary sheet is present
        const allowedSheetNames = [
          "speakers directory", "speakers", "speaker directory",
          "poster schedule (2)", "poster schedule", "poster", "posters", "poster presentations",
          "chair", "co-chair", "cochair", "co chair", "moderator", "panelist", "panellist", "speaker"
        ];

        for (const sheetName of workbook.SheetNames) {
          const normalizedName = sheetName.toLowerCase().trim();
          if (!allowedSheetNames.includes(normalizedName)) {
            continue; // Skip comments, notes, formatting track schedules, etc.
          }

          const sheet = workbook.Sheets[sheetName];
          const rows = getSheetRows(sheet);
          for (const row of rows) {
            const parsed = parseRowToSyncRow(row, mappings);
            if (!parsed.name || !isValidParticipantName(parsed.name)) continue;

            // Set role based on sheet name or row value
            if (normalizedName.includes("poster")) {
              parsed.role = "Poster";
            } else if (normalizedName.includes("speakers directory")) {
              if (!parsed.role) {
                parsed.role = "Speaker";
              }
            } else {
              parsed.role = mapRole(sheetName);
            }

            syncRows.push(parsed);
          }
        }
      }

      const result = await reconcileSync(syncRows);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to parse template Excel file" });
    }
  }
);

// POST /participants/sync-google-sheets
router.post(
  "/participants/sync-google-sheets",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    let session;
    const sessionId = req.body.sessionId ? parseInt(req.body.sessionId, 10) : null;
    
    try {
      if (sessionId && !isNaN(sessionId)) {
        [session] = await db.select().from(syncSessionsTable).where(eq(syncSessionsTable.id, sessionId)).limit(1);
      } else {
        [session] = await db.select().from(syncSessionsTable).where(eq(syncSessionsTable.isActive, true)).limit(1);
      }

      if (!session) {
        res.status(400).json({ error: "No active sync session configured. Please configure and activate a session first." });
        return;
      }

      let spreadsheetId = session.googleSheetId.trim();
      if (spreadsheetId.includes("/")) {
        const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          spreadsheetId = match[1];
        }
      }

      const mappings = session.fieldMappings || {};
      const authClient = await getGoogleAuthClient().catch(() => null);
      const syncRows: SyncRow[] = [];
      const errors: string[] = [];

      // Try to fetch Summary first
      let summaryRows: Record<string, any>[] = [];
      let summarySuccess = false;
      const summaryNames: string[] = [];
      if (session.sheetName) {
        summaryNames.push(session.sheetName);
      }
      summaryNames.push("Summary", "Summary Sheet", "Final");

      if (authClient) {
        for (const name of summaryNames) {
          try {
            summaryRows = await getSpreadsheetRows(spreadsheetId, name);
            if (summaryRows.length > 0) {
              summarySuccess = true;
              break;
            }
          } catch (apiErr: any) {
            console.log(`[Google Sheets API] Failed to fetch summary tab "${name}":`, apiErr.message);
          }
        }
      }

      if (!summarySuccess) {
        for (const name of summaryNames) {
          try {
            const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
            const response = await fetch(fetchUrl);
            if (response.ok) {
              const csvText = await response.text();
              const wb = xlsx.read(csvText, { type: "string" });
              const sheetName = wb.SheetNames[0];
              const sheet = wb.Sheets[sheetName];
              summaryRows = getSheetRows(sheet);
              if (summaryRows.length > 0) {
                summarySuccess = true;
                break;
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (summarySuccess && summaryRows.length > 0) {
        console.log(`[SYNC] Priority Summary sheet found! Syncing only the Summary tab.`);
        
        // Build maps to fill in gaps for sessions
        const sessionMapByTopic = new Map<string, string>();
        const sessionMapByTrackTime = new Map<string, string>();
        
        for (const row of summaryRows) {
          const dateVal = findRowValue(row, ["date"]);
          const date = mapDay(dateVal);
          const track = findRowValue(row, ["track/screen no.", "track", "screen"]);
          const time = findRowValue(row, ["time", "timing"]);
          const topicHeading = findRowValue(row, ["topic heading", "topicheading"]).trim().toLowerCase();
          const sessionVal = findRowValue(row, ["sessionno", "session no", "session", "session name", "sessionname"]).trim();
          
          if (sessionVal) {
            if (topicHeading) {
              const key = `${date}|${track}|${topicHeading}`;
              sessionMapByTopic.set(key, sessionVal);
              sessionMapByTopic.set(topicHeading, sessionVal);
            }
            if (time) {
              const key2 = `${date}|${track}|${time}`;
              sessionMapByTrackTime.set(key2, sessionVal);
            }
          }
        }

        for (const row of summaryRows) {
          const parsed = parseRowToSyncRow(row, mappings, { sessionMapByTopic, sessionMapByTrackTime });
          if (!parsed.name || !isValidParticipantName(parsed.name)) continue;

          if (!parsed.role) {
            parsed.role = "Speaker";
          }
          syncRows.push(parsed);
        }
      } else {
        // Fallback: parse multiple tabs if no Summary sheet was found
        const tabConfig = [
          { name: "Speakers Directory", alt: ["Speakers", "Speaker Directory"] },
          { name: "Poster Schedule (2)", alt: ["Poster Schedule", "Poster", "Posters", "Poster Presentations"] },
          { name: "Chair", alt: ["Chairs"] },
          { name: "Co-Chair", alt: ["Co-Chairs", "CoChair", "Co Chair"] },
          { name: "Moderator", alt: ["Moderators"] },
          { name: "Panelist", alt: ["Panelists", "Panellist", "Panellists"] },
          { name: "Speaker", alt: ["Speakers"] },
        ];

        for (const config of tabConfig) {
          let rows: Record<string, any>[] = [];
          let success = false;
          const namesToTry = [config.name, ...config.alt];

          // 1. Try Google Sheets API first if credentials are configured
          if (authClient) {
            for (const name of namesToTry) {
              try {
                rows = await getSpreadsheetRows(spreadsheetId, name);
                if (rows.length > 0) {
                  success = true;
                  break;
                }
              } catch (apiErr: any) {
                console.log(`[Google Sheets API] Failed to fetch tab "${name}":`, apiErr.message);
              }
            }
          }

          // 2. Fallback to public CSV fetch if Google Sheets API was not configured or failed
          if (!success) {
            let csvText = "";
            for (const name of namesToTry) {
              try {
                const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
                const response = await fetch(fetchUrl);
                if (response.ok) {
                  csvText = await response.text();
                  success = true;
                  break;
                }
              } catch (e) {
                // ignore and try next
              }
            }

            if (success && csvText) {
              try {
                const wb = xlsx.read(csvText, { type: "string" });
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                rows = getSheetRows(sheet);
              } catch (err: any) {
                errors.push(`Failed to parse CSV tab "${config.name}": ${err.message}`);
                continue;
              }
            }
          }

          if (!success || rows.length === 0) {
            console.warn(`[SYNC] Did not find or parse tab "${config.name}" (tried names: ${namesToTry.join(", ")})`);
            continue;
          }

          try {
            const normalizedConfigName = config.name.toLowerCase();

            for (const row of rows) {
              const parsed = parseRowToSyncRow(row, mappings);
              if (!parsed.name || !isValidParticipantName(parsed.name)) continue;

              if (normalizedConfigName.includes("poster")) {
                parsed.role = "Poster";
              } else if (normalizedConfigName.includes("speakers directory")) {
                if (!parsed.role) {
                  parsed.role = "Speaker";
                }
              } else {
                parsed.role = mapRole(config.name);
              }

              syncRows.push(parsed);
            }
          } catch (err: any) {
            errors.push(`Failed to process rows for tab "${config.name}": ${err.message}`);
          }
        }
      }

      if (syncRows.length === 0) {
        res.status(400).json({ error: "No data could be synced. Ensure the Google Sheet is public and contains columns matching your session mappings.", errors });
        return;
      }

      const syncResult = await reconcileSync(syncRows);
      res.json({
        success: true,
        imported: syncResult.imported,
        skipped: syncResult.skipped,
        errors: [...errors, ...syncResult.errors],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to perform Google Sheets synchronization" });
    }
  }
);

// POST /participants/import-paid-list
// Upload a paid list Excel file and sync payment status — callable from admin UI, same logic as sync-paid-list.ts script
router.post(
  "/participants/import-paid-list",
  requireAuth(["admin", "super_admin"]),
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Please attach an Excel file (.xlsx)" });
      return;
    }

    const isNA = (val: any): boolean => {
      if (!val) return true;
      const s = String(val).trim().toLowerCase();
      return ["na", "n/a", "n.a.", "#n/a", "nil", "none", "null", "undefined", "-"].includes(s);
    };

    const cleanMobileLocal = (mobile: any): string | null => {
      if (!mobile || isNA(mobile)) return null;
      let s = String(mobile).trim();
      if (s.toLowerCase().includes("e")) {
        const num = Number(s);
        if (!isNaN(num)) s = String(Math.round(num));
      }
      if (s.includes(".")) s = s.split(".")[0];
      const digits = s.replace(/[^0-9]/g, "");
      return digits.length >= 10 ? digits.slice(-10) : null;
    };

    const getCleanMatchName = (name: string): string =>
      name.split(",")[0].trim()
        .toLowerCase()
        .replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();

    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<any>(sheet);

      if (rows.length <= 1) {
        res.json({ matched: 0, alreadyPaid: 0, newlyImported: 0, total: 0 });
        return;
      }

      const dataRows = rows.slice(1);
      let matched = 0;
      let alreadyPaid = 0;
      let newlyImported = 0;
      let mobileSeq = (await db.select({ id: participantsTable.id }).from(participantsTable)).length + 1;

      for (const row of dataRows) {
        const rawName = String(row["__EMPTY_4"] || "").trim();
        const rawMobile = row["__EMPTY_7"];
        const rawEmail = String(row["__EMPTY_8"] || "").trim().toLowerCase();
        const rawInst = String(row["__EMPTY_3"] || "").trim() || "Unknown Institution";
        const rawGender = String(row["__EMPTY_5"] || "").trim();
        const rawAddress = String(row["__EMPTY_10"] || "").trim();

        if (!rawName) continue;

        const cleanedMobile = cleanMobileLocal(rawMobile);
        const cleanedEmail = (rawEmail && !isNA(rawEmail)) ? rawEmail : null;

        const conditions: any[] = [];
        if (cleanedMobile) conditions.push(eq(participantsTable.mobile, cleanedMobile));
        if (cleanedEmail) conditions.push(eq(participantsTable.email, cleanedEmail));

        let matchedParticipant = null;
        if (conditions.length > 0) {
          const dbMatches = await db.select().from(participantsTable).where(or(...conditions));
          if (dbMatches.length > 0) matchedParticipant = dbMatches[0];
        }

        if (!matchedParticipant) {
          const cleanSearchName = getCleanMatchName(rawName);
          const cleanInst = rawInst.toLowerCase().trim();
          const allP = await db.select().from(participantsTable);
          matchedParticipant = allP.find(p => 
            getCleanMatchName(p.name) === cleanSearchName && 
            p.institution.toLowerCase().trim() === cleanInst
          ) || null;
        }

        if (matchedParticipant) {
          if (matchedParticipant.isPaid) {
            alreadyPaid++;
          } else {
            await db.update(participantsTable)
              .set({ isPaid: true, utrNumber: "00000" })
              .where(eq(participantsTable.id, matchedParticipant.id));
            matched++;
          }
        } else {
          const regNum = await getNextUniqueRegNumber();
          let finalMobile = cleanedMobile || null;
          const emailBase = rawName.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
          const finalEmail = cleanedEmail || `${emailBase}@conference.vision2020india.org`;

          await db.insert(participantsTable).values({
            registrationNumber: regNum,
            name: rawName,
            cleanName: getCleanName(rawName),
            email: finalEmail,
            mobile: finalMobile,
            institution: rawInst,
            gender: rawGender || null,
            address: rawAddress || null,
            isPaid: true,
            utrNumber: "00000",
          });
          newlyImported++;
        }
      }

      await db.insert(activityLogsTable).values({
        type: "registration",
        message: `Paid list Excel sync via API: ${matched} marked paid, ${newlyImported} newly imported, ${alreadyPaid} already paid.`,
      });

      res.json({ matched, alreadyPaid, newlyImported, total: dataRows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process paid list Excel file" });
    }
  }
);

// Helper for special pass registration numbers
async function getNextUniqueSpecialRegNumber(prefix: string): Promise<string> {
  const count = await db.select({ id: participantsTable.id }).from(participantsTable).where(ilike(participantsTable.registrationNumber, `${prefix}-%`));
  let idx = count.length + 1;
  while (true) {
    const candidate = `${prefix}-${String(idx).padStart(5, "0")}`;
    const existing = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, candidate));
    if (existing.length === 0) {
      return candidate;
    }
    idx++;
  }
}

// GET /participants/special-passes
router.get(
  "/participants/special-passes",
  requireAuth(["admin", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    try {
      const specialPasses = await db
        .select()
        .from(participantsTable)
        .where(
          inArray(participantsTable.delegateType, ["exhibitor", "vendor", "external", "crew", "committee"])
        );
      
      const passesWithFoodDetails = await Promise.all(
        specialPasses.map(async (p) => {
          const collectedCoupons = await db
            .select({
              foodSessionId: foodLogsTable.foodSessionId,
              collectedAt: foodLogsTable.collectedAt
            })
            .from(foodLogsTable)
            .where(eq(foodLogsTable.participantId, p.id));
          return {
            id: p.id,
            registrationNumber: p.registrationNumber,
            name: p.name,
            mobile: p.mobile || "",
            email: p.email || "",
            institution: p.institution,
            delegateType: p.delegateType,
            address: p.address || "",
            collectedCoupons,
          };
        })
      );
      res.json(passesWithFoodDetails);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve special passes" });
    }
  }
);

// POST /participants/special-passes
router.post(
  "/participants/special-passes",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const { name, mobile, institution, category, address } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: "Name and Category are required" });
      return;
    }
    const allowedCategories = ["exhibitor", "vendor", "external", "crew", "committee"];
    if (!allowedCategories.includes(category)) {
      res.status(400).json({ error: "Invalid category. Must be exhibitor, vendor, external, crew, or committee." });
      return;
    }

    try {
      let prefix = "CRW";
      if (category === "exhibitor") prefix = "EXH";
      if (category === "vendor") prefix = "VEN";
      if (category === "external") prefix = "EXT";
      if (category === "committee") prefix = "COM";

      const regNumber = await getNextUniqueSpecialRegNumber(prefix);
      
      let finalMobile = mobile ? cleanMobileNumber(mobile) : null;

      const emailBase = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/, "");
      const finalEmail = `${emailBase}@conference.vision2020india.org`;

      const [pass] = await db
        .insert(participantsTable)
        .values({
          registrationNumber: regNumber,
          name: name.trim(),
          mobile: finalMobile,
          email: finalEmail,
          institution: institution?.trim() || "Venue Team",
          address: address?.trim() || null,
          isPaid: true,
          delegateType: category,
        })
        .returning();

      await db.insert(activityLogsTable).values({
        type: "registration",
        message: `Created special pass: ${name} (${regNumber}) [${category}]`,
      });

      res.status(201).json({
        id: pass.id,
        registrationNumber: pass.registrationNumber,
        name: pass.name,
        mobile: pass.mobile,
        institution: pass.institution,
        delegateType: pass.delegateType,
        address: pass.address || "",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create special pass" });
    }
  }
);

// DELETE /participants/special-passes/:id
router.delete(
  "/participants/special-passes/:id",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    try {
      const [deleted] = await db
        .delete(participantsTable)
        .where(
          and(
            eq(participantsTable.id, id),
            inArray(participantsTable.delegateType, ["exhibitor", "vendor", "external", "crew", "committee"])
          )
        )
        .returning();

      if (!deleted) {
        res.status(404).json({ error: "Special pass not found or is not a special pass" });
        return;
      }

      await db.insert(activityLogsTable).values({
        type: "registration",
        message: `Deleted special pass: ${deleted.name} (${deleted.registrationNumber})`,
      });

      res.json({ success: true, message: "Special pass deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete special pass" });
    }
  }
);

// GET /participants/special-passes/qr-batch
router.get(
  "/participants/special-passes/qr-batch",
  requireAuth(["admin", "super_admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    try {
      const specialPasses = await db
        .select()
        .from(participantsTable)
        .where(
          inArray(participantsTable.delegateType, ["exhibitor", "vendor", "external", "crew", "committee"])
        );
      
      const archive = new ZipArchive({ zlib: { level: 9 } });
      res.setHeader("Content-Disposition", `attachment; filename="special_passes_qr_codes_${Date.now()}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      
      archive.on("error", (err: any) => {
        console.error("ZIP Archive Error:", err);
      });

      const baseUrl = getClientBaseUrl(req);

      for (const pass of specialPasses) {
        const cleanName = pass.name
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        const cleanReg = pass.registrationNumber
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        let cleanRole = pass.delegateType.trim().toUpperCase();
        if (pass.delegateType === "crew") {
          cleanRole = "TEAM_SANKARA";
        }

        const qrUrl = `${baseUrl}/q/${pass.registrationNumber}`;
        const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2 });
        
        archive.append(qrBuffer, { name: `${cleanName}_${cleanReg}_${cleanRole}.png` });
      }

      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to batch export QR codes" });
      }
    }
  }
);


// GET /participants/export
// Export all participants to Excel with QR code links (for ID card variable printing)
router.get(
  "/participants/export",
  requireAuth(["admin", "super_admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    try {
      const baseUrl = getClientBaseUrl(req);

      const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
      let query = db.select().from(participantsTable).$dynamic();
      if (eventIdParam && !isNaN(eventIdParam)) {
        query = query.where(eq(participantsTable.eventId, eventIdParam));
      }
      const participants = await query.orderBy(participantsTable.registrationNumber);

      const assignments = await db
        .select()
        .from(assignmentsTable);

      // Build assignment map per participant
      const assignMap: Record<number, any[]> = {};
      for (const a of assignments) {
        if (!assignMap[a.participantId]) assignMap[a.participantId] = [];
        assignMap[a.participantId].push(a);
      }

      // Build Excel rows — one row per participant
      const rows = participants.map((p) => {
        const roles = (assignMap[p.id] || []).map((a) => a.role).join(", ");
        const tracks = [...new Set((assignMap[p.id] || []).map((a) => a.track))].join(", ");
        const sessions = (assignMap[p.id] || []).map((a) => a.sessionName).filter(Boolean).join("; ");
        const qrUrl = `${baseUrl}/q/${p.registrationNumber}`;

        const paymentStatus = p.isPaid ? "Paid" : (p.isSponsored ? "Sponsored" : "Unpaid");

        return {
          "Event ID": p.eventId || "N/A",
          "Reg No.": p.registrationNumber,
          "Full Name": p.name,
          "Designation / Title": p.designation || "",
          "Institution / Org": p.institution || "",
          "Mobile Number": p.mobile ? `+91 ${p.mobile}` : "",
          "Email Address": p.email || "",
          "Payment Status": paymentStatus,
          "Payment Amount (INR)": p.paymentAmount ?? 0,
          "Razorpay Payment ID": p.paymentId || "",
          "Razorpay Order ID": p.orderId || "",
          "Approval Status": p.approvalStatus || "approved",
          "UTR Number": p.isPaid ? (p.utrNumber || "") : "NA",
          "Delegate Category": p.delegateType || "delegate",
          "Is Sponsored": p.isSponsored ? "Yes" : "No",
          "Sponsor Type": p.isSponsored ? (p.sponsorType || "") : "NA",
          "Role(s)": roles || "Attendee",
          "Track(s)": tracks,
          "Session(s)": sessions,
          "Registered At": p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
          "QR Code URL": qrUrl,
        };
      });

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rows);

      // Column widths
      ws["!cols"] = [
        { wch: 18 }, { wch: 32 }, { wch: 40 }, { wch: 14 }, { wch: 36 },
        { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
        { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 12 }, { wch: 10 },
        { wch: 22 }, { wch: 50 }, { wch: 50 },
      ];

      xlsx.utils.book_append_sheet(wb, ws, "Delegates");
      const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="delegates_export_${Date.now()}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to export participants" });
    }
  }
);

// GET /participants/export/full
// Full system export — participants + assignments + activity logs, attendance, food, goodies
router.get(
  "/participants/export/full",
  requireAuth(["admin", "super_admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    try {
      const baseUrl = getClientBaseUrl(req);

      const participants = await db.select().from(participantsTable).orderBy(participantsTable.registrationNumber);
      const assignments = await db.select().from(assignmentsTable).orderBy(assignmentsTable.participantId);
      const activityLogs = await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.id));
      const attendanceLogs = await db.select().from(attendanceLogsTable).orderBy(desc(attendanceLogsTable.id));
      const foodLogs = await db.select().from(foodLogsTable).orderBy(desc(foodLogsTable.id));
      const goodiesLogs = await db.select().from(goodiesLogsTable).orderBy(desc(goodiesLogsTable.id));

      // Participant name lookup map
      const nameMap: Record<number, string> = {};
      const regMap: Record<number, string> = {};
      for (const p of participants) {
        nameMap[p.id] = p.name;
        regMap[p.id] = p.registrationNumber;
      }

      // Assignment name lookup map
      const assignmentMap: Record<number, string> = {};
      for (const a of assignments) {
        assignmentMap[a.id] = nameMap[a.participantId] || `#${a.participantId}`;
      }

      const wb = xlsx.utils.book_new();

      // Sheet 1: All Participants
      const partRows = participants.map((p) => ({
        "Reg No.": p.registrationNumber,
        "Name": p.name,
        "Institution": p.institution,
        "Mobile": p.mobile || "",
        "Email": p.email || "",
        "Payment": p.isPaid ? "Paid" : (p.isSponsored ? "Sponsored" : "Unpaid"),
        "UTR": p.isPaid ? (p.utrNumber || "") : "NA",
        "Type": p.delegateType || "delegate",
        "Sponsored": p.isSponsored ? "Yes" : "No",
        "Sponsor Type": p.isSponsored ? (p.sponsorType || "") : "NA",
        "On-Spot": p.isOnSpot ? "Yes" : "No",
        "Linked": p.isOnSpotLinked ? "Yes" : "No",
        "Onboarded": p.isOnSpotOnboarded ? "Yes" : "No",
        "Active": p.isActive ? "Yes" : "No",
        "Gender": p.gender || "",
        "Age": p.age || "",
        "Address": p.address || "",
        "QR URL": `${baseUrl}/q/${p.registrationNumber}`,
        "Registered On": p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      }));
      const ws1 = xlsx.utils.json_to_sheet(partRows);
      ws1["!cols"] = Array(19).fill({ wch: 25 });
      xlsx.utils.book_append_sheet(wb, ws1, "All Participants");

      // Sheet 2: Assignments
      const assignRows = assignments.map((a) => ({
        "Assignment ID": a.id,
        "Reg No.": regMap[a.participantId] || "",
        "Participant Name": nameMap[a.participantId] || `#${a.participantId}`,
        "Role": a.role || "",
        "Track": a.track || "",
        "Session Name": a.sessionName || "",
        "Hall": a.hall || "",
        "Date": a.date || "",
        "Time": a.time || "",
        "Presentation Title": a.presentationTitle || "",
        "Created On": a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      }));
      const ws2 = xlsx.utils.json_to_sheet(assignRows);
      ws2["!cols"] = Array(11).fill({ wch: 28 });
      xlsx.utils.book_append_sheet(wb, ws2, "Assignments");

      // Sheet 3: Attendance Logs
      const attendRows = attendanceLogs.map((l: any) => ({
        "Log ID": l.id,
        "Participant Name": nameMap[l.participantId] || `#${l.participantId}`,
        "Reg No.": regMap[l.participantId] || "",
        "Scanned At": l.scannedAt ? new Date(l.scannedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        "Scanned By": l.scannedBy || "",
        "Location": l.location || "",
      }));
      const ws3 = xlsx.utils.json_to_sheet(attendRows);
      ws3["!cols"] = Array(6).fill({ wch: 30 });
      xlsx.utils.book_append_sheet(wb, ws3, "Attendance Logs");

      // Sheet 4: Food Logs
      const foodRows = foodLogs.map((l: any) => ({
        "Log ID": l.id,
        "Participant Name": nameMap[l.participantId] || `#${l.participantId}`,
        "Reg No.": regMap[l.participantId] || "",
        "Food Session ID": l.foodSessionId || "",
        "Logged At": l.loggedAt ? new Date(l.loggedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        "Logged By": l.loggedBy || "",
      }));
      const ws4 = xlsx.utils.json_to_sheet(foodRows);
      ws4["!cols"] = Array(6).fill({ wch: 30 });
      xlsx.utils.book_append_sheet(wb, ws4, "Food Logs");

      // Sheet 5: Goodies Logs
      const goodiesRows = goodiesLogs.map((l: any) => ({
        "Log ID": l.id,
        "Participant Name": nameMap[l.participantId] || `#${l.participantId}`,
        "Reg No.": regMap[l.participantId] || "",
        "Item": l.item || "",
        "Logged At": l.loggedAt ? new Date(l.loggedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        "Logged By": l.loggedBy || "",
      }));
      const ws5 = xlsx.utils.json_to_sheet(goodiesRows);
      ws5["!cols"] = Array(6).fill({ wch: 30 });
      xlsx.utils.book_append_sheet(wb, ws5, "Goodies Logs");

      // Sheet 6: Activity Logs
      const actRows = activityLogs.map((l: any) => ({
        "Log ID": l.id,
        "Type": l.type || "",
        "Message": l.message || "",
        "Created At": l.createdAt ? new Date(l.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      }));
      const ws6 = xlsx.utils.json_to_sheet(actRows);
      ws6["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 80 }, { wch: 25 }];
      xlsx.utils.book_append_sheet(wb, ws6, "Activity Logs");

      const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="vision2020_full_export_${Date.now()}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate full export" });
    }
  }
);

// GET /participants/:id
router.get(
  "/participants/:id",
  requireAuth(["admin", "track_coordinator", "scientific_committee", "participant", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    const params = GetParticipantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = req.user!;
    // Participant can only see their own record
    if (user.userType === "participant" && user.participantId !== params.data.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, params.data.id));

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, params.data.id));

    const assignmentsWithFiles = await Promise.all(
      assignments.map(async (a) => {
        const [file] = await db
          .select()
          .from(uploadedFilesTable)
          .where(eq(uploadedFilesTable.assignmentId, a.id))
          .orderBy(desc(uploadedFilesTable.version));
        return {
          id: a.id,
          participantId: a.participantId,
          role: a.role,
          track: a.track,
          sessionName: a.sessionName,
          hall: a.hall,
          date: a.date,
          time: a.time,
          presentationTitle: a.presentationTitle,
          fileId: file?.id ?? null,
          uploadedFile: file
            ? {
                id: file.id,
                assignmentId: file.assignmentId,
                filename: file.filename,
                originalName: file.originalName,
                fileType: file.fileType,
                version: file.version,
                size: file.size,
                uploadedAt: file.uploadedAt.toISOString(),
              }
            : null,
        };
      })
    );

    const [attendanceLog] = await db
      .select()
      .from(attendanceLogsTable)
      .where(eq(attendanceLogsTable.participantId, participant.id));
    const attendanceMarked = !!attendanceLog;

    const [goodiesLog] = await db
      .select()
      .from(goodiesLogsTable)
      .where(eq(goodiesLogsTable.participantId, participant.id));
    const goodiesCollected = !!goodiesLog;

    const foodSessions = await db
      .select()
      .from(foodSessionsTable)
      .where(eq(foodSessionsTable.enabled, true));

    const foodCoupons = await Promise.all(
      foodSessions.map(async (s) => {
        const [collectedLog] = await db
          .select()
          .from(foodLogsTable)
          .where(
            and(
              eq(foodLogsTable.participantId, participant.id),
              eq(foodLogsTable.foodSessionId, s.id)
            )
          );
        return {
          foodSessionId: s.id,
          name: s.name,
          date: s.date,
          collected: !!collectedLog,
          collectedAt: collectedLog ? collectedLog.collectedAt.toISOString() : null,
        };
      })
    );

    res.json({
      id: participant.id,
      registrationNumber: participant.registrationNumber,
      name: participant.name,
      email: participant.email || "",
      mobile: participant.mobile || "",
      institution: participant.institution,
      createdAt: participant.createdAt.toISOString(),
      hasPassword: !!participant.passwordHash,
      assignments: assignmentsWithFiles,
      attendanceMarked,
      attendanceScannedAt: attendanceLog ? attendanceLog.scannedAt.toISOString() : null,
      goodiesCollected,
      goodiesCollectedAt: goodiesLog ? goodiesLog.scannedAt.toISOString() : null,
      foodCoupons,
      isPaid: participant.isPaid,
      utrNumber: participant.utrNumber,
      isActive: participant.isActive,
      isSponsored: participant.isSponsored,
      sponsorType: participant.sponsorType,
      delegateType: participant.delegateType,
    });
  }
);

// PATCH /participants/:id
router.patch(
  "/participants/:id",
  requireAuth(["admin", "track_coordinator", "scientific_committee", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    const params = UpdateParticipantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateParticipantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existingParticipant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, params.data.id));

    if (!existingParticipant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    if (parsed.data.mobile) {
      parsed.data.mobile = cleanMobileNumber(parsed.data.mobile) || parsed.data.mobile;
    }

    // Bypass duplicate check for On-Spot cards
    if (!existingParticipant.isOnSpot && (parsed.data.email || parsed.data.mobile)) {
      const checkDuplicate = await checkEmailOrMobileRegistered({
        email: parsed.data.email,
        mobile: parsed.data.mobile,
        excludeParticipantId: params.data.id,
      });
      if (checkDuplicate) {
        res.status(400).json({ error: checkDuplicate.reason });
        return;
      }
    }
    if (parsed.data.isOnSpotLinked === false) {
      // Purge all scan/collection logs associated with this participant ID
      await db.delete(attendanceLogsTable).where(eq(attendanceLogsTable.participantId, params.data.id));
      await db.delete(goodiesLogsTable).where(eq(goodiesLogsTable.participantId, params.data.id));
      await db.delete(foodLogsTable).where(eq(foodLogsTable.participantId, params.data.id));

      // Reset participant to pristine/empty states
      const [participant] = await db
        .update(participantsTable)
        .set({
          ...parsed.data,
          cleanName: parsed.data.name ? getCleanName(parsed.data.name) : undefined,
          age: null,
          gender: null,
          address: null,
          passwordHash: null,
          resetToken: null,
          resetTokenExpiry: null,
        })
        .where(eq(participantsTable.id, params.data.id))
        .returning();

      if (!participant) {
        res.status(404).json({ error: "Participant not found" });
        return;
      }
      const assignments = await db
        .select({ id: assignmentsTable.id })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.participantId, participant.id));
      for (const a of assignments) {
        await handleFileRenamingForAssignment(a.id);
      }
      res.json(buildParticipantResponse(participant));
      return;
    }

    const [participant] = await db
      .update(participantsTable)
      .set({
        ...parsed.data,
        cleanName: parsed.data.name ? getCleanName(parsed.data.name) : undefined,
      })
      .where(eq(participantsTable.id, params.data.id))
      .returning();
    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // Automatically mark attendance and goodies for onboarded on-spot participants
    if (participant.isOnSpot && participant.isOnSpotOnboarded) {
      try {
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

        const currentDay = getCurrentConferenceDay();
        const [existingAtt] = await db
          .select()
          .from(attendanceLogsTable)
          .where(and(
            eq(attendanceLogsTable.participantId, participant.id),
            eq(attendanceLogsTable.day, currentDay)
          ));
        if (!existingAtt) {
          await db.insert(attendanceLogsTable).values({ participantId: participant.id, day: currentDay });
        }

        const [existingGoodies] = await db
          .select()
          .from(goodiesLogsTable)
          .where(eq(goodiesLogsTable.participantId, participant.id));
        if (!existingGoodies) {
          await db.insert(goodiesLogsTable).values({ participantId: participant.id });
        }
      } catch (err) {
        console.error("Failed to automatically mark attendance/goodies during admin edit:", err);
      }
    }

    const assignments = await db
      .select({ id: assignmentsTable.id })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, participant.id));
    for (const a of assignments) {
      await handleFileRenamingForAssignment(a.id);
    }

    // Google Sheets API Write-back
    try {
      const [activeSession] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.isActive, true))
        .limit(1);

      if (activeSession && activeSession.googleSheetId && activeSession.sheetName) {
        updateSpreadsheetParticipant(
          activeSession.googleSheetId,
          activeSession.sheetName,
          participant.name,
          {
            mobile: participant.mobile || "",
            email: participant.email || "",
          }
        ).catch(err => {
          console.error("[Google Sheets Write-back] Background update failed:", err.message);
        });
      }
    } catch (sheetErr: any) {
      console.error("[Google Sheets Write-back] Failed to trigger background update:", sheetErr.message);
    }

    res.json(buildParticipantResponse(participant));
  }
);

// DELETE /participants/:id
router.delete(
  "/participants/:id",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const params = DeleteParticipantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(participantsTable)
      .where(eq(participantsTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }
    res.sendStatus(204);
  }
);

// POST /participants/bulk-delete
router.post(
  "/participants/bulk-delete",
  requireAuth(["admin"]),
  async (req, res): Promise<void> => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids array is required and must not be empty" });
      return;
    }

    try {
      await db.transaction(async (tx) => {
        // Purge scan logs/collection logs first to avoid foreign key violations
        await tx.delete(attendanceLogsTable).where(inArray(attendanceLogsTable.participantId, ids));
        await tx.delete(goodiesLogsTable).where(inArray(goodiesLogsTable.participantId, ids));
        await tx.delete(foodLogsTable).where(inArray(foodLogsTable.participantId, ids));
        
        // Delete assignments associated with these participants
        await tx.delete(assignmentsTable).where(inArray(assignmentsTable.participantId, ids));

        // Delete the participants
        await tx.delete(participantsTable).where(inArray(participantsTable.id, ids));
      });

      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to bulk delete participants" });
    }
  }
);

// GET /participants/by-mobile/:mobile
router.get(
  "/participants/by-mobile/:mobile",
  requireAuth(),
  async (req, res): Promise<void> => {
    const params = GetParticipantByMobileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.mobile, params.data.mobile));

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, participant.id));

    res.json({
      ...buildParticipantResponse(participant),
      assignments: assignments.map((a) => ({
        id: a.id,
        participantId: a.participantId,
        role: a.role,
        track: a.track,
        sessionName: a.sessionName,
        hall: a.hall,
        date: a.date,
        time: a.time,
        presentationTitle: a.presentationTitle,
        fileId: null,
        uploadedFile: null,
      })),
    });
  }
);

// GET /participants/:id/qr
router.get(
  "/participants/:id/qr",
  requireAuth(),
  async (req, res): Promise<void> => {
    const params = GetParticipantQRParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = req.user!;
    if (user.userType === "participant" && user.participantId !== params.data.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, params.data.id));
    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const baseUrl = getClientBaseUrl(req);

    const [qr1DataUrl, qr2DataUrl] = await Promise.all([
      // QR1 encodes the smart landing URL — works for both attendee (agenda) and staff (scan actions)
      QRCode.toDataURL(`${baseUrl}/q/${participant.registrationNumber}`, { width: 300, margin: 2 }),
      // QR2 encodes the general agenda portal landing page (common for all ID holders)
      QRCode.toDataURL(`${baseUrl}`, { width: 300, margin: 2 }),
    ]);

    const firstName = participant.name.split(" ")[0];
    res.json({
      qr1: {
        type: "registration",
        dataUrl: qr1DataUrl,
        label: "Registration QR (for attendance, goodies & food)",
        downloadName: `${firstName}_RegistrationQR.png`,
      },
      qr2: {
        type: "personal_agenda",
        dataUrl: qr2DataUrl,
        label: "Agenda Portal QR (Personal & General)",
        downloadName: `${firstName}_AgendaPortalQR.png`,
      },
    });
  }
);


export default router;
