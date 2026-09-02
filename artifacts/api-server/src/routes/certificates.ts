import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, certificatesTable, eventsTable, participantsTable, attendanceLogsTable, feedbackSubmissionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { sendEmail } from "../lib/mailer";
import crypto from "crypto";

const router = Router();

// GET /api/certificates/my-certificates — List all issued certificates for logged-in participant
router.get("/certificates/my-certificates", requireAuth(["participant"]), async (req: any, res): Promise<void> => {
  try {
    const participantId = req.user.participantId;
    if (!participantId) {
      res.status(400).json({ error: "Participant identifier missing" });
      return;
    }

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId))
      .limit(1);

    if (!participant) {
      res.status(404).json({ error: "Participant record not found" });
      return;
    }

    const eventId = participant.eventId;
    let event: any = null;
    if (eventId) {
      const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
      event = ev;
    }

    // Check attendance
    const attendanceRecords = await db
      .select()
      .from(attendanceLogsTable)
      .where(eq(attendanceLogsTable.participantId, participantId));
    
    const isAttended = attendanceRecords.length > 0;

    // Check feedback
    let isFeedbackSubmitted = false;
    if (eventId) {
      const [fb] = await db
        .select()
        .from(feedbackSubmissionsTable)
        .where(
          and(
            eq(feedbackSubmissionsTable.eventId, eventId),
            eq(feedbackSubmissionsTable.participantId, participantId)
          )
        )
        .limit(1);
      isFeedbackSubmitted = !!fb;
    }

    // Fetch existing certificates
    let userCerts = await db
      .select()
      .from(certificatesTable)
      .where(eq(certificatesTable.participantId, participantId))
      .orderBy(desc(certificatesTable.createdAt));

    // Auto-generate delegate certificate if attended and not yet generated
    if (userCerts.length === 0 && isAttended && event) {
      const certNum = `SECI-${new Date().getFullYear()}-${participant.registrationNumber || participant.id}`;
      const token = crypto.randomBytes(16).toString("hex");

      const [newCert] = await db
        .insert(certificatesTable)
        .values({
          eventId: event.id,
          participantId: participant.id,
          certificateType: participant.delegateType === "faculty" || participant.delegateType === "speaker" ? "speaker" : "delegate",
          certificateNumber: certNum,
          recipientName: participant.name,
          recipientEmail: participant.email,
          recipientInstitution: participant.institution,
          creditHours: "4 CME Credit Hours",
          qrVerificationToken: token,
          isIssued: true,
        })
        .returning();

      if (newCert) {
        userCerts = [newCert];
      }
    }

    res.json({
      certificates: userCerts,
      isAttended,
      isFeedbackSubmitted,
      eventTitle: event?.title || "Sankara Ophthalmology Conference",
      eventDate: event?.startDate || "2026",
    });
  } catch (err: any) {
    console.error("[Certificates] Error fetching my certificates:", err);
    res.status(500).json({ error: "Failed to fetch certificates", details: err.message });
  }
});

// GET /api/certificates/verify/:tokenOrNumber — Public Verification Endpoint for scanned QR on certificate
router.get("/certificates/verify/:tokenOrNumber", async (req, res): Promise<void> => {
  try {
    const { tokenOrNumber } = req.params;

    const [cert] = await db
      .select()
      .from(certificatesTable)
      .where(
        sql`${certificatesTable.certificateNumber} = ${tokenOrNumber} OR ${certificatesTable.qrVerificationToken} = ${tokenOrNumber}`
      )
      .limit(1);

    if (!cert) {
      res.status(404).json({ verified: false, message: "Certificate record not found or invalid." });
      return;
    }

    let event: any = null;
    if (cert.eventId) {
      const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, cert.eventId)).limit(1);
      event = ev;
    }

    res.json({
      verified: true,
      certificateNumber: cert.certificateNumber,
      recipientName: cert.recipientName,
      recipientInstitution: cert.recipientInstitution,
      certificateType: cert.certificateType,
      creditHours: cert.creditHours,
      issuedAt: cert.issuedAt,
      eventTitle: event?.title || "Sankara Ophthalmology Conference",
      eventDate: `${event?.startDate || ""} to ${event?.endDate || ""}`,
      organizer: event?.organizerName || "Sankara Eye Foundation India",
    });
  } catch (err: any) {
    res.status(500).json({ verified: false, error: err.message });
  }
});

// POST /api/certificates/mark-downloaded/:id
router.post("/certificates/mark-downloaded/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid certificate ID" });
      return;
    }

    await db
      .update(certificatesTable)
      .set({
        isDownloaded: true,
        downloadedAt: new Date(),
      })
      .where(eq(certificatesTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/certificates/bulk-email — Admin broadcast certificates to eligible attendees
router.post("/certificates/bulk-email", requireAuth(["admin", "super_admin"]), async (req, res): Promise<void> => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const certs = await db
      .select()
      .from(certificatesTable)
      .where(eq(certificatesTable.eventId, eventId));

    let sentCount = 0;
    for (const cert of certs) {
      if (cert.recipientEmail) {
        const verifyUrl = `${process.env.SERVER_BASE_URL || "https://events.sankaraeye.in"}/verify-certificate/${cert.qrVerificationToken || cert.certificateNumber}`;
        const portalUrl = `${process.env.SERVER_BASE_URL || "https://events.sankaraeye.in"}/participant/dashboard`;
        
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
            <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${event.title}</h1>
              <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">e-Certificate of Participation</p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
              <p>Dear <strong>${cert.recipientName}</strong>,</p>
              <p>Thank you for participating in <strong>${event.title}</strong> organized by Sankara Eye Care Institutions.</p>
              <p>Your official e-Certificate (Certificate No: <strong>${cert.certificateNumber}</strong>) is ready with <strong>${cert.creditHours || "CME Credit Hours"}</strong>.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Download My e-Certificate
                </a>
              </div>
              <p style="font-size: 12px; color: #64748b;">
                You can also verify your certificate's authenticity anytime at: <br/>
                <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
              </p>
            </div>
          </div>
        `;

        try {
          await sendEmail(cert.recipientEmail, `Your e-Certificate: ${event.title}`, html);
          await db.update(certificatesTable).set({ emailSentAt: new Date() }).where(eq(certificatesTable.id, cert.id));
          sentCount++;
        } catch (e: any) {
          console.error(`[Certificates Email] Failed sending to ${cert.recipientEmail}:`, e.message);
        }
      }
    }

    res.json({ success: true, message: `Successfully distributed ${sentCount} certificates via email.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
