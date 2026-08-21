import nodemailer from "nodemailer";
import { db, submissionSettingsTable, participantsTable, systemUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

interface QueueItem<T> {
  task: () => Promise<T>;
  priority: number; // 0 for high, 1 for normal
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

class PriorityQueue {
  private queue: QueueItem<any>[] = [];
  private processing = false;
  private delayMs: number;

  constructor(delayMs: number = 200) {
    this.delayMs = delayMs;
  }

  enqueue<T>(task: () => Promise<T>, priority: number = 1): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = { task, priority, resolve, reject };
      if (priority === 0) {
        const index = this.queue.findIndex((q) => q.priority > 0);
        if (index === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(index, 0, item);
        }
      } else {
        this.queue.push(item);
      }
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          const result = await item.task();
          item.resolve(result);
        } catch (err) {
          item.reject(err);
        }
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
    }

    this.processing = false;
  }
}

const emailQueue = new PriorityQueue(100);
const whatsappQueue = new PriorityQueue(200);

let _settings: {
  host: string; port: number; user: string; pass: string;
  fromEmail: string; fromName: string;
} | null = null;

async function getMailerSettings() {
  try {
    const [s] = await db.select().from(submissionSettingsTable).limit(1);
    const host = s?.smtpHost || process.env.SMTP_HOST || "smtp.zoho.com";
    const user = s?.smtpUser || process.env.SMTP_USER || "events@sankaraeye.com";
    const pass = s?.smtpPass || process.env.SMTP_PASS;
    const port = s?.smtpPort ?? (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    const secure = s?.smtpSecure ?? (process.env.SMTP_SECURE === "true");
    const fromEmail = s?.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "events@sankaraeye.com";
    const fromName = s?.smtpFromName || process.env.SMTP_FROM_NAME || "Sankara Eye Foundation India";

    if (!host || !user || !pass) return null;

    return {
      host,
      port,
      user,
      pass,
      secure,
      fromEmail,
      fromName,
    };
  } catch (err) {
    console.error("[MAILER] Error retrieving mailer settings:", err);
    return null;
  }
}

export function cleanPhoneNumber(mobile: string): string {
  let cleaned = mobile.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

function htmlToWhatsappText(html: string, subject: string): string {
  let text = subject ? `*${subject.trim()}*\n\n` : "";
  let body = html;

  body = body.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n*$1*\n');
  body = body.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '*$2*');
  body = body.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
  body = body.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1');
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<tr[^>]*>/gi, '\n');
  body = body.replace(/<td[^>]*>(.*?)<\/td>/gi, ' $1 ');
  body = body.replace(/<[^>]+>/g, '');

  body = body
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&bull;/g, '•');

  text += body;
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function extractImageUrl(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  const url = match[1];
  if (url.includes("track-open") || url.startsWith("data:") || url.includes("1x1") || url.startsWith("cid:")) {
    return null;
  }
  return url;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  mirrorToWhatsapp = true
): Promise<{ success: boolean; error?: string }> {
  const isOtp = subject.toLowerCase().includes("verification") ||
    subject.toLowerCase().includes("otp") ||
    html.toLowerCase().includes("verification code") ||
    html.toLowerCase().includes("otp");
  const priority = isOtp ? 0 : 1;

  return emailQueue.enqueue(async () => {
    try {
      const cfg = await getMailerSettings();
      if (!cfg) {
        console.warn("[MAILER] SMTP not configured — email not sent to", to);
        return { success: false, error: "SMTP not configured" };
      }

      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: { rejectUnauthorized: false },
      });

      const bannerPath = path.resolve(process.cwd(), "../../attached_assets/headerwebfinal.png");
      const hasBanner = fs.existsSync(bannerPath);

      let finalHtml = html;
      const attachments: any[] = [];

      if (hasBanner) {
        attachments.push({
          filename: "header-banner.png",
          path: bannerPath,
          cid: "email-header-banner",
        });

        // Inject into 520px-wide table layouts
        const tablePattern = /<table width="520"\s+cellpadding="0"\s+cellspacing="0"\s+style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0\s+4px\s+24px\s+rgba\(0,0,0,0\.08\);">/gi;
        if (tablePattern.test(finalHtml)) {
          finalHtml = finalHtml.replace(tablePattern, (match) => {
            return `${match}\n        <tr><td style="padding:0;line-height:0;margin:0;background-color:#ffffff;text-align:center;border-top-left-radius:16px;border-top-right-radius:16px;overflow:hidden;"><img src="cid:email-header-banner" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-top-left-radius:16px;border-top-right-radius:16px;" alt="Vision 2020 Header" /></td></tr>`;
          });
        }

        // Inject into 500px-wide div layouts
        const divPattern = /<div style="font-family:Arial,sans-serif;padding:20px;color:#333;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba\(0,0,0,0\.05\);max-width:500px;margin:auto;border:1px solid #e5e7eb;">/gi;
        if (divPattern.test(finalHtml)) {
          finalHtml = finalHtml.replace(divPattern, (match) => {
            return `${match}\n        <div style="text-align:center;margin:-20px -20px 20px -20px;padding:0;line-height:0;border-top-left-radius:12px;border-top-right-radius:12px;overflow:hidden;border-bottom:1px solid #e5e7eb;"><img src="cid:email-header-banner" width="500" style="display:block;width:100%;max-width:500px;height:auto;border-top-left-radius:12px;border-top-right-radius:12px;" alt="Vision 2020 Header" /></div>`;
          });
        }
      }

      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to,
        subject,
        html: finalHtml,
        attachments,
      });

      console.log(`[MAILER] Email sent to ${to} — "${subject}"`);

      if (mirrorToWhatsapp) {
        try {
          let mobileNumber: string | null = null;
          let participantName: string = "";

          const [participant] = await db
            .select({ mobile: participantsTable.mobile, name: participantsTable.name })
            .from(participantsTable)
            .where(eq(participantsTable.email, to.toLowerCase()))
            .limit(1);

          if (participant?.mobile) {
            mobileNumber = participant.mobile;
            participantName = participant.name;
          } else {
            const [sysUser] = await db
              .select({ mobile: systemUsersTable.mobile, name: systemUsersTable.name })
              .from(systemUsersTable)
              .where(eq(systemUsersTable.email, to.toLowerCase()))
              .limit(1);
            if (sysUser?.mobile) {
              mobileNumber = sysUser.mobile;
              participantName = sysUser.name;
            }
          }

          if (mobileNumber) {
            const isOtp = subject.toLowerCase().includes("verification") ||
              subject.toLowerCase().includes("otp") ||
              html.toLowerCase().includes("verification code") ||
              html.toLowerCase().includes("otp");

            let waText = "";
            if (isOtp) {
              const otpMatch = html.match(/\b(\d{6})\b/);
              const otpCode = otpMatch ? otpMatch[1] : "";
              if (otpCode) {
                const [settings] = await db.select().from(submissionSettingsTable).limit(1);
                const template = settings?.whatsappTemplate || "{{otp}} is your verification code. For your security, do not share this code.";
                waText = template.replace(/{{otp}}/g, otpCode);
              }
            }

            if (!waText) {
              waText = htmlToWhatsappText(html, subject);
            }

            if (waText) {
              const imageUrl = extractImageUrl(html);
              if (imageUrl) {
                console.log(`[MAIL-MIRROR] Mirroring email as WhatsApp document for ${to} -> ${mobileNumber}`);
                await sendWhatsappDocument(mobileNumber, imageUrl, "image.jpg", waText);
              } else {
                console.log(`[MAIL-MIRROR] Mirroring email to WhatsApp for ${to} -> ${mobileNumber}`);
                await sendWhatsappMessage(mobileNumber, waText);
              }
            }
          }
        } catch (waErr: any) {
          console.error("[MAIL-MIRROR] Failed to mirror email to WhatsApp:", waErr.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error(`[MAILER] Failed to send email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }, priority);
}

interface WhatsappTemplatesJson {
  otp?: string;
  attendance?: string;
  food?: string;
}

function getWhatsappTemplates(templateConfig: string | null): WhatsappTemplatesJson {
  if (!templateConfig) return {};
  const trimmed = templateConfig.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.otp || parsed.attendance || parsed.food) {
        return parsed as WhatsappTemplatesJson;
      }
    } catch (e) {
      // ignore
    }
  }
  return {};
}

/** Send a 6-digit OTP via WhatsApp */
export async function sendOtpWhatsapp(toMobile: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    let templateConfig = settings?.whatsappTemplate || "";

    const templates = getWhatsappTemplates(templateConfig);
    if (templates.otp) {
      templateConfig = templates.otp;
    }

    // If the template is a JSON template config or template name
    let payload: any;
    if (templateConfig.trim().startsWith("{")) {
      try {
        const replacedJson = templateConfig.replace(/{{otp}}/g, otp);
        payload = JSON.parse(replacedJson);
      } catch (e) {
        // Fall back to text if JSON parsing fails
      }
    }

    if (!payload) {
      // If it's a template name without spaces, send as template structure
      if (templateConfig && !templateConfig.includes(" ") && templateConfig.length < 50) {
        if (templateConfig === "vision2020_otp" || templateConfig.includes("otp")) {
          payload = {
            name: templateConfig,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: otp }
                ]
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: otp }
                ]
              }
            ]
          };
        } else {
          payload = {
            name: templateConfig,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: otp }
                ]
              }
            ]
          };
        }
      } else {
        // Fall back to plain text
        const text = templateConfig.includes("{{otp}}")
          ? templateConfig.replace(/{{otp}}/g, otp)
          : `${otp} is your verification code. For your security, do not share this code.`;
        return await sendWhatsappMessage(toMobile, text);
      }
    }

    return await sendWhatsappMessage(toMobile, JSON.stringify(payload));
  } catch (err: any) {
    console.error("[WHATSAPP-OTP] Failed to send OTP via WhatsApp:", err.message);
    return { success: false, error: err.message };
  }
}

/** Send a 6-digit OTP via email */
export async function sendOtpEmail(toEmail: string, participantName: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const subject = `${otp} is your Sankara Events Verification Code`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#09090B;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#141417;border-radius:24px;border:1px solid #2B2B32;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        <tr>
          <td style="background:#18181C;padding:32px 32px 24px;border-bottom:1px solid #27272D;text-align:center;">
            <div style="display:inline-block;padding:6px 14px;background:#27272D;border-radius:20px;border:1px solid #363640;margin-bottom:12px;">
              <span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#FFFFFF;text-transform:uppercase;">Sankara Events</span>
            </div>
            <h1 style="color:#ffffff;margin:0 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Verification Code</h1>
            <p style="color:#A1A1AA;margin:0;font-size:13px;font-weight:500;">Sankara Eye Foundation India</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 12px;font-size:15px;color:#E4E4E7;">
              Hello <strong>${participantName || "Delegate"}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#A1A1AA;line-height:1.6;">
              Please use the one-time verification code below to sign in and access your event registrations, schedules, and digital passes.
            </p>
            <div style="background:#09090B;border:2px dashed #3F3F46;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px;">
              <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#FFFFFF;font-family:monospace;">${otp}</span>
            </div>
            <p style="margin:0 0 6px;font-size:13px;color:#71717A;text-align:center;">
              This code expires in <strong style="color:#E4E4E7;">10 minutes</strong>. Never share this code with anyone.
            </p>
            <p style="margin:0;font-size:12px;color:#52525B;text-align:center;">
              If you did not request this login code, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0F0F12;border-top:1px solid #222228;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#71717A;">Developed by Team IS - MHQ</p>
            <p style="margin:0;font-size:11px;color:#52525B;">© ${new Date().getFullYear()} Sankara Eye Foundation India</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return sendEmail(toEmail, subject, html, false);
}

/** Send RSVP reminder email with open-tracking pixel */
export async function sendRsvpReminderEmail(
  toEmail: string,
  participantName: string,
  sessionName: string,
  trackName: string,
  sessionDate: string,
  sessionTime: string,
  trackingToken: string,
  serverBaseUrl: string,
  isFollowUp = false
): Promise<boolean> {
  const trackingPixel = `${serverBaseUrl}/api/rsvp/track-open/${trackingToken}`;
  const subject = isFollowUp
    ? `⏰ Reminder: "${sessionName}" starts in 5 minutes`
    : `🗓️ Your session "${sessionName}" starts in 15 minutes`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#F58220,#6F42C1);padding:28px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Session Starting Soon!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Vision 2020 Conference 2026 · Bangalore</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello <strong>${participantName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
            ${isFollowUp ? "Just a quick follow-up — the session you RSVP'd to starts very soon!" : "The session you RSVP'd to is starting in 15 minutes!"}
          </p>
          <div style="background:#fff8f0;border-left:4px solid #F58220;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
            <div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:6px;">${sessionName}</div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">
              <span style="background:#ede9fe;color:#6F42C1;padding:2px 8px;border-radius:20px;font-weight:600;font-size:11px;">${trackName}</span>
            </div>
            <div style="font-size:14px;color:#374151;margin-top:10px;">
              📅 ${sessionDate} &nbsp; 🕐 ${sessionTime}
            </div>
          </div>
          <p style="margin:0;font-size:13px;color:#9ca3af;">Please make your way to the session hall now. See you there!</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Sankara Eye Hospitals · Vision 2020 Annual Conference</p>
          <p style="margin:4px 0 0;font-size:10px;color:#b2bbc8;font-style:italic;">This is an automated email. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <!-- Tracking pixel -->
  <img src="${trackingPixel}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
  const res = await sendEmail(toEmail, subject, html, false);
  return res.success;
}

let whatsappSettingsCache: { accessToken: string | null; phoneNumberId: string | null } | null = null;

export function invalidateWhatsappSettingsCache() {
  whatsappSettingsCache = null;
}

async function getWhatsappSettings() {
  if (whatsappSettingsCache) return whatsappSettingsCache;
  const [s] = await db
    .select({
      accessToken: submissionSettingsTable.whatsappApiKey,     // Meta Access Token
      phoneNumberId: submissionSettingsTable.whatsappInstanceId, // Meta Phone Number ID
    })
    .from(submissionSettingsTable)
    .limit(1);
  if (s) {
    whatsappSettingsCache = {
      accessToken: s.accessToken,
      phoneNumberId: s.phoneNumberId,
    };
  }
  return whatsappSettingsCache;
}

/** Send a general message via WhatsApp using Meta Business Cloud API */
export async function sendWhatsappMessage(toMobile: string, text: string): Promise<{ success: boolean; error?: string }> {
  const isOtp = text.toLowerCase().includes("verification") ||
    text.toLowerCase().includes("otp") ||
    (text.trim().startsWith("{") && text.toLowerCase().includes("otp"));
  const priority = isOtp ? 0 : 1;

  return whatsappQueue.enqueue(async () => {
    try {
      const settings = await getWhatsappSettings();
      if (!settings?.accessToken || !settings?.phoneNumberId) {
        console.warn(`[WHATSAPP] WhatsApp not configured — message not sent to ${toMobile}`);
        return { success: false, error: "WhatsApp API not configured" };
      }

      // Normalize mobile: must be full international format (e.g. 918951568286)
      const cleanMobile = cleanPhoneNumber(toMobile);

      const url = `https://graph.facebook.com/v20.0/${settings.phoneNumberId}/messages`;
      let messageBody: any = {
        messaging_product: "whatsapp",
        to: cleanMobile,
        type: "text",
        text: { body: text },
      };

      // Attempt to parse text as JSON. If it's a template payload, use it directly.
      try {
        const parsed = JSON.parse(text.trim());
        if (parsed.type === "template" || parsed.template || (parsed.name && parsed.language)) {
          messageBody = {
            messaging_product: "whatsapp",
            to: cleanMobile,
            type: "template",
            template: parsed.template || parsed,
          };
        }
      } catch (e) {
        // Not a valid JSON template payload, treat as normal text message
      }

      let languageCode = "en";
      let attempts = 0;
      let response;
      let data;

      while (attempts < 2) {
        attempts++;

        // Rebuild/override language code if template
        if (messageBody.type === "template" && messageBody.template) {
          messageBody.template.language = { code: languageCode };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.accessToken}`,
            },
            body: JSON.stringify(messageBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        data = await response.json() as any;

        if (!response.ok) {
          const errMsg = data?.error?.message || data?.error || JSON.stringify(data);

          // Auto-retry with en_US if en fails with translation code 132001
          if (errMsg.includes("132001") && languageCode === "en" && attempts < 2) {
            console.log(`[WHATSAPP] Translation error for 'en'. Retrying with 'en_US' for ${cleanMobile}...`);
            languageCode = "en_US";
            continue;
          }
          throw new Error(`Meta API returned status ${response.status}: ${errMsg}`);
        }
        break; // Success
      }

      if (data?.messages?.[0]?.id) {
        console.log(`[WHATSAPP] Message sent to ${cleanMobile}, msg_id: ${data.messages[0].id}`);
        return { success: true };
      }

      throw new Error(data?.error?.message || "Unexpected response from Meta API");
    } catch (err: any) {
      console.error(`[WHATSAPP] Failed to send message to ${toMobile}:`, err.message);
      return { success: false, error: err.message };
    }
  }, priority);
}

/** Send an image/document via WhatsApp using Meta Business Cloud API */
export async function sendWhatsappDocument(
  toMobile: string,
  fileUrl: string,
  filename: string,
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  return whatsappQueue.enqueue(async () => {
    try {
      const settings = await getWhatsappSettings();
      if (!settings?.accessToken || !settings?.phoneNumberId) {
        console.warn(`[WHATSAPP] WhatsApp not configured — document not sent to ${toMobile}`);
        return { success: false, error: "WhatsApp API not configured" };
      }

      const cleanMobile = cleanPhoneNumber(toMobile);

      // Detect if it's an image by extension
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) || /\.(jpg|jpeg|png)$/i.test(filename);

      const url = `https://graph.facebook.com/v20.0/${settings.phoneNumberId}/messages`;
      const messageBody = isImage
        ? {
          messaging_product: "whatsapp",
          to: cleanMobile,
          type: "image",
          image: { link: fileUrl, caption: caption || "" },
        }
        : {
          messaging_product: "whatsapp",
          to: cleanMobile,
          type: "document",
          document: { link: fileUrl, filename, caption: caption || "" },
        };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.accessToken}`,
          },
          body: JSON.stringify(messageBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json() as any;

      if (!response.ok) {
        const errMsg = data?.error?.message || data?.error || JSON.stringify(data);
        throw new Error(`Meta API returned status ${response.status}: ${errMsg}`);
      }

      if (data?.messages?.[0]?.id) {
        console.log(`[WHATSAPP] ${isImage ? "Image" : "Document"} sent to ${cleanMobile}, msg_id: ${data.messages[0].id}`);
        return { success: true };
      }

      throw new Error(data?.error?.message || "Unexpected response from Meta API");
    } catch (err: any) {
      console.error(`[WHATSAPP] Failed to send document to ${toMobile}:`, err.message);
      return { success: false, error: err.message };
    }
  }, 1);
}

/** Send an immediate RSVP confirmation email */
export async function sendRsvpConfirmationEmail(
  toEmail: string,
  participantName: string,
  sessionName: string,
  trackName: string,
  sessionDate: string,
  sessionTime: string
): Promise<boolean> {
  const subject = `Confirmation: RSVP for "${sessionName}" recorded`;
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#6F42C1,#F58220);padding:28px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">RSVP Confirmed!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Sankara Eye Foundation India · Events Portal</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello <strong>${participantName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
            Thank you for RSVP'ing. We have successfully registered your attendance preference for the following session:
          </p>
          <div style="background:#f9f6ff;border-left:4px solid #6F42C1;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
            <div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:6px;">${sessionName}</div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">
              <span style="background:#ede9fe;color:#6F42C1;padding:2px 8px;border-radius:20px;font-weight:600;font-size:11px;">${trackName}</span>
            </div>
            <div style="font-size:14px;color:#374151;margin-top:10px;">
              📅 ${sessionDate} &nbsp; 🕐 ${sessionTime}
            </div>
          </div>
          <p style="margin:0 0 12px;font-size:13px;color:#4b5563;">We will send you a reminder email and WhatsApp message before the session starts.</p>
          <p style="margin:0;font-size:13px;color:#9ca3af;">If you wish to change your RSVP status, you can log in to your participant agenda dashboard anytime.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Sankara Eye Foundation India · Vision 2020 Annual Conference</p>
          <p style="margin:4px 0 0;font-size:10px;color:#b2bbc8;font-style:italic;">This is an automated email. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const res = await sendEmail(toEmail, subject, html, false);
  return res.success;
}

/** Send an immediate RSVP confirmation via WhatsApp stub */
export async function sendRsvpConfirmationWhatsapp(
  toMobile: string,
  participantName: string,
  sessionName: string,
  trackName: string,
  sessionDate: string,
  sessionTime: string
): Promise<boolean> {
  const payload = {
    name: "rsvp_confirmation_1",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: participantName },
          { type: "text", text: sessionName },
          { type: "text", text: trackName },
          { type: "text", text: sessionDate },
          { type: "text", text: sessionTime }
        ]
      }
    ]
  };
  const res = await sendWhatsappMessage(toMobile, JSON.stringify(payload));
  if (!res.success) {
    console.warn(`[WHATSAPP] RSVP confirmation template send failed: ${res.error}. Falling back to plain text...`);
    const text = `Hello ${participantName}! 👋 Your "Wish to Attend" has been confirmed! 🌟\n\nWe have successfully added this session to your personalized schedule:\n• Session: ${sessionName} 📝\n• Location & Track: ${trackName} 📍\n• Date: ${sessionDate} 📅\n• Time: ${sessionTime} ⏰\n\nRemember to present your ID card badge at the entrance for quick scanner check-in. See you at the session! 🚀👁️`;
    const fallbackRes = await sendWhatsappMessage(toMobile, text);
    if (!fallbackRes.success) {
      console.error(`[WHATSAPP] RSVP fallback also failed: ${fallbackRes.error}`);
    }
    return fallbackRes.success;
  }
  return res.success;
}

/** Send welcoming/registration message via WhatsApp */
export async function sendRegistrationWelcomeWhatsapp(
  toMobile: string,
  participantName: string,
  registrationNumber: string
): Promise<boolean> {
  const payload = {
    name: "vision2020_event_details_2",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: participantName },
          { type: "text", text: registrationNumber }
        ]
      }
    ]
  };
  const res = await sendWhatsappMessage(toMobile, JSON.stringify(payload));
  if (!res.success) {
    console.warn(`[WHATSAPP] Welcome template send failed: ${res.error}. Falling back to plain text...`);
    const text = `Hello ${participantName}! 👋 Welcome to the Vision 2020 Annual Conference! 🌟\n\nWe are thrilled to have you join us. Here are your registration details:\n• Attendee Badge ID: ${registrationNumber} 🎟️\n• Event Dates: 10 - 12 July 2026 📅\n• Venue: Sankara Eye Hospital, Bangalore 📍\n\nPlease access your personal dashboard via the portal link below to view your scientific agenda, browse tracks, and confirm your schedule. We look forward to an inspiring event! 👁️✨\n\nPortal Link: https://events.sankaraeye.in`;
    const fallbackRes = await sendWhatsappMessage(toMobile, text);
    if (!fallbackRes.success) {
      console.error(`[WHATSAPP] Welcome fallback also failed: ${fallbackRes.error}`);
    }
    return fallbackRes.success;
  }
  return res.success;
}

/** Send food scanned notification via WhatsApp */
export async function sendFoodScannedWhatsapp(
  toMobile: string,
  participantName: string,
  mealType: string,
  timeStr: string,
  dateStr: string
): Promise<boolean> {
  try {
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const templateConfig = settings?.whatsappTemplate || "";
    const templates = getWhatsappTemplates(templateConfig);

    let foodText = templates.food || "";
    if (foodText) {
      foodText = foodText
        .replace(/{{1}}/g, participantName)
        .replace(/{{2}}/g, mealType)
        .replace(/{{3}}/g, timeStr)
        .replace(/{{4}}/g, dateStr);
      const res = await sendWhatsappMessage(toMobile, foodText);
      return res.success;
    }
  } catch (e) {
    // fallback
  }

  const payload = {
    name: "vision2020_food_scanned_1",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: participantName },
          { type: "text", text: mealType },
          { type: "text", text: timeStr },
          { type: "text", text: dateStr }
        ]
      }
    ]
  };
  const res = await sendWhatsappMessage(toMobile, JSON.stringify(payload));
  if (!res.success) {
    console.warn(`[WHATSAPP] Food scan template send failed: ${res.error}. Falling back to plain text...`);
    const text = `Hello ${participantName}, Have a good ${mealType}! Your food token was scanned at ${timeStr} on ${dateStr}.\nThanks.`;
    const fallbackRes = await sendWhatsappMessage(toMobile, text);
    if (!fallbackRes.success) {
      console.error(`[WHATSAPP] Food scan fallback also failed: ${fallbackRes.error}`);
    }
    return fallbackRes.success;
  }
  return res.success;
}

