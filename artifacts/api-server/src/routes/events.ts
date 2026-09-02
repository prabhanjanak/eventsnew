import { Router, type Request, type Response } from "express";
import { eq, sql, desc, and, or, inArray } from "drizzle-orm";
import { db, eventsTable, participantsTable, attendanceLogsTable, foodLogsTable, systemUsersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const uploadPdf = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF documents are allowed"));
    }
  },
});

const router = Router();

// Helper to generate a clean slug
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// ── Multi-Role Event Pricing Tiers & Early Bird Resolver ──────────────────────
export function resolvePricingTiers(event: any) {
  if (event.pricingTiersJson) {
    try {
      const parsed = JSON.parse(event.pricingTiersJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
  }

  // 30 days early bird deadline default
  const earlyBirdDeadlineDate = new Date();
  earlyBirdDeadlineDate.setDate(earlyBirdDeadlineDate.getDate() + 30);
  const deadlineIso = earlyBirdDeadlineDate.toISOString().split("T")[0];

  if (!event.isPaid) {
    return [
      {
        id: "attendee",
        name: "General Attendee",
        role: "attendee",
        price: 0,
        earlyBirdPrice: 0,
        earlyBirdDeadline: deadlineIso,
        description: "Complimentary general admission pass for registered attendees.",
        inclusions: ["Access to General Sessions", "Digital QR Pass", "E-Certificate of Participation"],
        popular: false,
      },
      {
        id: "delegate",
        name: "Official Delegate",
        role: "delegate",
        price: 0,
        earlyBirdPrice: 0,
        earlyBirdDeadline: deadlineIso,
        description: "Full clinical delegation pass for doctors, optometrists and hospital staff.",
        inclusions: ["Priority Hall Seating", "All Academic Tracks & CME", "Delegate Goodie Bag", "Catering & Lunch"],
        popular: true,
      },
      {
        id: "member",
        name: "Trust / Alumni Member",
        role: "member",
        price: 0,
        earlyBirdPrice: 0,
        earlyBirdDeadline: deadlineIso,
        description: "Special institutional member accreditation pass.",
        inclusions: ["Member Lounge Access", "Academic CME Credits", "Conference Kit", "Complimentary Refreshments"],
        popular: false,
      },
    ];
  }

  const baseFee = event.registrationFee || 1500;

  return [
    {
      id: "attendee",
      name: "General Attendee",
      role: "attendee",
      price: baseFee,
      earlyBirdPrice: Math.round(baseFee * 0.8), // e.g. 1200 for 1500
      earlyBirdDeadline: deadlineIso,
      description: "Ideal for observers, hospital visitors, and general delegates.",
      inclusions: [
        "Access to Keynote & Main Stage",
        "Digital Event Pass & Dynamic QR",
        "E-Certificate of Attendance",
        "Conference Lunch & Refreshments"
      ],
      badgeLabel: "Early Bird 20% OFF",
      popular: false,
    },
    {
      id: "delegate",
      name: "Official CME Delegate",
      role: "delegate",
      price: Math.max(3000, Math.round(baseFee * 2)),
      earlyBirdPrice: Math.max(2400, Math.round(baseFee * 1.6)),
      earlyBirdDeadline: deadlineIso,
      description: "Full clinical conference delegation with accredited CME points.",
      inclusions: [
        "Priority Seating in Grand Auditorium",
        "Accredited Medical Council CME Credits",
        "Hands-on Surgical & Clinical Workshops",
        "Premium Delegate Kit & Bag",
        "Gala Networking Dinner & Lunch"
      ],
      badgeLabel: "Most Popular",
      popular: true,
    },
    {
      id: "member",
      name: "Sankara / AIOS Member",
      role: "member",
      price: Math.max(2000, Math.round(baseFee * 1.33)),
      earlyBirdPrice: Math.max(1600, Math.round(baseFee * 1.05)),
      earlyBirdDeadline: deadlineIso,
      description: "Exclusive subsidized tariff for active institutional and society members.",
      inclusions: [
        "Subsidized Member Registration Tariff",
        "Access to Exclusive Member Lounge",
        "All CME Academic Tracks & Symposia",
        "Special Member Certificate & Badge",
        "Complete Delegate Dining & Refreshments"
      ],
      badgeLabel: "Member Tariff",
      popular: false,
    },
    {
      id: "non_member",
      name: "Non-Member Physician",
      role: "non_member",
      price: Math.max(2800, Math.round(baseFee * 1.85)),
      earlyBirdPrice: Math.max(2200, Math.round(baseFee * 1.45)),
      earlyBirdDeadline: deadlineIso,
      description: "Standard registration for non-member practicing clinicians and surgeons.",
      inclusions: [
        "Full 3-Day Scientific Conference Access",
        "CME Credit Accreditation Certificate",
        "Conference Proceeding Papers & Video Library",
        "Delegate Welcome Kit",
        "All-Days Refreshments & Lunch"
      ],
      badgeLabel: "Standard",
      popular: false,
    },
    {
      id: "student_pg",
      name: "PG Resident / Fellow",
      role: "student",
      price: Math.max(999, Math.round(baseFee * 0.65)),
      earlyBirdPrice: Math.max(799, Math.round(baseFee * 0.5)),
      earlyBirdDeadline: deadlineIso,
      description: "Special subsidized rate for post-graduate students, residents, and research fellows.",
      inclusions: [
        "Heavy Subsidized Student Fee",
        "Poster & Paper Presentation Eligibility",
        "Resident Mentorship Masterclass Access",
        "Digital Certificate of Merit / Attendance",
        "Student Lunch & Refreshments"
      ],
      badgeLabel: "Student Rate",
      popular: false,
    },
  ];
}

// ── GET /api/events ─────────────────────────────────────────────────────────────
// Public or Admin listing of events
router.get("/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let isStaff = false;
    let userId: number | null = null;
    let userType: string | null = null;
    let assignedEventIds: number[] = [];

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const { verifyToken } = await import("../lib/auth");
        const decoded = verifyToken(token) as any;
        if (decoded && decoded.userType !== "participant") {
          isStaff = true;
          userId = decoded.id;
          userType = decoded.userType;
          if (userId) {
            const [user] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, userId));
            if (user) {
              assignedEventIds = (user.assignedEventIds as number[]) || [];
            }
          }
        }
      } catch {
        // Unauthenticated request, proceed as public
      }
    }

    const eventTypeFilter = req.query.type as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    let query = db.select().from(eventsTable);
    const conditions = [];

    if (!isStaff) {
      // Public sees published, ongoing, completed, and archived events (omits unpublished drafts)
      conditions.push(
        or(
          eq(eventsTable.status, "published"),
          eq(eventsTable.status, "ongoing"),
          eq(eventsTable.status, "completed"),
          eq(eventsTable.status, "archived")
        )
      );
    } else if (userType !== "super_admin" && userType !== "admin" && assignedEventIds.length > 0) {
      // Event coordinator only sees assigned events
      conditions.push(inArray(eventsTable.id, assignedEventIds));
    }

    if (eventTypeFilter) {
      conditions.push(eq(eventsTable.eventType, eventTypeFilter));
    }
    if (statusFilter && isStaff) {
      conditions.push(eq(eventsTable.status, statusFilter));
    }

    const eventsList = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(eventsTable.createdAt))
      : await query.orderBy(desc(eventsTable.createdAt));

    // Attach participant counts and seats left
    const enriched = await Promise.all(
      eventsList.map(async (ev) => {
        const [partCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(participantsTable)
          .where(eq(participantsTable.eventId, ev.id));
        const [pendingCount] = isStaff
          ? await db
              .select({ count: sql<number>`count(*)::int` })
              .from(participantsTable)
              .where(and(eq(participantsTable.eventId, ev.id), eq(participantsTable.approvalStatus, "pending")))
          : [{ count: 0 }];

        const totalReg = partCount?.count || 0;
        const maxCap = ev.maxCapacity || 500;
        const seatsLeft = Math.max(0, maxCap - totalReg);

        return {
          ...ev,
          totalRegistered: totalReg,
          totalParticipants: totalReg,
          pendingApprovals: pendingCount?.count || 0,
          seatsLeft,
          isFull: totalReg >= maxCap,
        };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch events" });
  }
});

// ── Multi-image upload for post-event gallery ────────────────────────────────
const uploadGallery = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|avif|heic|heif|bmp|svg)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, PNG, WEBP, HEIC, etc.) are allowed for post-event gallery."));
    }
  },
});

