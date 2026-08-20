import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, participantsTable, assignmentsTable, eventsTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { sendWhatsappMessage, sendWhatsappDocument } from "../lib/mailer";
import { getClientBaseUrl } from "../lib/ip-helper";

const router = Router();

// Helper function to process broadcast in the background
async function processBroadcast(
  targets: { name: string; mobile: string | null; registrationNumber: string; delegateType?: string | null }[],
  event: any,
  templateType: "welcome" | "agenda" | "custom",
  customMessageTemplate?: string,
  clientBaseUrl?: string
) {
  console.log(`[WHATSAPP-BROADCAST] Starting ${templateType} broadcast to ${targets.length} recipients for event: "${event.title}"...`);
  let successCount = 0;
  const baseUrl = clientBaseUrl || "https://events.sankaraeye.in";

  for (const p of targets) {
    if (!p.mobile) continue;
    const cleanMob = p.mobile.replace(/[^0-9]/g, "").slice(-10);
    if (!cleanMob || cleanMob.length < 10) continue;

    const passUrl = `${baseUrl}/q/${p.registrationNumber}`;
    const agendaUrl = event.agendaPdfUrl || `${baseUrl}/agenda/${p.registrationNumber}`;
    const roleLabel = p.delegateType === "team_sankara"
      ? "Team Sankara"
      : p.delegateType === "vendor"
      ? "Vendor Partner"
      : p.delegateType === "exhibitor"
      ? "Exhibitor / Stall"
      : p.delegateType === "guest"
      ? "VIP Guest"
      : "Delegate";

    let messageText = "";

    if (templateType === "welcome") {
      messageText = `Namaskaram ${p.name},

Welcome to *${event.title}*!

Your registration has been confirmed.
*Pass ID / Reg No:* ${p.registrationNumber}
*Role Category:* ${roleLabel}

📱 *Your Verified Pass & QR Code:*
${passUrl}

📍 *Venue:* ${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}
📅 *Dates:* ${event.startDate || "Upcoming"}

Please present this pass at entry and food counters.

Regards,
Sankara Eye Care Institutions`;
    } else if (templateType === "agenda") {
      messageText = `Namaskaram ${p.name},

The official scientific schedule and agenda for *${event.title}* is now available.

📅 *Event Dates:* ${event.startDate || ""} ${event.endDate ? `to ${event.endDate}` : ""}
📍 *Venue:* ${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}

📄 *Download Event Agenda & PDF:*
${agendaUrl}

📱 *Your Personal Pass & Schedule:*
${passUrl}

We look forward to welcoming you!

Regards,
Sankara Eye Care Institutions`;
    } else {
      messageText = (customMessageTemplate || "")
        .replace(/\{\{name\}\}/gi, p.name)
        .replace(/\{\{registrationNumber\}\}/gi, p.registrationNumber)
        .replace(/\{\{eventTitle\}\}/gi, event.title)
        .replace(/\{\{venue\}\}/gi, event.venue || "")
        .replace(/\{\{agendaUrl\}\}/gi, agendaUrl)
        .replace(/\{\{passUrl\}\}/gi, passUrl);
    }

    try {
      await sendWhatsappMessage(cleanMob, messageText);
      successCount++;
      // Sleep 350ms between messages to respect API limits
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err: any) {
      console.error(`[WHATSAPP-BROADCAST] Failed to send to ${p.name} (${cleanMob}):`, err.message);
    }
  }

  console.log(`[WHATSAPP-BROADCAST] Broadcast completed. Sent ${successCount}/${targets.length}`);
}