/** Send attendance scanned notification via WhatsApp */
export async function sendAttendanceScannedWhatsapp(
  toMobile: string,
  participantName: string,
  timeStr: string,
  dateStr: string
): Promise<boolean> {
  try {
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const templateConfig = settings?.whatsappTemplate || "";
    const templates = getWhatsappTemplates(templateConfig);

    let attText = templates.attendance || "";
    if (attText) {
      attText = attText
        .replace(/{{1}}/g, participantName)
        .replace(/{{2}}/g, "Vision 2020 Conference")
        .replace(/{{3}}/g, timeStr)
        .replace(/{{4}}/g, dateStr);
      const res = await sendWhatsappMessage(toMobile, attText);
      return res.success;
    }
  } catch (e) {
    // fallback
  }

  const payload = {
    name: "vision2020_attendance_scanned_1",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: participantName },
          { type: "text", text: timeStr },
          { type: "text", text: dateStr }
        ]
      }
    ]
  };
  const res = await sendWhatsappMessage(toMobile, JSON.stringify(payload));
  if (!res.success) {
    console.warn(`[WHATSAPP] Attendance scan template send failed: ${res.error}. Falling back to plain text...`);
    const text = `Hello ${participantName}, your attendance at the Vision 2020 Conference has been marked at ${timeStr} on ${dateStr}.`;
    const fallbackRes = await sendWhatsappMessage(toMobile, text);
    if (!fallbackRes.success) {
      console.error(`[WHATSAPP] Attendance scan fallback also failed: ${fallbackRes.error}`);
    }
    return fallbackRes.success;
  }
  return res.success;
}