router.post(
  "/events/upload-gallery",
  requireAuth(),
  (req: Request, res: Response, next: any): void => {
    uploadGallery.array("images", 50)(req, res, (err: any) => {
      if (err) {
        res.status(400).json({ error: err.message || "Image upload failed" });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No image files uploaded" });
        return;
      }

      const { getClientBaseUrl } = await import("../lib/ip-helper");
      const baseUrl = getClientBaseUrl(req);

      const uploaded = files.map((f) => ({
        url: `${baseUrl}/api/uploads/${f.filename}`,
        filename: f.filename,
        originalName: f.originalname,
      }));

      res.json({ success: true, count: uploaded.length, files: uploaded });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process uploaded images" });
    }
  }
);

// ── Check pending wrapup alerts for concluded events ─────────────────────────
router.get(
  "/events/alerts/pending-wrapup",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const todayIso = new Date().toISOString().split("T")[0];
      const allEvents = await db.select().from(eventsTable);

      const pendingEvents = allEvents.filter((ev) => {
        const end = ev.endDate || ev.startDate;
        const isPast = end < todayIso;
        const isWrapupPending = !ev.postEventCompleted;
        return isPast && isWrapupPending;
      });

      res.json({
        hasPendingAlerts: pendingEvents.length > 0,
        pendingEvents: pendingEvents.map((ev) => ({
          id: ev.id,
          title: ev.title,
          slug: ev.slug,
          endDate: ev.endDate,
          startDate: ev.startDate,
          status: ev.status,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch wrapup alerts" });
    }
  }
);

// ── Submit post-event wrapup & gallery (Min 10 photos required) ───────────────
router.post(
  "/events/:id/post-event-wrapup",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid event ID" });
        return;
      }

      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const todayIso = new Date().toISOString().split("T")[0];
      const eventEnd = event.endDate || event.startDate;

      // Gate: Only available after the event end date
      if (eventEnd > todayIso) {
        res.status(400).json({
          error: `Post-event wrapup is only available after the event has concluded (End Date: ${eventEnd}).`,
        });
        return;
      }

      const {
        postEventSummary,
        postEventDescription,
        postEventEndingNotes,
        postEventVisitorCount,
        postEventGallery,
      } = req.body as {
        postEventSummary?: string;
        postEventDescription?: string;
        postEventEndingNotes?: string;
        postEventVisitorCount?: number;
        postEventGallery?: string[];
      };

      const galleryList = Array.isArray(postEventGallery) ? postEventGallery.filter(Boolean) : [];

      // Validation: Minimum 10 photos strictly required
      if (galleryList.length < 10) {
        res.status(400).json({
          error: `A minimum of 10 event photos must be uploaded. You currently have ${galleryList.length} photo(s).`,
        });
        return;
      }

      if (!postEventSummary || !postEventSummary.trim()) {
        res.status(400).json({ error: "Event summary / about the event is required." });
        return;
      }

      if (postEventVisitorCount === undefined || isNaN(Number(postEventVisitorCount)) || Number(postEventVisitorCount) < 1) {
        res.status(400).json({ error: "Please enter a valid visitor count (minimum 1)." });
        return;
      }

      if (!postEventDescription || !postEventDescription.trim()) {
        res.status(400).json({ error: "Event description / highlights are required." });
        return;
      }

      if (!postEventEndingNotes || !postEventEndingNotes.trim()) {
        res.status(400).json({ error: "Concluding / ending notes are required." });
        return;
      }

      // Save wrapup details and mark event as completed & wrapup done
      await db
        .update(eventsTable)
        .set({
          postEventSummary: postEventSummary.trim(),
          postEventDescription: postEventDescription.trim(),
          postEventEndingNotes: postEventEndingNotes.trim(),
          postEventVisitorCount: Number(postEventVisitorCount),
          postEventGalleryJson: JSON.stringify(galleryList),
          postEventCompleted: true,
          postEventCompletedAt: new Date(),
          status: "completed",
        })
        .where(eq(eventsTable.id, id));

      res.json({
        success: true,
        message: `Event wrapup completed successfully with ${galleryList.length} photos. Status marked as Completed.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to submit post-event wrapup" });
    }
  }
);

// ── GET /api/events/:slugOrId ───────────────────────────────────────────────────
// Retrieve single event by slug (case-insensitive) or integer ID
router.get("/events/:slugOrId", async (req: Request, res: Response): Promise<void> => {
  try {
    const slugOrId = String(req.params.slugOrId || "").trim();
    const isNumeric = /^\d+$/.test(slugOrId);

    let event;
    if (isNumeric) {
      [event] = await db
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, parseInt(slugOrId, 10)));
    } else {
      [event] = await db
        .select()
        .from(eventsTable)
        .where(eq(sql`LOWER(${eventsTable.slug})`, slugOrId.toLowerCase()));
    }

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const [partCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(participantsTable)
      .where(eq(participantsTable.eventId, event.id));

    const totalReg = partCount?.count || 0;
    const maxCap = event.maxCapacity || 500;
    const seatsLeft = Math.max(0, maxCap - totalReg);
    const pricingTiers = resolvePricingTiers(event);

    res.json({
      ...event,
      totalRegistered: totalReg,
      totalParticipants: totalReg,
      maxCapacity: maxCap,
      seatsLeft,
      pricingTiers,
      isFull: totalReg >= maxCap,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch event" });
  }
});

// ── POST /api/events ────────────────────────────────────────────────────────────
// Create a new event (Super Admin only)
router.post("/events", requireAuth(["super_admin"]), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body.title || !body.startDate || !body.endDate) {
      res.status(400).json({ error: "Title, start date, and end date are required" });
      return;
    }

    const slug = body.slug ? slugify(body.slug) : slugify(body.title + "-" + new Date().getFullYear());

    // Check slug uniqueness
    const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const [newEvent] = await db
      .insert(eventsTable)
      .values({
        slug: finalSlug,
        title: body.title.trim(),
        eventType: body.eventType || "conference",
        description: body.description || "",
        shortDescription: body.shortDescription || "",
        venue: body.venue || "Sankara Eye Hospital",
        city: body.city || "Coimbatore",
        locationMapUrl: body.locationMapUrl || null,
        startDate: body.startDate,
        endDate: body.endDate,
        timeFrom: body.timeFrom || "09:00 AM",
        timeTo: body.timeTo || "05:00 PM",
        isPaid: Boolean(body.isPaid),
        registrationFee: Number(body.registrationFee) || 0,
        currency: body.currency || "INR",
        requiresApproval: Boolean(body.requiresApproval),
        registrationOpen: body.registrationOpen !== false,
        maxCapacity: body.maxCapacity ? Number(body.maxCapacity) : null,
        enableAttendance: body.enableAttendance !== false,
        attendanceDaysCount: Number(body.attendanceDaysCount) || 1,
        enableFood: body.enableFood !== false,
        enableGoodies: body.enableGoodies !== false,
        organizerName: body.organizerName || "Sankara Eye Care Institutions",
        organizerEmail: body.organizerEmail || null,
        organizerPhone: body.organizerPhone || null,
        spocName: body.spocName || null,
        spocDesignation: body.spocDesignation || null,
        spocPhone: body.spocPhone || null,
        spocEmail: body.spocEmail || null,
        cancellationPolicy: body.cancellationPolicy || null,
        requireDocumentUpload: Boolean(body.requireDocumentUpload),
        documentUploadLabel: body.documentUploadLabel || "Upload Medical Council Certificate / Student ID",
        documentUploadRequired: Boolean(body.documentUploadRequired),
        groupRegistrationEnabled: body.groupRegistrationEnabled !== false,
        themeColor: body.themeColor || "#18181B",
        accentColor: body.accentColor || "#6366F1",
        bannerUrl: body.bannerUrl || null,
        logoUrl: body.logoUrl || null,
        agendaPdfUrl: body.agendaPdfUrl || null,
        agendaPdfButtonText: body.agendaPdfButtonText || "Download Event Agenda (PDF)",
        customPdfUrl: body.customPdfUrl || null,
        customPdfButtonText: body.customPdfButtonText || "View Document (PDF)",
        awardsPdfUrl: body.awardsPdfUrl || null,
        awardsPdfButtonText: body.awardsPdfButtonText || "Download Awards & Winners List (PDF)",
        externalPhotosUrl: body.externalPhotosUrl || null,
        externalPhotosButtonText: body.externalPhotosButtonText || "View AI Event Photos (Samaro AI / Photomall)",
        pdfAttachmentsJson: body.pdfAttachmentsJson ? (typeof body.pdfAttachmentsJson === "string" ? body.pdfAttachmentsJson : JSON.stringify(body.pdfAttachmentsJson)) : null,
        agendaJson: body.agendaJson ? (typeof body.agendaJson === "string" ? body.agendaJson : JSON.stringify(body.agendaJson)) : null,
        pricingTiersJson: body.pricingTiersJson ? (typeof body.pricingTiersJson === "string" ? body.pricingTiersJson : JSON.stringify(body.pricingTiersJson)) : null,
        feedbackFormJson: body.feedbackFormJson ? (typeof body.feedbackFormJson === "string" ? body.feedbackFormJson : JSON.stringify(body.feedbackFormJson)) : null,
        certificateTemplateJson: body.certificateTemplateJson ? (typeof body.certificateTemplateJson === "string" ? body.certificateTemplateJson : JSON.stringify(body.certificateTemplateJson)) : null,
        prePostTestJson: body.prePostTestJson ? (typeof body.prePostTestJson === "string" ? body.prePostTestJson : JSON.stringify(body.prePostTestJson)) : null,
        razorpayKeyId: body.razorpayKeyId || null,
        razorpayKeySecret: body.razorpayKeySecret || null,
        badgeSubtitle: body.badgeSubtitle || null,
        badgeFooterText: body.badgeFooterText || null,
        status: body.status || "published",
      })
      .returning();

    // If coordinators assigned on creation
    if (Array.isArray(body.assignedCoordinatorIds) && body.assignedCoordinatorIds.length > 0) {
      for (const coordId of body.assignedCoordinatorIds) {
        const [u] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, Number(coordId)));
        if (u) {
          const currentEvents = (u.assignedEventIds as number[]) || [];
          if (!currentEvents.includes(newEvent.id)) {
            await db.update(systemUsersTable)
              .set({ assignedEventIds: [...currentEvents, newEvent.id] })
              .where(eq(systemUsersTable.id, u.id));
          }
        }
      }
    }

    res.status(201).json({ success: true, event: newEvent });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create event" });
  }
});

// ── POST /api/events/upload-pdf ────────────────────────────────────────────────
// Upload event PDF document (Agenda, Scientific Program, Floor Map)
router.post(
  "/events/upload-pdf",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  uploadPdf.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No PDF file was provided." });
        return;
      }

      const fileUrl = `/api/uploads/${req.file.filename}`;
      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "PDF upload failed" });
    }
  }
);

// ── PUT /api/events/:id ─────────────────────────────────────────────────────────
// Update event (Super Admin or assigned Coordinator)
router.put("/events/:id", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    const user = req.user!;
    if (user.userType !== "super_admin" && user.userType !== "admin") {
      const [sysUser] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, user.id));
      const assigned = (sysUser?.assignedEventIds as number[]) || [];
      if (!assigned.includes(id)) {
        res.status(403).json({ error: "You are not authorized to edit this event" });
        return;
      }
    }

    const body = req.body;
    const updates: Record<string, any> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.eventType !== undefined) updates.eventType = body.eventType;
    if (body.description !== undefined) updates.description = body.description;
    if (body.shortDescription !== undefined) updates.shortDescription = body.shortDescription;
    if (body.venue !== undefined) updates.venue = body.venue;
    if (body.city !== undefined) updates.city = body.city;
    if (body.locationMapUrl !== undefined) updates.locationMapUrl = body.locationMapUrl;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.endDate !== undefined) updates.endDate = body.endDate;
    if (body.timeFrom !== undefined) updates.timeFrom = body.timeFrom;
    if (body.timeTo !== undefined) updates.timeTo = body.timeTo;
    if (body.isPaid !== undefined) updates.isPaid = Boolean(body.isPaid);
    if (body.registrationFee !== undefined) updates.registrationFee = Number(body.registrationFee);
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.requiresApproval !== undefined) updates.requiresApproval = Boolean(body.requiresApproval);
    if (body.registrationOpen !== undefined) updates.registrationOpen = Boolean(body.registrationOpen);
    if (body.maxCapacity !== undefined) updates.maxCapacity = body.maxCapacity ? Number(body.maxCapacity) : null;
    if (body.enableAttendance !== undefined) updates.enableAttendance = Boolean(body.enableAttendance);
    if (body.attendanceDaysCount !== undefined) updates.attendanceDaysCount = Number(body.attendanceDaysCount);
    if (body.enableFood !== undefined) updates.enableFood = Boolean(body.enableFood);
    if (body.enableGoodies !== undefined) updates.enableGoodies = Boolean(body.enableGoodies);
    if (body.organizerName !== undefined) updates.organizerName = body.organizerName;
    if (body.organizerEmail !== undefined) updates.organizerEmail = body.organizerEmail;
    if (body.organizerPhone !== undefined) updates.organizerPhone = body.organizerPhone;
    if (body.spocName !== undefined) updates.spocName = body.spocName;
    if (body.spocDesignation !== undefined) updates.spocDesignation = body.spocDesignation;
    if (body.spocPhone !== undefined) updates.spocPhone = body.spocPhone;
    if (body.spocEmail !== undefined) updates.spocEmail = body.spocEmail;
    if (body.cancellationPolicy !== undefined) updates.cancellationPolicy = body.cancellationPolicy;
    if (body.requireDocumentUpload !== undefined) updates.requireDocumentUpload = Boolean(body.requireDocumentUpload);
    if (body.documentUploadLabel !== undefined) updates.documentUploadLabel = body.documentUploadLabel;
    if (body.documentUploadRequired !== undefined) updates.documentUploadRequired = Boolean(body.documentUploadRequired);
    if (body.groupRegistrationEnabled !== undefined) updates.groupRegistrationEnabled = Boolean(body.groupRegistrationEnabled);
    if (body.themeColor !== undefined) updates.themeColor = body.themeColor;
    if (body.accentColor !== undefined) updates.accentColor = body.accentColor;
    if (body.bannerUrl !== undefined) updates.bannerUrl = body.bannerUrl;
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;
    if (body.agendaPdfUrl !== undefined) updates.agendaPdfUrl = body.agendaPdfUrl;
    if (body.agendaPdfButtonText !== undefined) updates.agendaPdfButtonText = body.agendaPdfButtonText;
    if (body.customPdfUrl !== undefined) updates.customPdfUrl = body.customPdfUrl;
    if (body.customPdfButtonText !== undefined) updates.customPdfButtonText = body.customPdfButtonText;
    if (body.awardsPdfUrl !== undefined) updates.awardsPdfUrl = body.awardsPdfUrl;
    if (body.awardsPdfButtonText !== undefined) updates.awardsPdfButtonText = body.awardsPdfButtonText;
    if (body.externalPhotosUrl !== undefined) updates.externalPhotosUrl = body.externalPhotosUrl;
    if (body.externalPhotosButtonText !== undefined) updates.externalPhotosButtonText = body.externalPhotosButtonText;
    if (body.pdfAttachmentsJson !== undefined) {
      updates.pdfAttachmentsJson = typeof body.pdfAttachmentsJson === "string" ? body.pdfAttachmentsJson : JSON.stringify(body.pdfAttachmentsJson);
    }
    if (body.agendaJson !== undefined) {
      updates.agendaJson = typeof body.agendaJson === "string" ? body.agendaJson : JSON.stringify(body.agendaJson);
    }
    if (body.pricingTiersJson !== undefined) {
      updates.pricingTiersJson = typeof body.pricingTiersJson === "string" ? body.pricingTiersJson : JSON.stringify(body.pricingTiersJson);
    }
    if (body.feedbackFormJson !== undefined) {
      updates.feedbackFormJson = typeof body.feedbackFormJson === "string" ? body.feedbackFormJson : JSON.stringify(body.feedbackFormJson);
    }
    if (body.certificateTemplateJson !== undefined) {
      updates.certificateTemplateJson = typeof body.certificateTemplateJson === "string" ? body.certificateTemplateJson : JSON.stringify(body.certificateTemplateJson);
    }
    if (body.prePostTestJson !== undefined) {
      updates.prePostTestJson = typeof body.prePostTestJson === "string" ? body.prePostTestJson : JSON.stringify(body.prePostTestJson);
    }
    if (body.razorpayKeyId !== undefined) updates.razorpayKeyId = body.razorpayKeyId;
    if (body.razorpayKeySecret !== undefined) updates.razorpayKeySecret = body.razorpayKeySecret;
    if (body.badgeSubtitle !== undefined) updates.badgeSubtitle = body.badgeSubtitle;
    if (body.badgeFooterText !== undefined) updates.badgeFooterText = body.badgeFooterText;
    if (body.status !== undefined) updates.status = body.status;

    const [updated] = await db
      .update(eventsTable)
      .set(updates)
      .where(eq(eventsTable.id, id))
      .returning();

    res.json({ success: true, event: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update event" });
  }
});
// ── COUPON MANAGEMENT ENDPOINTS ─────────────────────────────────────────────
// GET /api/events/:slug/coupons - List coupons for event
router.get("/events/:slug/coupons", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const { eventCouponsTable } = await import("@workspace/db");
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const coupons = await db
      .select()
      .from(eventCouponsTable)
      .where(or(eq(eventCouponsTable.eventId, event.id), sql`${eventCouponsTable.eventId} IS NULL`))
      .orderBy(desc(eventCouponsTable.createdAt));

    res.json(coupons);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch coupons" });
  }
});

// POST /api/events/:slug/coupons - Create coupon for event
router.post("/events/:slug/coupons", requireAuth(["super_admin", "admin"]), async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const { eventCouponsTable } = await import("@workspace/db");
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const body = req.body;
    if (!body.code) {
      res.status(400).json({ error: "Coupon code is required" });
      return;
    }

    const cleanCode = body.code.trim().toUpperCase();
    const [newCoupon] = await db
      .insert(eventCouponsTable)
      .values({
        eventId: event.id,
        code: cleanCode,
        discountType: body.discountType || "percentage",
        discountValue: Number(body.discountValue) || 0,
        sponsorName: body.sponsorName || null,
        description: body.description || null,
        maxUses: body.maxUses ? Number(body.maxUses) : null,
        isActive: body.isActive !== false,
      })
      .returning();

    res.status(201).json({ success: true, coupon: newCoupon });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create coupon" });
  }
});

// DELETE /api/events/coupons/:id - Delete coupon
router.delete("/events/coupons/:id", requireAuth(["super_admin", "admin"]), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { eventCouponsTable } = await import("@workspace/db");
    await db.delete(eventCouponsTable).where(eq(eventCouponsTable.id, id));
    res.json({ success: true, message: "Coupon deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete coupon" });
  }
});

// POST /api/events/:slug/coupons/validate - Public coupon code validator for checkout
router.post("/events/:slug/coupons/validate", async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ valid: false, error: "Please enter a coupon code" });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const { eventCouponsTable } = await import("@workspace/db");
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug));
    if (!event) {
      res.status(404).json({ valid: false, error: "Event not found" });
      return;
    }

    const [coupon] = await db
      .select()
      .from(eventCouponsTable)
      .where(
        and(
          eq(sql`UPPER(${eventCouponsTable.code})`, cleanCode),
          eq(eventCouponsTable.isActive, true),
          or(eq(eventCouponsTable.eventId, event.id), sql`${eventCouponsTable.eventId} IS NULL`)
        )
      );

    if (!coupon) {
      res.status(404).json({ valid: false, error: "Invalid coupon or promo code" });
      return;
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      res.status(400).json({ valid: false, error: "This promo code has reached its maximum redemptions limit" });
      return;
    }

    const originalFee = event.registrationFee;
    let discountAmount = 0;
    let finalFee = originalFee;

    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((originalFee * coupon.discountValue) / 100);
      finalFee = Math.max(0, originalFee - discountAmount);
    } else if (coupon.discountType === "fixed") {
      discountAmount = Math.min(originalFee, coupon.discountValue);
      finalFee = Math.max(0, originalFee - discountAmount);
    } else if (coupon.discountType === "sponsor_free") {
      discountAmount = originalFee;
      finalFee = 0;
    }

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      sponsorName: coupon.sponsorName,
      description: coupon.description,
      originalFee,
      discountAmount,
      finalFee,
      isFullyWaived: finalFee === 0,
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message || "Failed to validate coupon" });
  }
});

// ── DELETE /api/events/:id ──────────────────────────────────────────────────────
// Archive / Delete event (Super Admin only)
router.delete("/events/:id", requireAuth(["super_admin"]), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete event" });
  }
});

// ── GET /api/events/:id/stats ───────────────────────────────────────────────────
// Comprehensive analytics for single event
router.get("/events/:id/stats", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    const [totalParts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(participantsTable)
      .where(eq(participantsTable.eventId, id));

    const [approvedParts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(participantsTable)
      .where(and(eq(participantsTable.eventId, id), eq(participantsTable.approvalStatus, "approved")));

    const [pendingParts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(participantsTable)
      .where(and(eq(participantsTable.eventId, id), eq(participantsTable.approvalStatus, "pending")));

    const [paidParts] = await db
      .select({ count: sql<number>`count(*)::int`, totalRevenue: sql<number>`COALESCE(sum(${participantsTable.paymentAmount}), 0)::int` })
      .from(participantsTable)
      .where(and(eq(participantsTable.eventId, id), eq(participantsTable.isPaid, true)));

    const [attendanceScans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceLogsTable)
      .where(eq(attendanceLogsTable.eventId, id));

    const [foodScans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(foodLogsTable)
      .where(eq(foodLogsTable.eventId, id));

    res.json({
      totalRegistrations: totalParts?.count || 0,
      approvedCount: approvedParts?.count || 0,
      pendingCount: pendingParts?.count || 0,
      paidCount: paidParts?.count || 0,
      totalRevenue: paidParts?.totalRevenue || 0,
      attendanceScans: attendanceScans?.count || 0,
      foodScans: foodScans?.count || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch event stats" });
  }
});

export default router;