// POST /whatsapp/broadcast
router.post(
  "/whatsapp/broadcast",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req, res): Promise<void> => {
    const {
      eventId,
      templateType = "welcome",
      target = "all",
      customMessage,
      participantIds,
    } = req.body as {
      eventId?: number;
      templateType?: "welcome" | "agenda" | "custom";
      target?: "all" | "faculty" | "delegates" | "onspot" | "selected";
      customMessage?: string;
      participantIds?: number[];
    };

    try {
      // Find event
      let event = null;
      if (eventId) {
        [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      }
      if (!event) {
        const [firstEvent] = await db.select().from(eventsTable).limit(1);
        event = firstEvent;
      }

      if (!event) {
        res.status(404).json({ error: "No active event found" });
        return;
      }

      let queryConditions: any[] = [eq(participantsTable.eventId, event.id)];

      if (target === "onspot") {
        queryConditions.push(eq(participantsTable.isOnSpot, true));
      } else if (target === "delegates") {
        queryConditions.push(eq(participantsTable.isOnSpot, false));
      }

      let targets: any[] = [];
      if (target === "selected" && participantIds && participantIds.length > 0) {
        targets = await db
          .select({
            id: participantsTable.id,
            name: participantsTable.name,
            mobile: participantsTable.mobile,
            registrationNumber: participantsTable.registrationNumber,
            delegateType: participantsTable.delegateType,
          })
          .from(participantsTable)
          .where(and(eq(participantsTable.eventId, event.id), inArray(participantsTable.id, participantIds)));
      } else if (target === "faculty") {
        targets = await db
          .selectDistinctOn([participantsTable.id], {
            id: participantsTable.id,
            name: participantsTable.name,
            mobile: participantsTable.mobile,
            registrationNumber: participantsTable.registrationNumber,
            delegateType: participantsTable.delegateType,
          })
          .from(participantsTable)
          .innerJoin(assignmentsTable, eq(participantsTable.id, assignmentsTable.participantId))
          .where(eq(participantsTable.eventId, event.id));
      } else {
        targets = await db
          .select({
            id: participantsTable.id,
            name: participantsTable.name,
            mobile: participantsTable.mobile,
            registrationNumber: participantsTable.registrationNumber,
            delegateType: participantsTable.delegateType,
          })
          .from(participantsTable)
          .where(and(...queryConditions));
      }

      const validTargets = targets.filter(
        (t) => t.mobile && !t.mobile.startsWith("OS") && t.name !== "Unassigned Pass"
      );

      const clientBaseUrl = getClientBaseUrl(req);

      // Trigger asynchronous background broadcast
      processBroadcast(validTargets, event, templateType, customMessage, clientBaseUrl).catch((err) => {
        console.error("[WHATSAPP-BROADCAST] Async Error:", err);
      });

      res.json({
        success: true,
        count: validTargets.length,
        templateType,
        eventTitle: event.title,
        message: `WhatsApp broadcast queued successfully to ${validTargets.length} recipients.`,
      });
    } catch (err: any) {
      console.error("[WHATSAPP-BROADCAST] Error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate broadcast" });
    }
  }
);

// POST /whatsapp/test (Admin/Super Admin only)
router.post(
  "/whatsapp/test",
  requireAuth(["admin", "super_admin", "event_coordinator"]),
  async (req, res): Promise<void> => {
    const { numbers, message, templateType = "welcome", eventId } = req.body as {
      numbers: string;
      message?: string;
      templateType?: "welcome" | "agenda" | "custom";
      eventId?: number;
    };

    if (!numbers) {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    try {
      let event = null;
      if (eventId) {
        [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      }
      if (!event) {
        const [firstEvent] = await db.select().from(eventsTable).limit(1);
        event = firstEvent || { title: "Sankara Medical Conference", venue: "Sankara Eye Hospital", city: "Coimbatore" };
      }

      const clientBaseUrl = getClientBaseUrl(req);
      const samplePassUrl = `${clientBaseUrl}/q/DEMO-1001`;
      const sampleAgendaUrl = event.agendaPdfUrl || `${clientBaseUrl}/agenda/DEMO-1001`;

      let messageText = message;
      if (!messageText) {
        if (templateType === "welcome") {
          messageText = `Namaskaram Dr. Demo Attendee,

Welcome to *${event.title}*!

Your registration has been confirmed.
*Pass ID / Reg No:* DEMO-1001
*Role Category:* Delegate

📱 *Your Verified Pass & QR Code:*
${samplePassUrl}

📍 *Venue:* ${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}
📅 *Dates:* ${event.startDate || "Upcoming"}

Please present this pass at entry and food counters.

Regards,
Sankara Eye Care Institutions`;
        } else {
          messageText = `Namaskaram Dr. Demo Attendee,

The official scientific schedule and agenda for *${event.title}* is now available.

📅 *Event Dates:* ${event.startDate || ""} ${event.endDate ? `to ${event.endDate}` : ""}
📍 *Venue:* ${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}

📄 *Download Event Agenda & PDF:*
${sampleAgendaUrl}

📱 *Your Personal Pass & Schedule:*
${samplePassUrl}

We look forward to welcoming you!

Regards,
Sankara Eye Care Institutions`;
        }
      }

      const cleanNumbers = numbers
        .split(",")
        .map((n) => n.replace(/[^0-9]/g, "").slice(-10))
        .filter(Boolean);

      let successCount = 0;
      const errors: string[] = [];

      for (const num of cleanNumbers) {
        const result = await sendWhatsappMessage(num, messageText);
        if (result.success) {
          successCount++;
        } else {
          errors.push(`${num}: ${result.error}`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        res.status(500).json({ error: `Failed to send test WhatsApp: ${errors.join("; ")}` });
        return;
      }

      res.json({
        success: true,
        message: `Successfully sent test WhatsApp to ${successCount}/${cleanNumbers.length} numbers.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send test WhatsApp" });
    }
  }
);

export default router;