/** Send file upload success notification via WhatsApp */
export async function sendUploadSuccessWhatsapp(
  toMobile: string,
  participantName: string,
  filename: string,
  role: string
): Promise<boolean> {
  const rules = role === "Poster"
    ? "- Format: JPG/JPEG images only\n- Size limit: 20MB max"
    : "- Format: PPTX presentation slides\n- Size limit: 15MB max";

  const text = `🎉 *Upload Successful!* 🎉\n\n` +
    `Hello ${participantName},\n\n` +
    `Your file *${filename}* for the role *${role}* has been successfully uploaded and saved in our system! ✅\n\n` +
    `*Guidelines & Rules:*\n` +
    `${rules}\n` +
    `- You can view, modify, or replace your upload anytime before the deadline.\n\n` +
    `*Access Your Profile:* \n` +
    `👉 Go to: https://events.sankaraeye.in/login\n` +
    `👉 Select: *Faculty Upload*\n\n` +
    `Thank you,\n` +
    `Vision 2020 Conference Team 👁️✨`;

  const res = await sendWhatsappMessage(toMobile, text);
  return res.success;
}

/** Send event delegate registration confirmation email */
export async function sendRegistrationConfirmationEmail(params: {
  toEmail: string;
  participantName: string;
  registrationNumber: string;
  eventTitle: string;
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  timeFrom?: string | null;
  timeTo?: string | null;
  isPaid?: boolean;
  paymentAmount?: number;
  qrCodeDataUrl?: string;
  requiresApproval?: boolean;
}): Promise<boolean> {
  const {
    toEmail,
    participantName,
    registrationNumber,
    eventTitle,
    startDate,
    endDate,
    venue,
    city,
    timeFrom,
    timeTo,
    isPaid,
    paymentAmount,
    requiresApproval,
  } = params;

  const subject = requiresApproval
    ? `Registration Received: ${eventTitle} — ${registrationNumber}`
    : `Official Pass Confirmed: ${eventTitle} — ${registrationNumber}`;

  const timings = timeFrom && timeTo ? `${timeFrom} – ${timeTo}` : "09:00 AM – 05:00 PM";
  const dates = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
  const paymentText = isPaid
    ? (paymentAmount === 0 ? "Complimentary Pass (Waived)" : `Paid: ₹${paymentAmount?.toLocaleString("en-IN")}`)
    : "Free Admission Pass";

  const startIso = startDate.replace(/-/g, "");
  const endIso = (endDate || startDate).replace(/-/g, "");
  const titleEnc = encodeURIComponent(eventTitle);
  const detailsEnc = encodeURIComponent(`Pass ID: ${registrationNumber}\nDelegate: ${participantName}\nVenue: ${venue}, ${city}\nOrganized by Sankara Eye Foundation · Sankara Eye Hospital`);
  const locEnc = encodeURIComponent(`${venue}, ${city}`);
  
  const googleCalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleEnc}&dates=${startIso}T033000Z/${endIso}T123000Z&details=${detailsEnc}&location=${locEnc}`;
  const outlookCalLink = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${titleEnc}&startdt=${startDate}T09:00:00&enddt=${endDate || startDate}T18:00:00&body=${detailsEnc}&location=${locEnc}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#0f0f12;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#18181C;border-radius:24px;border:1px solid #2B2B33;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        
        <!-- Header Banner -->
        <tr>
          <td style="background:#131316;padding:32px 32px 24px;border-bottom:1px solid #24242A;text-align:center;">
            <div style="display:inline-block;padding:8px 16px;background:#24242C;border-radius:30px;border:1px solid #363640;margin-bottom:16px;">
              <span style="font-size:12px;font-weight:700;letter-spacing:1px;color:#ECECED;text-transform:uppercase;">Sankara Events</span>
            </div>
            <h1 style="color:#ffffff;margin:0 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${eventTitle}</h1>
            <p style="color:#A1A1AA;margin:0;font-size:13px;font-weight:500;">Sankara Eye Foundation India</p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#D4D4D8;line-height:1.5;">
              Dear <strong>${participantName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#A1A1AA;line-height:1.6;">
              ${requiresApproval 
                ? "Your registration request has been submitted and is currently under coordinator review. Once approved, your digital badge will be activated." 
                : "Thank you for registering! Your official delegate registration has been confirmed. Below are your event pass and venue details:"}
            </p>

            <!-- Pass Card Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#121215;border:1px solid #2B2B33;border-radius:16px;margin:0 0 24px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #222228;">
                  <span style="font-size:10px;font-weight:700;color:#71717A;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Registration Pass ID</span>
                  <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1px;font-family:monospace;">${registrationNumber}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom:12px;font-size:13px;color:#A1A1AA;width:35%;">📅 Dates:</td>
                      <td style="padding-bottom:12px;font-size:13px;font-weight:700;color:#FFFFFF;">${dates}</td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:12px;font-size:13px;color:#A1A1AA;">⏰ Timing:</td>
                      <td style="padding-bottom:12px;font-size:13px;font-weight:600;color:#E4E4E7;">${timings} IST</td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:12px;font-size:13px;color:#A1A1AA;">📍 Venue:</td>
                      <td style="padding-bottom:12px;font-size:13px;font-weight:600;color:#E4E4E7;">${venue}, ${city}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#A1A1AA;">💳 Admission:</td>
                      <td style="font-size:13px;font-weight:700;color:#10B981;">${paymentText}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- 1-Click Calendar Add Buttons -->
            <div style="text-align:center;padding:12px 0 24px;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px;">Add to your calendar:</p>
              <a href="${googleCalLink}" target="_blank" style="display:inline-block;padding:10px 18px;margin:0 4px 8px;background:#ffffff;color:#09090B;font-size:12px;font-weight:700;text-decoration:none;border-radius:10px;">
                📅 Add to Google Calendar
              </a>
              <a href="${outlookCalLink}" target="_blank" style="display:inline-block;padding:10px 18px;margin:0 4px 8px;background:#27272D;color:#ffffff;border:1px solid #3E3E48;font-size:12px;font-weight:700;text-decoration:none;border-radius:10px;">
                💼 Add to Outlook / Teams
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#71717A;line-height:1.5;">
              Please present your registration number or digital pass upon arrival at the venue registration counter for badge and delegate kit collection.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#121215;border-top:1px solid #222228;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#71717A;">Developed by Team IS - MHQ</p>
            <p style="margin:0;font-size:11px;color:#52525B;">© ${new Date().getFullYear()} Sankara Eye Foundation India</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await sendEmail(toEmail, subject, html, true);
  return res.success;
}

/** Send notification alert to Super Admins when an inquiry is escalated / unanswerable */
export async function sendUnresolvedQueryAdminAlertEmail(params: {
  ticketNumber: string;
  userIdentifier: string;
  userEmail: string;
  userPhone?: string | null;
  userMessage: string;
  adminDashboardUrl: string;
}): Promise<boolean> {
  const { ticketNumber, userIdentifier, userEmail, userPhone, userMessage, adminDashboardUrl } = params;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || "events@sankaraeye.com";
  const subject = `⚠️ [Drishti AI Escalation] New Inquiry Ticket #${ticketNumber} requires Super Admin response`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#09090B;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141417;border-radius:24px;border:1px solid #2B2B32;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="background:#18181C;padding:28px 32px;border-bottom:1px solid #27272D;">
            <div style="display:inline-block;padding:4px 12px;background:#EF444420;border-radius:20px;border:1px solid #EF444440;margin-bottom:10px;">
              <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#F87171;text-transform:uppercase;">AI Support Ticket</span>
            </div>
            <h1 style="color:#ffffff;margin:0 0 4px;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Unanswered Query Escalation</h1>
            <p style="color:#A1A1AA;margin:0;font-size:13px;font-weight:500;">Ticket ID: <span style="color:#F59E0B;font-family:monospace;font-weight:700;">#${ticketNumber}</span></p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:14px;color:#D4D4D8;line-height:1.6;">
              A delegate asked a question on the Sankara Events Portal that <strong>Drishti AI</strong> could not confidently resolve or that requested direct secretariat follow-up.
            </p>

            <!-- User Question Block -->
            <div style="background:#1F1F24;border-left:4px solid #F59E0B;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:0.5px;">Delegate Inquiry:</p>
              <p style="margin:0;font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.5;">"${userMessage}"</p>
            </div>

            <!-- Delegate Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F12;border:1px solid #27272D;border-radius:14px;padding:16px 20px;margin-bottom:28px;">
              <tr>
                <td style="padding-bottom:10px;font-size:13px;color:#A1A1AA;width:35%;">👤 Delegate:</td>
                <td style="padding-bottom:10px;font-size:13px;font-weight:600;color:#FFFFFF;">${userIdentifier || "Anonymous Delegate"}</td>
              </tr>
              <tr>
                <td style="padding-bottom:10px;font-size:13px;color:#A1A1AA;">📧 Email:</td>
                <td style="padding-bottom:10px;font-size:13px;font-weight:600;color:#60A5FA;">
                  <a href="mailto:${userEmail}" style="color:#60A5FA;text-decoration:none;">${userEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#A1A1AA;">📱 Phone:</td>
                <td style="font-size:13px;font-weight:600;color:#34D399;">${userPhone || "Not provided"}</td>
              </tr>
            </table>

            <!-- Action Button -->
            <div style="text-align:center;margin-bottom:16px;">
              <a href="${adminDashboardUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:#6366F1;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">
                ✍️ Reply & Train Drishti AI in Command Center
              </a>
            </div>
            <p style="margin:0;font-size:12px;color:#71717A;text-align:center;">
              Your reply will be emailed directly to the delegate and saved into the AI Knowledge Base for future automated answers.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#121215;border-top:1px solid #222228;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#71717A;">Sankara Events Intelligence System • Developed by Team IS - MHQ</p>
            <p style="margin:0;font-size:11px;color:#52525B;">© ${new Date().getFullYear()} Sankara Eye Foundation India</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await sendEmail(adminEmail, subject, html, false);
  return res.success;
}

