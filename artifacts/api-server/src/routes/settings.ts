import { Router } from "express";
import {
  db,
  submissionSettingsTable,
  activityLogsTable,
  participantsTable,
  rsvpTable,
  attendanceLogsTable,
  goodiesLogsTable,
  foodSessionsTable,
  foodLogsTable,
  uploadedFilesTable,
  assignmentsTable,
  activeSessionsTable,
  syncSessionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { invalidateSessionTimeoutCache } from "../middlewares/requireAuth";
import { UpdateSubmissionSettingsBody } from "@workspace/api-zod";
import { eq, ne } from "drizzle-orm";
import multer from "multer";
import * as xlsx from "xlsx";
import {
  sendEmail,
  sendOtpWhatsapp,
  sendRegistrationWelcomeWhatsapp,
  sendRsvpConfirmationWhatsapp,
  sendFoodScannedWhatsapp,
  sendAttendanceScannedWhatsapp,
  invalidateWhatsappSettingsCache,
  cleanPhoneNumber,
} from "../lib/mailer";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { getGoogleAuthClient, getSpreadsheetSheets } from "../lib/googleSheets";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /settings/public (no authentication required)
router.get("/settings/public", async (_req, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    res.json({
      submissionsOpen: settings?.submissionsOpen ?? true,
      conferenceMapUrl: settings?.conferenceMapUrl || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load public settings" });
  }
});

// GET /routemap.pdf — public, no auth, serves the uploaded route map PDF
// URL: https://events.sankaraeye.in/api/routemap.pdf
// nginx proxies /api/* to Node so this always works without nginx changes
router.get("/routemap.pdf", (_req, res): void => {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const routeMapPath = path.join(uploadsDir, "routemap.pdf");
  if (!fs.existsSync(routeMapPath)) {
    res.status(404).send("Route map not yet uploaded.");
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"routemap.pdf\"");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(routeMapPath);
});

// GET /settings/submissions
router.get("/settings/submissions", requireAuth(), async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(submissionSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(submissionSettingsTable).values({
      submissionsOpen: true,
      otpMode: "static",
      testOtps: "111111,222222,333333",
    }).returning();
  }
  const [activeSession] = await db
    .select()
    .from(syncSessionsTable)
    .where(eq(syncSessionsTable.isActive, true))
    .limit(1);

  res.json({
    submissionsOpen: settings.submissionsOpen,
    otpMode: settings.otpMode,
    testOtps: settings.testOtps,
    whatsappApiKey: settings.whatsappApiKey,
    whatsappInstanceId: settings.whatsappInstanceId,
    whatsappTemplate: settings.whatsappTemplate,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpPass: settings.smtpPass,
    smtpFromEmail: settings.smtpFromEmail,
    smtpFromName: settings.smtpFromName,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    googleSheetUrl: settings.googleSheetUrl,
    conferenceMapUrl: settings.conferenceMapUrl || null,
    liveTvUrl: settings.liveTvUrl || null,
    activeSession: activeSession || null,
    updatedAt: settings.updatedAt.toISOString(),
  });
});

// PATCH /settings/submissions
router.patch("/settings/submissions", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  const parsed = UpdateSubmissionSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let [settings] = await db.select().from(submissionSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(submissionSettingsTable).values({
      submissionsOpen: parsed.data.submissionsOpen,
      otpMode: parsed.data.otpMode,
      testOtps: parsed.data.testOtps,
      whatsappApiKey: parsed.data.whatsappApiKey || null,
      whatsappInstanceId: parsed.data.whatsappInstanceId || null,
      whatsappTemplate: parsed.data.whatsappTemplate || null,
      smtpHost: parsed.data.smtpHost || null,
      smtpPort: parsed.data.smtpPort || null,
      smtpSecure: parsed.data.smtpSecure ?? false,
      smtpUser: parsed.data.smtpUser || null,
      smtpPass: parsed.data.smtpPass || null,
      smtpFromEmail: parsed.data.smtpFromEmail || null,
      smtpFromName: parsed.data.smtpFromName || null,
      sessionTimeoutMinutes: parsed.data.sessionTimeoutMinutes ?? 30,
      googleSheetUrl: parsed.data.googleSheetUrl || null,
      conferenceMapUrl: (parsed.data as any).conferenceMapUrl || null,
      liveTvUrl: (parsed.data as any).liveTvUrl || null,
    }).returning();
  } else {
    [settings] = await db
      .update(submissionSettingsTable)
      .set({
        submissionsOpen: parsed.data.submissionsOpen,
        otpMode: parsed.data.otpMode,
        testOtps: parsed.data.testOtps,
        whatsappApiKey: parsed.data.whatsappApiKey?.trim() || null,
        whatsappInstanceId: parsed.data.whatsappInstanceId?.trim() || null,
        whatsappTemplate: parsed.data.whatsappTemplate || null,
        smtpHost: parsed.data.smtpHost || null,
        smtpPort: parsed.data.smtpPort || null,
        smtpUser: parsed.data.smtpUser || null,
        smtpPass: parsed.data.smtpPass || null,
        smtpFromEmail: parsed.data.smtpFromEmail || null,
        smtpFromName: parsed.data.smtpFromName || null,
        googleSheetUrl: parsed.data.googleSheetUrl || null,
        conferenceMapUrl: (parsed.data as any).conferenceMapUrl || null,
        liveTvUrl: (parsed.data as any).liveTvUrl || null,
        ...(parsed.data.smtpSecure !== undefined ? { smtpSecure: parsed.data.smtpSecure } : {}),
        ...(parsed.data.sessionTimeoutMinutes !== undefined ? { sessionTimeoutMinutes: parsed.data.sessionTimeoutMinutes } : {}),
      })
      .where(eq(submissionSettingsTable.id, settings.id))
      .returning();
  }

  await db.insert(activityLogsTable).values({
    type: "submission_status",
    message: `Submissions settings updated by admin`,
  });

  // Invalidate the session timeout cache so new requests pick up the updated value
  invalidateSessionTimeoutCache();
  invalidateWhatsappSettingsCache();

  const [activeSession] = await db
    .select()
    .from(syncSessionsTable)
    .where(eq(syncSessionsTable.isActive, true))
    .limit(1);

  res.json({
    submissionsOpen: settings.submissionsOpen,
    otpMode: settings.otpMode,
    testOtps: settings.testOtps,
    whatsappApiKey: settings.whatsappApiKey,
    whatsappInstanceId: settings.whatsappInstanceId,
    whatsappTemplate: settings.whatsappTemplate,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpPass: settings.smtpPass,
    smtpFromEmail: settings.smtpFromEmail,
    smtpFromName: settings.smtpFromName,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    googleSheetUrl: settings.googleSheetUrl,
    conferenceMapUrl: settings.conferenceMapUrl || null,
    activeSession: activeSession || null,
    updatedAt: settings.updatedAt.toISOString(),
  });
});

