/**
 * RSVP Email Reminder Scheduler
 * Runs every minute and fires email reminders:
 *  - 15 minutes before session: first reminder
 *  - 5 minutes before session: follow-up ONLY if email was not opened
 */
import { db, rsvpTable, participantsTable } from "@workspace/db";
import { eq, isNull, and, isNotNull } from "drizzle-orm";
import { sendRsvpReminderEmail, sendWhatsappMessage } from "./mailer";
import crypto from "crypto";

function parseSessionDateTime(date: string, time: string): Date | null {
  try {
    let hours = 0;
    let minutes = 0;

    // Extract start time from a range like "09:00-09:02"
    const startTimeStr = time.split("-")[0].trim();

    if (/am|pm/i.test(startTimeStr)) {
      const match = startTimeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (!match) return null;
      hours = parseInt(match[1]);
      minutes = parseInt(match[2]);
      const period = match[3].toLowerCase();
      if (period === "pm" && hours < 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;
    } else {
      const parts = startTimeStr.split(":");
      hours = parseInt(parts[0]);
      minutes = parseInt(parts[1]);
    }

    if (isNaN(hours) || isNaN(minutes)) return null;

    // Parse date split by "-"
    const parts = date.split("-").map(Number);
    if (parts.length !== 3) return null;

    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Fallback if date is YYYY-MM-DD
    if (day > 1900) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }

    // Parse as IST (UTC+5:30)
    const utcMs = Date.UTC(year, month - 1, day, hours - 5, minutes - 30, 0);
    return new Date(utcMs);
  } catch {
    return null;
  }
}

function getServerBaseUrl(): string {
  return process.env.SERVER_BASE_URL || "http://localhost:5000";
}

async function processReminders() {
  try {
    const now = Date.now();
    const allRsvps = await db.select().from(rsvpTable);

    for (const rsvp of allRsvps) {
      const sessionStart = parseSessionDateTime(rsvp.sessionDate, rsvp.sessionTime);
      if (!sessionStart) continue;

      const minsUntil = (sessionStart.getTime() - now) / 60000;

      // === 15-minute reminder ===
      if (minsUntil >= 13 && minsUntil <= 17 && !rsvp.reminder1SentAt) {
        const participant = await db.query.participantsTable.findFirst({
          where: eq(participantsTable.id, rsvp.participantId),
        });
        if (!participant?.email) continue;

        const token = rsvp.emailOpenToken || crypto.randomUUID();

        // Ensure token is stored
        if (!rsvp.emailOpenToken) {
          await db.update(rsvpTable)
            .set({ emailOpenToken: token })
            .where(eq(rsvpTable.id, rsvp.id));
        }

        const sent = await sendRsvpReminderEmail(
          rsvp.participantEmail || participant.email,
          participant.name,
          rsvp.sessionName,
          rsvp.trackName,
          rsvp.sessionDate,
          rsvp.sessionTime,
          token,
          getServerBaseUrl(),
          false
        );

        if (sent) {
          await db.update(rsvpTable)
            .set({ reminder1SentAt: new Date(), emailOpenToken: token })
            .where(eq(rsvpTable.id, rsvp.id));
          console.log(`[SCHEDULER] 15-min reminder sent: ${participant.name} → ${rsvp.sessionName}`);

          if (participant.mobile) {
            const waText = `⏰ Reminder: Your RSVP'd session "${rsvp.sessionName}" is starting in 15 minutes!\n\n📌 Details:\n• Track: ${rsvp.trackName}\n• Date: ${rsvp.sessionDate}\n• Time: ${rsvp.sessionTime}\n\nPlease proceed to the session hall.`;
            sendWhatsappMessage(participant.mobile, waText).catch((err) =>
              console.error("[SCHEDULER] Failed to send 15-min WhatsApp reminder:", err.message)
            );
          }
        }
      }

      // === 5-minute follow-up (only if NOT opened) ===
      if (minsUntil >= 3 && minsUntil <= 7
        && rsvp.reminder1SentAt      // first was sent
        && !rsvp.reminder2SentAt     // follow-up not yet sent
        && !rsvp.emailOpenedAt       // email was NOT opened
      ) {
        const participant = await db.query.participantsTable.findFirst({
          where: eq(participantsTable.id, rsvp.participantId),
        });
        if (!participant?.email) continue;

        const token = rsvp.emailOpenToken || crypto.randomUUID();

        const sent = await sendRsvpReminderEmail(
          rsvp.participantEmail || participant.email,
          participant.name,
          rsvp.sessionName,
          rsvp.trackName,
          rsvp.sessionDate,
          rsvp.sessionTime,
          token,
          getServerBaseUrl(),
          true // follow-up
        );

        if (sent) {
          await db.update(rsvpTable)
            .set({ reminder2SentAt: new Date() })
            .where(eq(rsvpTable.id, rsvp.id));
          console.log(`[SCHEDULER] 5-min follow-up sent: ${participant.name} → ${rsvp.sessionName}`);

          if (participant.mobile) {
            const waText = `⏰ Urgent Reminder: Your RSVP'd session "${rsvp.sessionName}" is starting in 5 minutes! Please proceed to the session hall.`;
            sendWhatsappMessage(participant.mobile, waText).catch((err) =>
              console.error("[SCHEDULER] Failed to send 5-min WhatsApp reminder:", err.message)
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[SCHEDULER] Error in reminder loop:", err.message);
  }
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startRsvpScheduler() {
  if (schedulerHandle) return; // already running
  console.log("[SCHEDULER] RSVP email reminder scheduler started (checks every 60s)");
  schedulerHandle = setInterval(processReminders, 60_000);
  // Also run once immediately on start (helps in dev)
  setTimeout(processReminders, 5_000);
}

export function stopRsvpScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