/** Send verified Super Admin answer email to the asking delegate */
export async function sendResolvedQueryUserEmail(params: {
  ticketNumber: string;
  userIdentifier: string;
  userEmail: string;
  userQuestion: string;
  adminReply: string;
  resolvedByName: string;
}): Promise<boolean> {
  const { ticketNumber, userIdentifier, userEmail, userQuestion, adminReply, resolvedByName } = params;
  const subject = `Response to your Sankara Events inquiry [#${ticketNumber}]`;

  const formattedReply = adminReply
    .replace(/\n\n/g, "</p><p style='margin:0 0 12px;font-size:14px;color:#E4E4E7;line-height:1.6;'>")
    .replace(/\n/g, "<br/>");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#09090B;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141417;border-radius:24px;border:1px solid #2B2B32;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="background:#18181C;padding:28px 32px;border-bottom:1px solid #27272D;">
            <div style="display:inline-block;padding:4px 12px;background:#10B98120;border-radius:20px;border:1px solid #10B98140;margin-bottom:10px;">
              <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#34D399;text-transform:uppercase;">Inquiry Resolved</span>
            </div>
            <h1 style="color:#ffffff;margin:0 0 4px;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Response from Event Secretariat</h1>
            <p style="color:#A1A1AA;margin:0;font-size:13px;font-weight:500;">Sankara Eye Foundation India • Ticket <span style="color:#60A5FA;font-family:monospace;font-weight:700;">#${ticketNumber}</span></p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 12px;font-size:15px;color:#E4E4E7;">
              Hello <strong>${userIdentifier || "Delegate"}</strong>,
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#A1A1AA;line-height:1.6;">
              Thank you for reaching out to Sankara Eye Foundation India. Our Event Operations & Secretariat Team has reviewed your inquiry and prepared this official response:
            </p>

            <!-- Question Recall -->
            <div style="background:#1F1F24;border-left:4px solid #6366F1;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#818CF8;text-transform:uppercase;">Your Question:</p>
              <p style="margin:0;font-size:14px;color:#D4D4D8;font-style:italic;">"${userQuestion}"</p>
            </div>

            <!-- Official Reply Block -->
            <div style="background:#0F172A;border:1px solid #1E293B;border-radius:16px;padding:24px;margin-bottom:28px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:800;color:#38BDF8;text-transform:uppercase;letter-spacing:1px;">Official Response:</p>
              <p style="margin:0 0 12px;font-size:14px;color:#E4E4E7;line-height:1.6;">
                ${formattedReply}
              </p>
              <div style="margin-top:16px;padding-top:14px;border-top:1px solid #334155;font-size:12px;color:#94A3B8;">
                Verified by: <strong style="color:#F8FAFC;">${resolvedByName}</strong> • Sankara Eye Foundation India Secretariat
              </div>
            </div>

            <!-- Helpful Links -->
            <div style="text-align:center;padding:12px 0 16px;">
              <a href="https://sankaraeye.com" target="_blank" style="display:inline-block;padding:10px 20px;margin:0 4px 8px;background:#27272D;color:#ffffff;border:1px solid #3E3E48;font-size:12px;font-weight:700;text-decoration:none;border-radius:10px;">
                🌐 Visit Sankara Eye Foundation
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#71717A;text-align:center;">
              If you have any further questions, feel free to reply directly to this email or speak with our team at <strong style="color:#E4E4E7;">events@sankaraeye.com</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#121215;border-top:1px solid #222228;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#71717A;">Developed by Team IS - MHQ</p>
            <p style="margin:0;font-size:11px;color:#52525B;">© ${new Date().getFullYear()} Sankara Eye Foundation India</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await sendEmail(userEmail, subject, html, false);
  return res.success;
}

