import { Router } from "express";
import { eq, or, sql } from "drizzle-orm";
import { db, eventsTable, participantsTable, googleWalletPassesTable } from "@workspace/db";
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
    // Lookup participant by ID or registrationNumber
    const isNumeric = /^\d+$/.test(regParam);
    const participantCondition = isNumeric
      ? or(
          eq(participantsTable.id, parseInt(regParam, 10)),
          eq(sql`LOWER(${participantsTable.registrationNumber})`, regParam.toLowerCase())
        )
      : eq(sql`LOWER(${participantsTable.registrationNumber})`, regParam.toLowerCase());

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(participantCondition);

    if (!participant) {
      res.status(404).json({ error: "Ticket or registration record not found." });
      return;
    }

    // Lookup event
    if (!participant.eventId) {
      res.status(400).json({ error: "No event associated with this registration." });
      return;
    }

    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, participant.eventId));

    if (!event) {
      res.status(404).json({ error: "Associated event not found." });
      return;
    }

    // Check authorization: if queried by numeric ID, ensure owner/admin
    if (isNumeric && currentUser) {
      const isSuperAdmin = currentUser.userType === "super_admin" || currentUser.userType === "admin";
      const userEmail = (currentUser.email || "").toLowerCase().trim();
      const participantEmail = (participant.email || "").toLowerCase().trim();

      const isEmailOwner = userEmail && participantEmail && userEmail === participantEmail;
      const isIdOwner = currentUser.userType === "participant" && currentUser.id === participant.id;

      if (!isSuperAdmin && !isEmailOwner && !isIdOwner) {
        res.status(403).json({ error: "You are not authorized to access this event ticket pass." });
        return;
      }
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

    // Retrieve Google Wallet API configuration
    const config = getGoogleWalletConfig();
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