router.post("/settings/test-email", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  const { email, message } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  
  try {
    const customMessageHtml = message 
      ? `<div style="margin-top:20px;padding:15px;background:#f9fafb;border-left:4px solid #6F42C1;border-radius:4px;color:#374151;">
           <strong>Custom Message:</strong><br/>
           ${message.replace(/\n/g, '<br/>')}
         </div>`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);max-width:500px;margin:auto;border:1px solid #e5e7eb;">
        <h2 style="color:#F58220;margin-top:0;font-size:18px;border-bottom:2px solid #F58220;padding-bottom:8px;">SMTP Connection Test</h2>
        <p style="font-size:14px;color:#4b5563;">Your SMTP credentials are configured correctly and working!</p>
        ${customMessageHtml}
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0 16px;"/>
        <p style="font-size:11px;color:#9ca3af;margin:0;">Sankara Eye Hospitals · Vision 2020 Annual Conference</p>
        <p style="font-size:10px;color:#b2bbc8;font-style:italic;margin:4px 0 0;">This is an automated email. Please do not reply to this email.</p>
      </div>
    `;

    const result = await sendEmail(
      email,
      "SMTP Test - Vision 2020 Conference",
      html
    );
    
    if (result.success) {
      res.json({ success: true, message: "Test email sent successfully." });
    } else {
      res.status(500).json({ error: `SMTP Error: ${result.error || 'Check server logs'}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

router.post("/settings/test-whatsapp", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  const { mobile, templateType } = req.body as { mobile?: string; templateType?: string };
  if (!mobile || !templateType) {
    res.status(400).json({ error: "mobile and templateType are required" });
    return;
  }

  const cleanMobile = cleanPhoneNumber(mobile);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;

  let success = false;
  let error: string | undefined;

  try {
    if (templateType === "otp") {
      const otpRes = await sendOtpWhatsapp(cleanMobile, "123456");
      success = otpRes.success;
      error = otpRes.error;
    } else if (templateType === "welcome") {
      success = await sendRegistrationWelcomeWhatsapp(cleanMobile, "Test Participant", "SEH-V2020-TEST");
    } else if (templateType === "rsvp") {
      success = await sendRsvpConfirmationWhatsapp(
        cleanMobile,
        "Test Participant",
        "AI Advancements in Ophthalmology",
        "Track 1",
        dateStr,
        timeStr
      );
    } else if (templateType === "food") {
      success = await sendFoodScannedWhatsapp(cleanMobile, "Test Participant", "Lunch", timeStr, dateStr);
    } else if (templateType === "attendance") {
      success = await sendAttendanceScannedWhatsapp(cleanMobile, "Test Participant", timeStr, dateStr);
    } else {
      res.status(400).json({ error: "Invalid templateType" });
      return;
    }

    if (success) {
      res.json({ success: true, message: `Test ${templateType} message sent successfully to ${cleanMobile}` });
    } else {
      res.status(500).json({ error: error || `Failed to send test ${templateType} message` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
});

// POST /settings/submissions/sync-mobile-file
router.post(
  "/settings/submissions/sync-mobile-file",
  requireAuth(["admin"]),
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

      let syncedCount = 0;
      const errors: string[] = [];

      // Flexible column headers matching keys
      const regColKeys = ["registration number", "registrationnumber", "reg no", "reg. no.", "regno", "sr. no", "sr.no", "poster / paper no"];
      const mobileColKeys = ["mobile number", "mobilenumber", "mobile", "mobile no", "phone", "phone number", "mobile_number"];
      const emailColKeys = ["email", "email address", "emailaddress", "mail", "mail id", "email_address"];
      const nameColKeys = ["name", "full name", "fullname", "participant name", "participant"];

      for (const row of rows) {
        // Lowercase keys to match columns flexibly
        const rowKeys = Object.keys(row);
        const lowerKeysMap = new Map<string, string>();
        for (const k of rowKeys) {
          lowerKeysMap.set(k.toLowerCase().trim(), k);
        }

        // Helper to retrieve value
        const getVal = (aliases: string[]) => {
          for (const alias of aliases) {
            const originalKey = lowerKeysMap.get(alias);
            if (originalKey !== undefined) {
              return String(row[originalKey] || "").trim();
            }
          }
          return "";
        };

        const regNum = getVal(regColKeys);
        const mobile = getVal(mobileColKeys);
        const email = getVal(emailColKeys);
        const name = getVal(nameColKeys);

        if (!regNum && !name) continue;

        let participant;
        if (regNum) {
          // Sync by registration number
          [participant] = await db
            .select()
            .from(participantsTable)
            .where(eq(participantsTable.registrationNumber, regNum));
        }

        if (!participant && name) {
          // Sync by name lookup as fallback
          const matches = await db
            .select()
            .from(participantsTable)
            .where(eq(participantsTable.name, name));
          if (matches.length === 1) {
            participant = matches[0];
          } else if (matches.length > 1) {
            errors.push(`Multiple participants matched name "${name}"`);
            continue;
          }
        }

        if (participant) {
          const updates: Record<string, any> = {};
          if (mobile) updates.mobile = mobile;
          if (email) updates.email = email;

          if (Object.keys(updates).length > 0) {
            await db
              .update(participantsTable)
              .set(updates)
              .where(eq(participantsTable.id, participant.id));
            syncedCount++;
          }
        }
      }

      await db.insert(activityLogsTable).values({
        type: "registration",
        message: `Synced ${syncedCount} participant contact details via Excel/CSV import`,
      });

      res.json({
        success: true,
        syncedCount,
        message: `Synced ${syncedCount} mobile numbers and emails successfully. Errors encountered: ${errors.length}`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process file sync" });
    }
  }
);

// Helper to find the root directory containing pnpm-workspace.yaml
function findWorkspaceRoot(): string {
  let startDir = process.cwd();
  try {
    if (typeof __dirname !== "undefined") {
      startDir = __dirname;
    }
  } catch (e) {
    // ignore
  }
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

const uploadsDir = path.resolve(findWorkspaceRoot(), "artifacts/api-server/uploads");

function purgePhysicalUploads() {
  if (fs.existsSync(uploadsDir)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file === ".gitkeep") continue;
        const fullPath = path.join(uploadsDir, file);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch (err: any) {
          console.error(`[PURGE] Failed to delete file/dir ${fullPath}:`, err.message);
        }
      }
      console.log("[PURGE] Physical uploads directory cleared.");
    } catch (err: any) {
      console.error("[PURGE] Error reading uploads directory:", err.message);
    }
  }
}

// DELETE /settings/purge-all-data (Super Admin only)
router.delete("/settings/purge-all-data", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  try {
    console.log(`[PURGE] Super Admin (ID: ${req.user?.id}) initiated full data purge.`);

    // 1. Clear physical uploads from disk
    purgePhysicalUploads();

    // 2. Truncate tables in dependency order
    await db.delete(rsvpTable);
    await db.delete(attendanceLogsTable);
    await db.delete(goodiesLogsTable);
    await db.delete(foodLogsTable);
    await db.delete(foodSessionsTable);
    await db.delete(uploadedFilesTable);
    await db.delete(assignmentsTable);
    await db.delete(participantsTable);

    // 3. Clear sessions except the current caller
    const authHeader = req.headers.authorization;
    let currentToken = "";
    if (authHeader?.startsWith("Bearer ")) {
      currentToken = authHeader.slice(7);
    } else if (typeof req.query.token === "string") {
      currentToken = req.query.token;
    }

    if (currentToken) {
      await db.delete(activeSessionsTable).where(ne(activeSessionsTable.sessionToken, currentToken));
    } else {
      await db.delete(activeSessionsTable);
    }

    // 4. Clear activity logs and log the purge event
    await db.delete(activityLogsTable);
    await db.insert(activityLogsTable).values({
      type: "system",
      message: `All database and physical file data purged by super admin (ID: ${req.user?.id})`,
    });

    res.json({ success: true, message: "All conference data has been permanently purged." });
  } catch (err: any) {
    console.error("[PURGE] Failed to purge all data:", err);
    res.status(500).json({ error: err.message || "Failed to purge all data" });
  }
});

// GET /settings/google-credentials - Fetch current credentials configuration status (Super Admin only)
router.get("/settings/google-credentials", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  try {
    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(submissionSettingsTable).values({
        submissionsOpen: true,
        otpMode: "static",
        testOtps: "111111,222222,333333",
      }).returning();
    }

    res.json({
      configured: !!(settings.googleServiceAccountEmail && settings.googleServiceAccountKey),
      email: settings.googleServiceAccountEmail || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch Google credentials" });
  }
});

// PATCH /settings/google-credentials - Update Google Service Account credentials (Super Admin only)
router.patch("/settings/google-credentials", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  const { email, privateKey } = req.body;
  if (!email || !privateKey) {
    res.status(400).json({ error: "Service Account Email and Private Key are required." });
    return;
  }

  try {
    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(submissionSettingsTable).values({
        submissionsOpen: true,
        otpMode: "static",
        testOtps: "111111,222222,333333",
        googleServiceAccountEmail: email,
        googleServiceAccountKey: privateKey,
      }).returning();
    } else {
      [settings] = await db
        .update(submissionSettingsTable)
        .set({
          googleServiceAccountEmail: email,
          googleServiceAccountKey: privateKey,
        })
        .where(eq(submissionSettingsTable.id, settings.id))
        .returning();
    }

    res.json({
      success: true,
      configured: true,
      email: settings.googleServiceAccountEmail,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update Google credentials" });
  }
});

// POST /settings/google-credentials/test - Test Google Service Account connection (Super Admin only)
router.post("/settings/google-credentials/test", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  try {
    const auth = await getGoogleAuthClient();
    if (!auth) {
      res.status(400).json({ error: "Google Service Account credentials are not configured." });
      return;
    }

    // Try to authorize
    await auth.authorize();

    // If active session exists, test spreadsheet access as well
    const [activeSession] = await db
      .select()
      .from(syncSessionsTable)
      .where(eq(syncSessionsTable.isActive, true))
      .limit(1);

    let details = "Authorized successfully.";
    if (activeSession && activeSession.googleSheetId) {
      try {
        const sheetsList = await getSpreadsheetSheets(activeSession.googleSheetId);
        details += ` Successfully accessed active sheet (ID: ${activeSession.googleSheetId}). Found ${sheetsList.length} tab(s): ${sheetsList.join(", ")}.`;
      } catch (sheetErr: any) {
        details += ` Authorized OK, but failed to access the active sheet ID: ${sheetErr.message}. Ensure the sheet is shared with the service account email.`;
      }
    } else {
      details += " No active sync session config to test spreadsheet access.";
    }

    res.json({ success: true, details });
  } catch (err: any) {
    res.status(500).json({ error: `Authorization failed: ${err.message}` });
  }
});

