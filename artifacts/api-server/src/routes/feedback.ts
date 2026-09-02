import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, feedbackSubmissionsTable, eventsTable, participantsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /api/events/:eventId/feedback/status — Check if logged in participant has submitted feedback
router.get("/events/:eventId/feedback/status", requireAuth(["participant"]), async (req: any, res): Promise<void> => {
  try {
    const eventId = parseInt(String(req.params.eventId), 10);
    const participantId = req.user.participantId;
    if (Number.isNaN(eventId) || !participantId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

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

    res.json({ submitted: !!fb, feedback: fb || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:eventId/feedback — Submit CME Feedback
router.post("/events/:eventId/feedback", requireAuth(["participant"]), async (req: any, res): Promise<void> => {
  try {
    const eventId = parseInt(String(req.params.eventId), 10);
    const participantId = req.user.participantId;
    const { ratings, comments, suggestions } = req.body;

    if (Number.isNaN(eventId) || !participantId) {
      res.status(400).json({ error: "Invalid request data" });
      return;
    }

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId))
      .limit(1);

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // Check if already submitted
    const [existing] = await db
      .select()
      .from(feedbackSubmissionsTable)
      .where(
        and(
          eq(feedbackSubmissionsTable.eventId, eventId),
          eq(feedbackSubmissionsTable.participantId, participantId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(feedbackSubmissionsTable)
        .set({
          ratingsJson: typeof ratings === "object" ? JSON.stringify(ratings) : (ratings || "{}"),
          comments: comments || null,
          suggestions: suggestions || null,
          submittedAt: new Date(),
        })
        .where(eq(feedbackSubmissionsTable.id, existing.id))
        .returning();

      res.json({ success: true, message: "Feedback updated successfully", feedback: updated });
      return;
    }

    const [created] = await db
      .insert(feedbackSubmissionsTable)
      .values({
        eventId,
        participantId,
        participantName: participant.name,
        participantEmail: participant.email,
        ratingsJson: typeof ratings === "object" ? JSON.stringify(ratings) : (ratings || "{}"),
        comments: comments || null,
        suggestions: suggestions || null,
      })
      .returning();

    res.json({ success: true, message: "Thank you for your valuable feedback!", feedback: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:eventId/feedback/analytics — Admin feedback overview
router.get("/events/:eventId/feedback/analytics", requireAuth(["admin", "super_admin"]), async (req, res): Promise<void> => {
  try {
    const eventId = parseInt(String(req.params.eventId), 10);
    if (Number.isNaN(eventId)) {
      res.status(400).json({ error: "Invalid eventId" });
      return;
    }

    const submissions = await db
      .select()
      .from(feedbackSubmissionsTable)
      .where(eq(feedbackSubmissionsTable.eventId, eventId))
      .orderBy(desc(feedbackSubmissionsTable.submittedAt));

    // Compute averages
    let totalScientific = 0;
    let totalAv = 0;
    let totalHospitality = 0;
    let totalOverall = 0;
    let count = 0;

    const parsedList = submissions.map((s) => {
      let ratings: any = {};
      try {
        ratings = JSON.parse(s.ratingsJson);
      } catch {}

      if (ratings.scientific) totalScientific += Number(ratings.scientific) || 0;
      if (ratings.av) totalAv += Number(ratings.av) || 0;
      if (ratings.hospitality) totalHospitality += Number(ratings.hospitality) || 0;
      if (ratings.overall) totalOverall += Number(ratings.overall) || 0;
      count++;

      return {
        ...s,
        ratings,
      };
    });

    const stats = {
      totalSubmissions: count,
      avgScientific: count ? (totalScientific / count).toFixed(1) : 0,
      avgAv: count ? (totalAv / count).toFixed(1) : 0,
      avgHospitality: count ? (totalHospitality / count).toFixed(1) : 0,
      avgOverall: count ? (totalOverall / count).toFixed(1) : 0,
    };

    res.json({ stats, submissions: parsedList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
