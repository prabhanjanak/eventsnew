import { Router, type Request, type Response } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, eventsTable, participantsTable, idCardDesignsTable } from "@workspace/db";
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
    cb(null, `id_template_${cleanName}_${Date.now()}${ext}`);
  },
});

const uploadTemplate = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      /\.(png|jpe?g|webp|svg)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, WEBP) are allowed for ID Card Templates."));
    }
  },
});

const router = Router();

// Helper to resolve Event from slug or numeric id
async function resolveEvent(slugOrId: string) {
  const isNum = /^\d+$/.test(slugOrId);
  if (isNum) {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, Number(slugOrId)));
    return event || null;
  }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slugOrId));
  return event || null;
}

// ── 1. GET /api/events/:slugOrId/id-card-design ──────────────────────────────
router.get(
  "/events/:slugOrId/id-card-design",
  requireAuth(["super_admin", "admin", "event_coordinator"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const event = await resolveEvent(req.params.slugOrId);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const cardType = (req.query.cardType as string) || "preregistered";

      const [design] = await db
        .select()
        .from(idCardDesignsTable)
        .where(
          and(
            eq(idCardDesignsTable.eventId, event.id),
            eq(idCardDesignsTable.cardType, cardType)
          )
        )
        .limit(1);

      // Also calculate stats for this event
      const attendees = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.eventId, event.id));

      const totalPreRegistered = attendees.filter((a) => !(a as any).isOnSpotLinked && a.name !== "Unassigned Pass").length;
      const totalOnSpot = attendees.filter((a) => (a as any).isOnSpotLinked || a.name === "Unassigned Pass").length;
      const totalCards = attendees.length;

      // Calculate ready count: attendee has valid name and registrationNumber
      const readyForPrinting = attendees.filter(
        (a) => a.registrationNumber && a.name && a.name !== "Unassigned Pass"
      ).length;

      res.json({
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
          venue: event.venue,
          city: event.city,
          startDate: event.startDate,
          endDate: event.endDate,
        },
        design: design || {
          eventId: event.id,
          cardType,
          templateImageUrl: "/uploads/demo_id_card_front.png",
          backTemplateImageUrl: "/uploads/demo_id_card_back.png",
          widthInches: "3.46",
          heightInches: "5.51",
          dpi: 300,
          orientation: "portrait",
          isDoubleSided: false,
          printSideMode: "duplex",
          placeholdersJson: JSON.stringify([
            {
              id: "ph_name_default",
              type: "name",
              label: "Delegate Name",
              xPercent: 10,
              yPercent: 57,
              widthPercent: 80,
              heightPercent: 9,
              isLocked: false,
              fontFamily: "Inter, sans-serif",
              fontSizePt: 24,
              fontWeight: "bold",
              color: "#0F172A",
              align: "center",
              textTransform: "uppercase",
              truncate: true,
            },
            {
              id: "ph_role_default",
              type: "custom_text",
              label: "Role Category (DELEGATE)",
              xPercent: 15,
              yPercent: 76,
              widthPercent: 70,
              heightPercent: 8,
              isLocked: false,
              fontFamily: "Inter, sans-serif",
              fontSizePt: 16,
              fontWeight: "bold",
              color: "#FFFFFF",
              align: "center",
              textTransform: "uppercase",
              customSampleText: "DELEGATE",
              truncate: true,
            },
          ]),
          backPlaceholdersJson: JSON.stringify([
            {
              id: "ph_back_qr_default",
              type: "qr_code",
              label: "Pass QR Code",
              xPercent: 35,
              yPercent: 24,
              widthPercent: 30,
              heightPercent: 20,
              isLocked: false,
              qrErrorCorrection: "M",
              qrMargin: 1,
            },
          ]),
          sheetConfigJson: JSON.stringify({
            paperSize: "A4",
            cardsPerRow: 2,
            cardsPerCol: 2,
            marginTopMm: 10,
            marginLeftMm: 10,
            gapXmm: 5,
            gapYmm: 5,
            showCutMarks: true,
            pageOrientation: "portrait",
          }),
          status: "draft",
          version: 1,
          publishedVersion: null,
        },
        stats: {
          totalPreRegistered,
          totalOnSpot,
          totalCards,
          readyForPrinting,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch ID card design" });
    }
  }
);