// POST /settings/google-credentials/fetch-sheets - Fetch spreadsheets and tab names using given (or saved) credentials
router.post(
  "/settings/google-credentials/fetch-sheets",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    try {
      let email = req.body.email;
      let privateKey = req.body.privateKey;

      if (!email || !privateKey) {
        // Fallback to saved settings
        const [settings] = await db.select().from(submissionSettingsTable).limit(1);
        if (settings && settings.googleServiceAccountEmail && settings.googleServiceAccountKey) {
          email = settings.googleServiceAccountEmail;
          privateKey = settings.googleServiceAccountKey;
        }
      }

      if (!email || !privateKey) {
        res.status(400).json({ error: "Google Service Account credentials are not configured or provided." });
        return;
      }

      const formattedKey = privateKey.trim().replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email: email.trim(),
        key: formattedKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
      });

      // Try to authorize first
      await auth.authorize();

      const drive = google.drive({ version: "v3", auth });
      const sheetsListResp = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.spreadsheet'",
        fields: "files(id, name)",
        pageSize: 100,
      });

      const files = sheetsListResp.data.files || [];
      const sheets = google.sheets({ version: "v4", auth });

      const results = [];
      for (const file of files) {
        if (file.id && file.name) {
          try {
            const sheetMeta = await sheets.spreadsheets.get({
              spreadsheetId: file.id,
            });
            const tabs = (sheetMeta.data.sheets || [])
              .map(s => s.properties?.title || "")
              .filter(Boolean);
            results.push({
              id: file.id,
              name: file.name,
              tabs,
            });
          } catch (e: any) {
            // Ignore access errors for individual files
            console.warn(`[Fetch Sheets] Skip file ID ${file.id}: ${e.message}`);
          }
        }
      }

      res.json({ spreadsheets: results });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch sheets from Google Drive" });
    }
  }
);

