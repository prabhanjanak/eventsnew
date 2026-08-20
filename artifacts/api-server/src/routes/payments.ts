import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db, eventsTable, participantsTable, submissionSettingsTable } from "@workspace/db";

const router = Router();

// ── Helper to retrieve active Razorpay Keys ───────────────────────────────────
async function getRazorpayKeys(eventId?: number): Promise<{ keyId: string | null; keySecret: string | null }> {
  if (eventId) {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
    if (event?.razorpayKeyId && event?.razorpayKeySecret) {
      return { keyId: event.razorpayKeyId, keySecret: event.razorpayKeySecret };
    }
  }

  const [settings] = await db.select().from(submissionSettingsTable).limit(1);
  return {
    keyId: settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID || null,
    keySecret: settings?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || null,
  };
}

// ── POST /api/payments/razorpay/create-order ───────────────────────────────────
router.post("/payments/razorpay/create-order", async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, participantId, registrationNumber, amount } = req.body;

    if (!eventId || !amount) {
      res.status(400).json({ error: "eventId and amount are required" });
      return;
    }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, Number(eventId)));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const { keyId, keySecret } = await getRazorpayKeys(event.id);
    const orderAmountInPaise = Math.round(Number(amount) * 100);
    const receiptId = `rcpt_${event.id}_${participantId || registrationNumber || "reg"}_${Date.now().toString().slice(-6)}`;

    // If live credentials exist, call official Razorpay API
    if (keyId && keySecret && !keyId.includes("dummy") && !keyId.includes("test_placeholder")) {
      const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const resp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: orderAmountInPaise,
          currency: event.currency || "INR",
          receipt: receiptId.slice(0, 40),
          notes: {
            eventId: event.id,
            eventTitle: event.title,
            registrationNumber: registrationNumber || "",
          },
        }),
      });

      const orderData = await resp.json();
      if (!resp.ok) {
        throw new Error(orderData.error?.description || "Razorpay order creation failed");
      }

      res.json({
        success: true,
        orderId: orderData.id,
        amount: orderAmountInPaise,
        currency: event.currency || "INR",
        keyId: keyId,
        eventTitle: event.title,
      });
      return;
    }

    // Development / Sandbox Test Mock Order
    const mockOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    res.json({
      success: true,
      orderId: mockOrderId,
      amount: orderAmountInPaise,
      currency: event.currency || "INR",
      keyId: keyId || "rzp_test_simulated_key",
      eventTitle: event.title,
      isSimulated: true,
      message: "Sandbox test payment order ready",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create payment order" });
  }
});

// ── POST /api/payments/razorpay/verify ─────────────────────────────────────────
router.post("/payments/razorpay/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      eventId,
      participantId,
      registrationNumber,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
    } = req.body;

    if (!eventId || !razorpayOrderId || (!participantId && !registrationNumber)) {
      res.status(400).json({ error: "Missing verification payload" });
      return;
    }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, Number(eventId)));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const { keySecret } = await getRazorpayKeys(event.id);

    // Verify signature if real Razorpay secret is present
    if (keySecret && razorpaySignature && !razorpayOrderId.startsWith("order_sim_")) {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        res.status(400).json({ error: "Invalid payment signature verification" });
        return;
      }
    }

    // Find participant
    let participant;
    if (participantId) {
      [participant] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.id, Number(participantId)));
    } else if (registrationNumber) {
      [participant] = await db
        .select()
        .from(participantsTable)
        .where(
          and(
            eq(participantsTable.eventId, event.id),
            eq(participantsTable.registrationNumber, registrationNumber.trim().toUpperCase())
          )
        );
    }

    if (!participant) {
      res.status(404).json({ error: "Participant registration not found" });
      return;
    }

    // Decide approval status: auto-approve if event does not require manual approval
    const isAutoApproved = !event.requiresApproval;
    const finalApprovalStatus = isAutoApproved ? "approved" : "pending";
    const approvedAtTime = isAutoApproved ? new Date() : null;

    const [updatedParticipant] = await db
      .update(participantsTable)
      .set({
        isPaid: true,
        paymentStatus: "paid",
        paymentAmount: Number(amount) || event.registrationFee,
        paymentId: razorpayPaymentId || `pay_sim_${Date.now()}`,
        orderId: razorpayOrderId,
        approvalStatus: finalApprovalStatus,
        approvedAt: approvedAtTime,
      })
      .where(eq(participantsTable.id, participant.id))
      .returning();

    res.json({
      success: true,
      message: isAutoApproved
        ? "Payment verified! Your registration is confirmed."
        : "Payment verified! Your application has been submitted for coordinator approval.",
      participant: {
        id: updatedParticipant.id,
        name: updatedParticipant.name,
        registrationNumber: updatedParticipant.registrationNumber,
        isPaid: updatedParticipant.isPaid,
        paymentStatus: updatedParticipant.paymentStatus,
        approvalStatus: updatedParticipant.approvalStatus,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Payment verification failed" });
  }
});

export default router;
