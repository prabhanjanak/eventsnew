import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail, sendWhatsappMessage } from "./mailer";

export async function sendPreEventReminderToParticipant(p: any) {
  const subject = "3 Days to Vision 2020 Conference 2026! 🗓️";
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#F58220,#6F42C1);padding:28px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Vision 2020 Conference 2026</h1>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Bangalore · July 10–12, 2026</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello <strong>${p.name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">We are excited to welcome you to the upcoming Vision 2020 Annual Conference! Only 3 days left until the event starts.</p>
          <div style="background:#fff8f0;border-left:4px solid #F58220;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
            <div style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:6px;">Event Details</div>
            <div style="font-size:14px;color:#374151;">
              📅 <strong>Dates:</strong> July 10–12, 2026<br/>
              📍 <strong>Venue:</strong> Sankara Eye Hospital, Bangalore
            </div>
          </div>
          <p style="margin:0 0 16px;font-size:13px;color:#4b5563;">
            Please ensure you have your registered QR code ready for quick check-in at the registration counters.
          </p>
          <p style="margin:0;font-size:13px;color:#9ca3af;">See you in Bangalore!</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Sankara Eye Hospitals · Vision 2020 Annual Conference</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const plainText = `Hello ${p.name},\n\nWe are excited to welcome you to the Vision 2020 Annual Conference! 🎉\nOnly 3 days left until the event starts!\n\n📌 Details:\n• Dates: July 10–12, 2026\n• Venue: Sankara Eye Hospital, Bangalore\n\nPlease have your registered QR code ready for scanning at check-in.\n\nSee you in Bangalore!`;

  let sent = false;
  if (p.email && !p.email.includes("conference.vision2020india.org")) {
    const res = await sendEmail(p.email, subject, html, true);
    sent = res.success;
  } else if (p.mobile) {
    const res = await sendWhatsappMessage(p.mobile, plainText);
    sent = res.success;
  }

  if (sent) {
    await db.update(participantsTable)
      .set({ eventReminderSent: true })
      .where(eq(participantsTable.id, p.id));
  }
  return sent;
}

export async function sendAllPendingReminders() {
  console.log("[EVENT-REMINDER] Checking for participants pending 3-day reminder...");
  const pending = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.eventReminderSent, false));

  console.log(`[EVENT-REMINDER] Found ${pending.length} participants pending reminders.`);
  let successCount = 0;
  
  for (const p of pending) {
    try {
      if (p.name === "On Spot Slot" || !p.mobile || p.mobile.startsWith("OS")) continue;
      
      const ok = await sendPreEventReminderToParticipant(p);
      if (ok) successCount++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err: any) {
      console.error(`[EVENT-REMINDER] Failed to send reminder to ${p.name} (ID: ${p.id}):`, err.message);
    }
  }
  console.log(`[EVENT-REMINDER] Completed. Successfully sent ${successCount}/${pending.length}`);
}

async function checkAndSendReminders() {
  try {
    const now = new Date();
    const targetDate = new Date("2026-07-07T00:00:00+05:30");
    const targetEndDate = new Date("2026-07-08T00:00:00+05:30");
    
    if (now >= targetDate && now < targetEndDate) {
      await sendAllPendingReminders();
    }
  } catch (err: any) {
    console.error("[EVENT-REMINDER] Error in scheduler loop:", err.message);
  }
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startEventReminderScheduler() {
  if (schedulerHandle) return;
  console.log("[EVENT-REMINDER] Event pre-reminder scheduler started (checks every hour)");
  setTimeout(checkAndSendReminders, 10_000);
  schedulerHandle = setInterval(checkAndSendReminders, 60 * 60 * 1000);
}

export function stopEventReminderScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