/** Send instant confirmation receipt email to the delegate when they raise a ticket */
export async function sendUnresolvedQueryUserConfirmationEmail(params: {
  ticketNumber: string;
  userIdentifier: string;
  userEmail: string;
  userPhone?: string | null;
  userMessage: string;
}): Promise<boolean> {
  const { ticketNumber, userIdentifier, userEmail, userMessage } = params;
  const subject = `🎫 [Ticket #${ticketNumber}] Inquiry Received — Sankara Event Secretariat`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#09090B;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141417;border-radius:24px;border:1px solid #2B2B32;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="background:#18181C;padding:28px 32px;border-bottom:1px solid #27272D;">
            <div style="display:inline-block;padding:4px 12px;background:#3B82F620;border-radius:20px;border:1px solid #3B82F640;margin-bottom:10px;">
              <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#60A5FA;text-transform:uppercase;">Inquiry Ticket Logged</span>
            </div>
            <h1 style="color:#ffffff;margin:0 0 4px;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Sankara Event Secretariat</h1>
            <p style="color:#A1A1AA;margin:0;font-size:13px;font-weight:500;">Ticket ID: <span style="color:#F59E0B;font-family:monospace;font-weight:700;">#${ticketNumber}</span></p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 12px;font-size:15px;color:#E4E4E7;">
              Namaste <strong>${userIdentifier || "Delegate"}</strong>,
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#A1A1AA;line-height:1.6;">
              We have received your inquiry regarding our medical conferences and events. Our **Event Operations & Secretariat Team** has been notified and is reviewing your question.
            </p>

            <!-- Question Recall -->
            <div style="background:#1F1F24;border-left:4px solid #F59E0B;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:0.5px;">Your Submitted Question:</p>
              <p style="margin:0;font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.5;">"${userMessage}"</p>
            </div>

            <p style="margin:0 0 20px;font-size:14px;color:#D4D4D8;line-height:1.6;">
              Our Event Secretariat will review your inquiry and revert back directly to your email address from <strong>events@sankaraeye.com</strong>.
            </p>

            <!-- Secretariat Contact Card -->
            <div style="background:#0F172A;border:1px solid #1E293B;border-radius:16px;padding:20px;margin-bottom:24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#38BDF8;text-transform:uppercase;letter-spacing:1px;">Event Secretariat Desk</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#FFFFFF;">
                <a href="mailto:events@sankaraeye.com" style="color:#38BDF8;text-decoration:none;">events@sankaraeye.com</a>
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#121215;border-top:1px solid #222228;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#71717A;">Developed by Team IS - MHQ</p>
            <p style="margin:0;font-size:11px;color:#52525B;">© ${new Date().getFullYear()} Sankara Eye Foundation India</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await sendEmail(userEmail, subject, html, false);
  return res.success;
}