// ── 2. POST /api/events/:slugOrId/id-card-design ─────────────────────────────
router.post(
  "/events/:slugOrId/id-card-design",
  requireAuth(["super_admin", "admin", "event_coordinator"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const event = await resolveEvent(req.params.slugOrId);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const {
        cardType = "preregistered",
        templateImageUrl,
        backTemplateImageUrl,
        widthInches = "3.46",
        heightInches = "5.51",
        dpi = 300,
        orientation = "portrait",
        isDoubleSided = false,
        printSideMode = "duplex",
        placeholders,
        backPlaceholders,
        sheetConfig,
        status = "draft",
      } = req.body;

      const placeholdersJson = typeof placeholders === "string" ? placeholders : JSON.stringify(placeholders || []);
      const backPlaceholdersJson = typeof backPlaceholders === "string" ? backPlaceholders : JSON.stringify(backPlaceholders || []);
      const sheetConfigJson = typeof sheetConfig === "string" ? sheetConfig : JSON.stringify(sheetConfig || {});

      // Check existing design
      const [existing] = await db
        .select()
        .from(idCardDesignsTable)
        .where(
          and(
            eq(idCardDesignsTable.eventId, event.id),
            eq(idCardDesignsTable.cardType, cardType)
          )
        )
        .limit(1);

      let result;
      const user = (req as any).user;

      if (existing) {
        const nextVersion = existing.version + 1;
        const publishedVersion = status === "published" ? nextVersion : existing.publishedVersion;

        [result] = await db
          .update(idCardDesignsTable)
          .set({
            templateImageUrl: templateImageUrl !== undefined ? templateImageUrl : existing.templateImageUrl,
            backTemplateImageUrl: backTemplateImageUrl !== undefined ? backTemplateImageUrl : existing.backTemplateImageUrl,
            widthInches: String(widthInches),
            heightInches: String(heightInches),
            dpi: Number(dpi) || 300,
            orientation,
            isDoubleSided: Boolean(isDoubleSided),
            printSideMode: String(printSideMode || "duplex"),
            placeholdersJson,
            backPlaceholdersJson,
            sheetConfigJson,
            status,
            version: nextVersion,
            publishedVersion,
            createdById: user?.id || existing.createdById,
            updatedAt: new Date(),
          })
          .where(eq(idCardDesignsTable.id, existing.id))
          .returning();
      } else {
        [result] = await db
          .insert(idCardDesignsTable)
          .values({
            eventId: event.id,
            cardType,
            templateImageUrl,
            backTemplateImageUrl,
            widthInches: String(widthInches),
            heightInches: String(heightInches),
            dpi: Number(dpi) || 300,
            orientation,
            isDoubleSided: Boolean(isDoubleSided),
            printSideMode: String(printSideMode || "duplex"),
            placeholdersJson,
            backPlaceholdersJson,
            sheetConfigJson,
            status,
            version: 1,
            publishedVersion: status === "published" ? 1 : null,
            createdById: user?.id || null,
          })
          .returning();
      }

      res.json({
        success: true,
        message: status === "published" ? "ID Card Design published successfully! ✓" : "ID Card Design saved as draft.",
        design: result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save ID card design" });
    }
  }
);

// ── 3. POST /api/events/:slugOrId/id-card-design/upload-template ─────────────
router.post(
  "/events/:slugOrId/id-card-design/upload-template",
  requireAuth(["super_admin", "admin", "event_coordinator"]),
  uploadTemplate.single("template"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const event = await resolveEvent(req.params.slugOrId);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      const fileUrl = `/api/uploads/${req.file.filename}`;
      const side = (req.query.side as string) || "front";

      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        side,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to upload template PNG" });
    }
  }
);

// ── 4. GET /api/events/:slugOrId/id-card-design/attendees ─────────────────────
router.get(
  "/events/:slugOrId/id-card-design/attendees",
  requireAuth(["super_admin", "admin", "event_coordinator"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const event = await resolveEvent(req.params.slugOrId);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const attendees = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.eventId, event.id));

      // Validate each attendee record for card readiness
      const enriched = attendees.map((a: any) => {
        const hasName = Boolean(a.name && a.name.trim() && a.name !== "Unassigned Pass");
        const hasOrg = Boolean(a.institution && a.institution.trim() && a.institution !== "Unassigned Physical Card");
        const hasId = Boolean(a.registrationNumber && a.registrationNumber.trim());
        const hasQr = Boolean(a.registrationNumber && a.registrationNumber.trim());
        const isReady = hasName && hasId && hasQr;

        return {
          id: a.id,
          registrationNumber: a.registrationNumber,
          name: a.name || "Unassigned",
          institution: a.institution || "—",
          email: a.email || "—",
          mobile: a.mobile || "—",
          delegateType: a.delegateType || "delegate",
          isOnSpot: Boolean(a.isOnSpotLinked || a.name === "Unassigned Pass"),
          hasName,
          hasOrg,
          hasId,
          hasQr,
          isReady,
        };
      });

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch attendees for ID card batch print" });
    }
  }
);

export default router;