// POST /settings/upload-map (Super Admins only)
// Always saves as "routemap.pdf" so it's accessible at the public URL:
// https://events.sankaraeye.com/routemap.pdf
router.post(
  "/settings/upload-map",
  requireAuth(["super_admin"]),
  upload.single("mapFile"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (req.file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Only PDF files are allowed for the route map" });
      return;
    }

    try {
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Always save as fixed filename so the public URL never changes
      const filename = "routemap.pdf";
      const filePath = path.join(uploadsDir, filename);

      // Save file (overwrites previous version)
      fs.writeFileSync(filePath, req.file.buffer);

      // Fixed public URL — accessible without authentication
      const mapUrl = `/routemap.pdf`;

      // Persist URL in settings
      let [settings] = await db.select().from(submissionSettingsTable).limit(1);
      if (!settings) {
        await db.insert(submissionSettingsTable).values({
          submissionsOpen: true,
          conferenceMapUrl: mapUrl,
        });
      } else {
        await db.update(submissionSettingsTable)
          .set({ conferenceMapUrl: mapUrl })
          .where(eq(submissionSettingsTable.id, settings.id));
      }

      // Log activity
      await db.insert(activityLogsTable).values({
        type: "settings",
        message: "Route map PDF updated by super admin",
      });

      res.json({ success: true, url: mapUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save route map file" });
    }
  }
);

export default router;
