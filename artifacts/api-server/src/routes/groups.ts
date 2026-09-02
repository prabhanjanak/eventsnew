import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, groupRegistrationsTable, participantsTable, eventsTable } from "@workspace/db";
import QRCode from "qrcode";
import { sendEmail } from "../lib/mailer";
import crypto from "crypto";

const router = Router();

// Helper to clean phone numbers
function cleanPhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

// POST /api/events/:eventId/group-register — Register multiple delegates under one organization
router.post("/events/:eventId/group-register", async (req, res): Promise<void> => {
  try {
    const eventId = parseInt(String(req.params.eventId), 10);
    if (Number.isNaN(eventId)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const {
      organizationName,
      coordinatorName,
      coordinatorEmail,
      coordinatorPhone,
      delegates, // Array of { name, email, mobile, designation, foodPreference, categoryTierName }
      paymentMethod, // 'online' | 'neft' | 'complimentary'
      utrNumber,
      notes,
    } = req.body;

    if (!organizationName || !coordinatorName || !coordinatorEmail || !coordinatorPhone) {
      res.status(400).json({ error: "Organization and Coordinator contact details are required." });
      return;
    }

    if (!Array.isArray(delegates) || delegates.length === 0) {
      res.status(400).json({ error: "Please provide at least one delegate in the group." });
      return;
    }

    const groupCode = `GRP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const totalDelegates = delegates.length;
    const feePerDelegate = event.isPaid ? (event.registrationFee || 0) : 0;
    const totalAmount = feePerDelegate * totalDelegates;
    const isPaid = paymentMethod === "complimentary" || !event.isPaid;

    // 1. Create Group Registration Header
    const [groupRecord] = await db
      .insert(groupRegistrationsTable)
      .values({
        eventId,
        groupCode,
        organizationName,
        coordinatorName,
        coordinatorEmail,
        coordinatorPhone,
        totalDelegates,
        totalAmount,
        paymentStatus: isPaid ? "paid" : "unpaid",
        utrNumber: utrNumber || null,
        delegatesJson: JSON.stringify(delegates),
        notes: notes || null,
      })
      .returning();

    // 2. Create individual participant accounts for all group members
    const createdParticipants: any[] = [];
    for (let i = 0; i < delegates.length; i++) {
      const d = delegates[i];
      const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
      const regNumber = `GRP-${groupRecord.id}-${i + 1}-${randomSuffix}`;
      const qrToken = `SEC-QR-${groupRecord.id}-${i + 1}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      try {
        const [participant] = await db
          .insert(participantsTable)
          .values({
            eventId,
            registrationNumber: regNumber,
            qrToken,
            name: d.name || `Delegate ${i + 1}`,
            email: d.email || coordinatorEmail,
            mobile: d.mobile ? cleanPhone(d.mobile) : cleanPhone(coordinatorPhone),
            institution: organizationName,
            designation: d.designation || "Delegate",
            categoryTierName: d.categoryTierName || "Group Delegate",
            groupRegistrationId: groupRecord.id,
            isPaid,
            paymentStatus: isPaid ? "paid" : "unpaid",
            paymentAmount: feePerDelegate,
            delegateType: "delegate",
          })
          .returning();

        if (participant) {
          createdParticipants.push(participant);

          // Send confirmation email to individual delegate if distinct email provided
          if (d.email && d.email !== coordinatorEmail) {
            const qrUrl = await QRCode.toDataURL(qrToken, { width: 300, margin: 2 });
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${event.title}</h1>
                  <p style="color: #38bdf8; margin: 8px 0 0; font-size: 14px;">Group Registration Confirmed via ${organizationName}</p>
                </div>
                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
                  <p>Dear <strong>${d.name}</strong>,</p>
                  <p>You have been registered for <strong>${event.title}</strong> under group code <strong>${groupCode}</strong>.</p>
                  <p>Your Registration Number is: <strong style="font-size: 16px; color: #2563eb;">${regNumber}</strong></p>
                  <div style="text-align: center; margin: 24px 0;">
                    <img src="${qrUrl}" alt="Check-in QR Code" style="width: 180px; height: 180px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px;" />
                    <p style="font-size: 12px; color: #64748b; margin-top: 6px;">Show this QR Code at the registration desk for instant check-in.</p>
                  </div>
                </div>
              </div>
            `;
            sendEmail(d.email, `Registration Confirmed: ${event.title}`, emailHtml).catch(() => {});
          }
        }
      } catch (e: any) {
        console.error(`[Group Reg] Error adding delegate ${d.name}:`, e.message);
      }
    }

    // 3. Send Summary Email to Group Coordinator
    const coordinatorSummaryHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${event.title}</h1>
          <p style="color: #4ade80; margin: 8px 0 0; font-size: 14px;">Group Registration Successful</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
          <p>Dear <strong>${coordinatorName}</strong>,</p>
          <p>Your group registration for <strong>${organizationName}</strong> has been received with <strong>${createdParticipants.length} delegates</strong>.</p>
          <p><strong>Group Booking Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${groupCode}</span></p>
          <p><strong>Total Amount:</strong> ₹${totalAmount.toLocaleString("en-IN")}</p>
          <p><strong>Payment Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${isPaid ? '#16a34a' : '#d97706'}">${groupRecord.paymentStatus}</span></p>
          <h3 style="margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Registered Delegates:</h3>
          <ol style="padding-left: 20px; line-height: 1.8;">
            ${delegates.map((d: any) => `<li><strong>${d.name}</strong> (${d.designation || 'Delegate'}) - ${d.mobile || ''}</li>`).join("")}
          </ol>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">For any queries or modifications, please contact the Event SPOC or support desk.</p>
        </div>
      </div>
    `;
    sendEmail(coordinatorEmail, `Group Registration Summary: ${groupCode} - ${event.title}`, coordinatorSummaryHtml).catch(() => {});

    res.json({
      success: true,
      groupCode,
      totalDelegates: createdParticipants.length,
      totalAmount,
      group: groupRecord,
      participants: createdParticipants,
    });
  } catch (err: any) {
    console.error("[Group Registration] Error:", err);
    res.status(500).json({ error: "Failed to process group registration", details: err.message });
  }
});

// GET /api/groups/:groupCode — Fetch group details and list of delegates
router.get("/groups/:groupCode", async (req, res): Promise<void> => {
  try {
    const { groupCode } = req.params;
    const [group] = await db
      .select()
      .from(groupRegistrationsTable)
      .where(eq(groupRegistrationsTable.groupCode, groupCode))
      .limit(1);

    if (!group) {
      res.status(404).json({ error: "Group registration not found" });
      return;
    }

    const participants = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.groupRegistrationId, group.id));

    let event: any = null;
    if (group.eventId) {
      const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, group.eventId)).limit(1);
      event = ev;
    }

    res.json({
      group,
      event,
      participants,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
