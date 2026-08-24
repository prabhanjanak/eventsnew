import { Router } from "express";
import { eq, or, sql } from "drizzle-orm";
import { db, eventsTable, participantsTable, googleWalletPassesTable, submissionSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getGoogleWalletConfig, generateGoogleWalletPass } from "../lib/google-wallet";

import { verifyToken } from "../lib/auth";

const router = Router();

/**
 * GET /api/wallet/google/:registrationId
 * Generate or retrieve Google Wallet Event Ticket Pass Save URL for an attendee
 */
router.get("/wallet/google/:registrationId", async (req, res): Promise<void> => {
  const regParam = (req.params.registrationId || "").trim();
  const authHeader = req.headers.authorization;
  let currentUser: any = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    currentUser = verifyToken(token);
  }

  if (!regParam) {
    res.status(400).json({ error: "Registration identifier is required." });
    return;
  }

  try {
    // 1. Fetch participant by ID or Registration Number
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(
        or(
          eq(participantsTable.registrationNumber, regParam),
          !isNaN(Number(regParam)) ? eq(participantsTable.id, Number(regParam)) : sql`1=0`
        )
      )
      .limit(1);

    if (!participant) {
      res.status(404).json({ error: "Registration record not found." });
      return;
    }

    // 2. Fetch associated Event
    let event: any = null;
    if (participant.eventId) {
      const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, participant.eventId)).limit(1);
      event = ev;
    }

    // Fallback: Primary active event if eventId is missing
    if (!event) {
      const [ev] = await db.select().from(eventsTable).orderBy(eventsTable.id).limit(1);
      event = ev;
    }

    if (!event) {
      res.status(404).json({ error: "Associated event details could not be found." });
      return;
    }

    // Check ticket validity status
    if (!participant.isActive || participant.approvalStatus === "rejected") {
      res.status(400).json({ error: "This registration has been cancelled or rejected." });
      return;
    }

    // Check if Google Wallet is enabled for the event
    if (!event.enableGoogleWallet) {
      res.status(400).json({ error: "Google Wallet passes are not enabled for this event." });
      return;
    }

    // Retrieve Google Wallet API configuration from DB settings with env fallback
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const config = getGoogleWalletConfig(settings ? {
      issuerId: settings.googleWalletIssuerId || undefined,
      serviceAccountEmail: settings.googleWalletServiceAccountEmail || undefined,
      privateKey: settings.googleWalletPrivateKey || undefined,
    } : null);

    if (!config) {
      res.status(503).json({
        error: "Google Wallet service is currently pending configuration. Please use the Web / QR ticket pass in the meantime.",
      });
      return;
    }

    // Generate signed Google Wallet Save URL
    const passResult = await generateGoogleWalletPass(event, participant, config);

    // Upsert record into google_wallet_passes
    try {
      const [existingPass] = await db
        .select()
        .from(googleWalletPassesTable)
        .where(eq(googleWalletPassesTable.walletObjectId, passResult.objectId));

      if (existingPass) {
        await db
          .update(googleWalletPassesTable)
          .set({
            status: "active",
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(googleWalletPassesTable.id, existingPass.id));
      } else {
        await db.insert(googleWalletPassesTable).values({
          participantId: participant.id,
          eventId: event.id,
          walletObjectId: passResult.objectId,
          walletClassId: passResult.classId,
          status: "active",
        });
      }
    } catch (dbErr: any) {
      console.warn("[Google Wallet] Non-blocking DB log warning:", dbErr.message);
    }

    res.json({
      success: true,
      saveUrl: passResult.saveUrl,
      classId: passResult.classId,
      objectId: passResult.objectId,
    });
  } catch (err: any) {
    console.error("[Google Wallet] Error generating pass:", err.message, err.stack);
    if (err.response?.data) {
      console.error("[Google Wallet] API Error details:", JSON.stringify(err.response.data));
    }
    res.status(500).json({ error: "Failed to generate Google Wallet ticket pass. Please try again later." });
  }
});

export default router;
