import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, participantsTable, goodiesLogsTable, activityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// POST /goodies/scan
router.post("/goodies/scan", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  if (user.userType === "participant") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { registrationNumber } = req.body as { registrationNumber?: string };
  if (!registrationNumber) {
    res.status(400).json({ error: "registrationNumber is required" });
    return;
  }

  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, registrationNumber.toUpperCase()));

  if (!participant) {
    res.json({ success: false, status: "not_found", message: "Participant not found", participant: null });
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

  const [existing] = await db
    .select()
    .from(goodiesLogsTable)
    .where(eq(goodiesLogsTable.participantId, participant.id));

  if (existing) {
    res.json({
      success: false,
      status: "already_collected",
      message: "Goodies / Reg Kit already collected",
      participant: { id: participant.id, name: participant.name, registrationNumber: participant.registrationNumber, institution: participant.institution },
      collectedAt: existing.scannedAt.toISOString(),
    });
    return;
  }

  await db.insert(goodiesLogsTable).values({ participantId: participant.id, scannedBy: user.id });
  await db.insert(activityLogsTable).values({
    type: "goodies",
    message: `Goodies collected: ${participant.name} (${participant.registrationNumber})`,
  });

  res.json({
    success: true,
    status: "collected",
    message: "Goodies / Reg Kit collected successfully",
    participant: { id: participant.id, name: participant.name, registrationNumber: participant.registrationNumber, institution: participant.institution },
  });
});

// GET /goodies/logs
router.get("/goodies/logs", requireAuth(["admin"]), async (_req, res): Promise<void> => {
  const logs = await db
    .select({
      id: goodiesLogsTable.id,
      participantId: goodiesLogsTable.participantId,
      participantName: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      institution: participantsTable.institution,
      scannedAt: goodiesLogsTable.scannedAt,
    })
    .from(goodiesLogsTable)
    .innerJoin(participantsTable, eq(goodiesLogsTable.participantId, participantsTable.id))
    .orderBy(goodiesLogsTable.scannedAt);

  res.json(
    logs.map((l) => ({
      id: l.id,
      participantId: l.participantId,
      participantName: l.participantName,
      registrationNumber: l.registrationNumber,
      institution: l.institution,
      scannedAt: l.scannedAt.toISOString(),
    }))
  );
});

export default router;
