import { Router } from "express";
import { db, rsvpTable, participantsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import crypto from "crypto";
import { sendRsvpConfirmationEmail, sendRsvpConfirmationWhatsapp } from "../lib/mailer";

const router = Router();

// GET /rsvp/:participantId — list RSVPs for a participant
router.get("/rsvp/:participantId", requireAuth(["participant", "admin"]), async (req, res): Promise<void> => {
  const participantId = parseInt(req.params.participantId as string);
  if (isNaN(participantId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const user = req.user!;
  if (user.userType === "participant" && user.participantId !== participantId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const rsvps = await db
      .select()
      .from(rsvpTable)
      .where(eq(rsvpTable.participantId, participantId));

    res.json(rsvps.map((r) => ({
      id: r.id,
      trackName: r.trackName,
      sessionName: r.sessionName,
      sessionDate: r.sessionDate,
      sessionTime: r.sessionTime,
      createdAt: r.createdAt.toISOString(),
      emailNotified: !!r.reminder1SentAt,
      emailOpened: !!r.emailOpenedAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch RSVPs" });
  }
});

// POST /rsvp — add RSVP
router.post("/rsvp", requireAuth(["participant"]), async (req, res): Promise<void> => {
  const user = req.user!;
  const { trackName, sessionName, sessionDate, sessionTime } = req.body as {
    trackName: string; sessionName: string; sessionDate: string; sessionTime: string;
  };

  if (!trackName || !sessionName || !sessionDate || !sessionTime) {
    res.status(400).json({ error: "trackName, sessionName, sessionDate, sessionTime are required" });
    return;
  }

  try {
    // Check if already RSVPd
    const [existing] = await db
      .select()
      .from(rsvpTable)
      .where(
        and(
          eq(rsvpTable.participantId, user.participantId!),
          eq(rsvpTable.trackName, trackName),
          eq(rsvpTable.sessionName, sessionName),
          eq(rsvpTable.sessionDate, sessionDate),
        )
      );

    if (existing) {
      res.status(400).json({ error: "Already RSVP'd to this session" });
      return;
    }

    // Get participant email
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, user.participantId!));

    const [rsvp] = await db
      .insert(rsvpTable)
      .values({
        participantId: user.participantId!,
        trackName,
        sessionName,
        sessionDate,
        sessionTime,
        participantEmail: participant?.email || null,
        emailOpenToken: crypto.randomUUID(),
      })
      .returning();

    // Trigger immediate confirmations asynchronously
    if (participant) {
      if (participant.email) {
        sendRsvpConfirmationEmail(
          participant.email,
          participant.name,
          sessionName,
          trackName,
          sessionDate,
          sessionTime
        ).catch((err) => console.error("[RSVP] Confirmation email failed:", err.message));
      }
      if (participant.mobile) {
        sendRsvpConfirmationWhatsapp(
          participant.mobile,
          participant.name,
          sessionName,
          trackName,
          sessionDate,
          sessionTime
        ).catch((err) => console.error("[RSVP] Confirmation WhatsApp failed:", err.message));
      }
    }

    res.status(201).json({
      id: rsvp.id,
      trackName: rsvp.trackName,
      sessionName: rsvp.sessionName,
      sessionDate: rsvp.sessionDate,
      sessionTime: rsvp.sessionTime,
      createdAt: rsvp.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create RSVP" });
  }
});

// DELETE /rsvp/:id — remove RSVP
router.delete("/rsvp/:id", requireAuth(["participant"]), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const user = req.user!;

  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const [deleted] = await db
      .delete(rsvpTable)
      .where(and(eq(rsvpTable.id, id), eq(rsvpTable.participantId, user.participantId!)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "RSVP not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove RSVP" });
  }
});

// GET /rsvp/track-open/:token — email open tracking pixel (no auth)
router.get("/rsvp/track-open/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  try {
    const [rsvp] = await db
      .select()
      .from(rsvpTable)
      .where(eq(rsvpTable.emailOpenToken, token));

    if (rsvp && !rsvp.emailOpenedAt) {
      await db.update(rsvpTable)
        .set({ emailOpenedAt: new Date() })
        .where(eq(rsvpTable.emailOpenToken, token));
      console.log(`[RSVP-TRACK] Email opened — RSVP ID: ${rsvp.id}`);
    }
  } catch {/* ignore tracking errors */}

  // Serve a 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"
  );
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" });
  res.send(pixel);
});

// POST /rsvp/email — no auth required, lookup participant by email or mobile and create RSVP
// Used by the public Tracks page "Wish to Attend" button
router.post("/rsvp/email", async (req, res): Promise<void> => {
  const { email, identifier, trackName, sessionName, sessionDate, sessionTime } = req.body as {
    email?: string; identifier?: string; trackName: string; sessionName: string; sessionDate: string; sessionTime: string;
  };

  const lookupVal = (identifier || email || "").trim();

  if (!lookupVal || !trackName || !sessionName || !sessionDate || !sessionTime) {
    res.status(400).json({ error: "identifier (email or mobile), trackName, sessionName, sessionDate, and sessionTime are required" });
    return;
  }

  try {
    let participant;

    if (lookupVal.includes("@")) {
      const cleanEmail = lookupVal.toLowerCase();
      [participant] = await db
        .select()
        .from(participantsTable)
        .where(eq(sql`LOWER(${participantsTable.email})`, cleanEmail));
    } else {
      const cleanMobile = lookupVal.replace(/\D/g, "");
      if (cleanMobile.length >= 8) {
        [participant] = await db
          .select()
          .from(participantsTable)
          .where(sql`RIGHT(REGEXP_REPLACE(${participantsTable.mobile}, '\D', '', 'g'), ${cleanMobile.length}) = ${cleanMobile}`);
      }
    }

    if (!participant) {
      res.status(404).json({ error: "No registered participant found with this email or mobile number. Please check and try again." });
      return;
    }

    // Check if already RSVPd
    const [existing] = await db
      .select()
      .from(rsvpTable)
      .where(
        and(
          eq(rsvpTable.participantId, participant.id),
          eq(rsvpTable.trackName, trackName),
          eq(rsvpTable.sessionName, sessionName),
          eq(rsvpTable.sessionDate, sessionDate),
        )
      );

    if (existing) {
      res.json({ success: true, alreadyRsvpd: true, name: participant.name, message: "You are already on the attendee list for this session." });
      return;
    }

    const [rsvp] = await db
      .insert(rsvpTable)
      .values({
        participantId: participant.id,
        trackName,
        sessionName,
        sessionDate,
        sessionTime,
        participantEmail: participant.email || null,
        emailOpenToken: crypto.randomUUID(),
      })
      .returning();

    // Fire-and-forget confirmations
    if (participant.email) {
      sendRsvpConfirmationEmail(participant.email, participant.name, sessionName, trackName, sessionDate, sessionTime)
        .catch((err) => console.error("[RSVP/submit] Email failed:", err.message));
    }
    if (participant.mobile) {
      sendRsvpConfirmationWhatsapp(participant.mobile, participant.name, sessionName, trackName, sessionDate, sessionTime)
        .catch((err) => console.error("[RSVP/submit] WhatsApp failed:", err.message));
    }

    res.status(201).json({ success: true, alreadyRsvpd: false, name: participant.name, rsvpId: rsvp.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create RSVP" });
  }
});

export default router;
