import { Router } from "express";
import { eq, or, ilike, like, and, sql } from "drizzle-orm";
import { db, participantsTable, assignmentsTable, submissionSettingsTable, activityLogsTable, activeSessionsTable } from "@workspace/db";
import { signToken, signLongLivedToken } from "../lib/auth";
import { sendOtpEmail, sendOtpWhatsapp } from "../lib/mailer";
import { parseDevice } from "../lib/parseDevice";
import {
  LookupParticipantSubmissionsQueryParams,
  SendSubmissionOTPBody,
  VerifySubmissionOTPBody
} from "@workspace/api-zod";

const router = Router();

const SUBMISSION_DEADLINE = new Date("2026-07-07T23:59:59+05:30").getTime(); // July 7, 2026 EOD IST

function maskEmail(email?: string | null): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local.slice(0, 1)}*@${domain}`;
  }
  return `${local[0]}${"*".repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
}

function maskMobile(mobile?: string | null): string {
  if (!mobile) return "";
  const clean = mobile.trim();
  if (clean.length <= 4) {
    return clean;
  }
  return `${clean.slice(0, 2)}${"*".repeat(clean.length - 5)}${clean.slice(-3)}`;
}

// GET /submissions/status
router.get("/submissions/status", async (_req, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const submissionsOpen = settings?.submissionsOpen ?? true;
    const isPastDeadline = false; // Bypassed deadline per user request

    res.json({
      open: submissionsOpen,
      submissionsOpen,
      isPastDeadline,
      deadlineStr: "TBD"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load submission status" });
  }
});

// GET /submissions/lookup
router.get("/submissions/lookup", async (req, res): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : undefined;
  const mobile = typeof req.query.mobile === "string" ? req.query.mobile.trim() : undefined;
  const email = typeof req.query.email === "string" ? req.query.email.trim() : undefined;
  const identifier = typeof req.query.identifier === "string" ? req.query.identifier.trim() : undefined;

  if (!name && !mobile && !email && !identifier) {
    res.status(400).json({ error: "Query parameter 'name', 'mobile', 'email', or 'identifier' is required" });
    return;
  }

  try {
    let matches: any[] = [];
    if (identifier) {
      const cleanIdent = identifier.trim().toLowerCase();
      const numericOnly = identifier.replace(/\D/g, "");
      const mobileSearch = numericOnly.length >= 10 ? numericOnly.slice(-10) : identifier;

      matches = await db
        .select()
        .from(participantsTable)
        .where(
          or(
            eq(sql`LOWER(${participantsTable.email})`, cleanIdent),
            eq(sql`UPPER(${participantsTable.registrationNumber})`, identifier.toUpperCase()),
            eq(sql`REGEXP_REPLACE(${participantsTable.mobile}, '\D', '', 'g')`, mobileSearch),
            eq(participantsTable.mobile, identifier)
          )
        );
    } else if (email) {
      matches = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.email, email.toLowerCase()));
    } else if (mobile) {
      const cleanMobile = mobile.replace(/[^0-9]/g, "");
      const tenDigits = cleanMobile.slice(-10);
      if (tenDigits.length < 10) {
        res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
        return;
      }
      matches = await db
        .select()
        .from(participantsTable)
        .where(like(participantsTable.mobile, `%${tenDigits}`));
    } else if (name) {
      matches = await db
        .select()
        .from(participantsTable)
        .where(ilike(participantsTable.name, `%${name}%`));
    }

    const resultsWithNulls = await Promise.all(
      matches.map(async (p) => {
        const assignments = await db
          .select()
          .from(assignmentsTable)
          .where(eq(assignmentsTable.participantId, p.id));

        if (assignments.length === 0) {
          return null; // Standard attendee, no submission needed
        }

        const roles = Array.from(new Set(assignments.map((a) => a.role)));
        const needsPPT = assignments.some((a) => ["Speaker", "Presenter"].includes(a.role));
        const needsPoster = assignments.some((a) => a.role === "Poster");

        return {
          id: p.id,
          name: p.name,
          registrationNumber: p.registrationNumber,
          institution: p.institution,
          maskedEmail: maskEmail(p.email),
          maskedMobile: maskMobile(p.mobile),
          roles,
          needsPPT,
          needsPoster,
          hasPassword: !!p.passwordHash,
        };
      })
    );

    const results = resultsWithNulls.filter((r) => r !== null);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to search participants" });
  }
});

// POST /submissions/send-otp
router.post("/submissions/send-otp", async (req, res): Promise<void> => {
  const parsed = SendSubmissionOTPBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { participantId, sendTo, value } = parsed.data;

  try {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId));

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // Optional confirmation value matching
    if (value) {
      const cleanVal = value.trim().toLowerCase();
      if (sendTo === "email") {
        if (participant.isOnSpot && !participant.isOnSpotOnboarded) {
          await db
            .update(participantsTable)
            .set({ email: cleanVal })
            .where(eq(participantsTable.id, participantId));
          participant.email = cleanVal;
        } else if ((participant.email || "").trim().toLowerCase() !== cleanVal) {
          res.status(400).json({ error: "Provided email does not match our records." });
          return;
        }
      } else {
        const cleanMobile = cleanVal.replace(/[^0-9]/g, "");
        const cleanDBMobile = (participant.mobile || "").replace(/[^0-9]/g, "");
        if (!cleanDBMobile.endsWith(cleanMobile)) {
          res.status(400).json({ error: "Provided mobile number does not match our records." });
          return;
        }
      }
    }

    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const otpMode = settings?.otpMode || "static";
    const testOtpsString = settings?.testOtps || "111111,222222,333333";
    const testCodes = testOtpsString.split(",").map((c) => c.trim()).filter(Boolean);
    const displayCodes = testCodes.slice(0, 3).join(", ");

    if (otpMode === "static") {
      console.log(`[OTP-SERVICE] Static OTP mode for ${participant.name} (ID: ${participant.id}). Valid test codes: ${displayCodes}`);
      res.json({
        success: true,
        message: `OTP sent successfully to your registered ${sendTo}. (For testing, use code: ${displayCodes}).`
      });
      return;
    }

    // Dynamic OTP mode: generate and store in PostgreSQL
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiryDate = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    await db
      .update(participantsTable)
      .set({
        otpCode: generatedOTP,
        otpExpires: expiryDate,
      })
      .where(eq(participantsTable.id, participantId));

    console.log(`\n========================================\n[OTP-SERVICE] Generated OTP for ${participant.name}:\nCode: ${generatedOTP}\nExpires in: 10 minutes\n========================================\n`);

    // Send via email if sendTo=email and participant has email
    if (sendTo === "email") {
      if (!participant.email) {
        res.status(400).json({ error: "Participant does not have a registered email address." });
        return;
      }
      const mailResult = await sendOtpEmail(participant.email, participant.name, generatedOTP);
      if (!mailResult.success) {
        res.status(500).json({ error: `SMTP Error: ${mailResult.error || 'Failed to connect/authenticate with SMTP server'}` });
        return;
      }
      res.json({
        success: true,
        message: `A 6-digit OTP has been sent to ${maskEmail(participant.email)}.`
      });
      return;
    } else if (sendTo === "whatsapp") {
      if (!participant.mobile) {
        res.status(400).json({ error: "Participant does not have a registered mobile number." });
        return;
      }
      
      const waResult = await sendOtpWhatsapp(participant.mobile, generatedOTP);
      if (!waResult.success) {
        res.status(500).json({ error: `WhatsApp API Error: ${waResult.error || 'Failed to connect to Meta API'}` });
        return;
      }

      console.log(`[OTP-SERVICE] 🟢 WhatsApp OTP sent to ${participant.mobile}: ${generatedOTP}`);
      res.json({
        success: true,
        message: `A 6-digit OTP has been sent via WhatsApp to ${maskMobile(participant.mobile)}.`
      });
      return;
    } else if (sendTo === "sms") {
      if (!participant.mobile) {
        res.status(400).json({ error: "Participant does not have a registered mobile number." });
        return;
      }
      // Simulate SMS delivery
      console.log(`[OTP-SERVICE] 🟢 SMS OTP sent to ${participant.mobile}: ${generatedOTP}`);
      res.json({
        success: true,
        message: `A 6-digit OTP has been sent via SMS to ${maskMobile(participant.mobile)}.`
      });
      return;
    }

    res.json({
      success: true,
      message: `A 6-digit OTP has been generated.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process OTP request" });
  }
});

const DEFAULT_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes default

async function getSessionDurationMs(): Promise<number> {
  try {
    const [settings] = await db.select({ t: submissionSettingsTable.sessionTimeoutMinutes })
      .from(submissionSettingsTable).limit(1);
    return ((settings?.t ?? 30)) * 60 * 1000;
  } catch {
    return DEFAULT_SESSION_DURATION_MS;
  }
}

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function createSession(token: string, userId: number, userType: string, userName: string, req: any) {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];
  const { deviceType, deviceName } = parseDevice(ua);
  const now = new Date();
  const sessionDurationMs = await getSessionDurationMs();
  const expiresAt = new Date(now.getTime() + sessionDurationMs);
  try {
    await db.insert(activeSessionsTable).values({
      sessionToken: token,
      userId,
      userType,
      userName,
      ipAddress: ip,
      userAgent: ua ?? null,
      deviceType,
      deviceName,
      expiresAt,
    });
  } catch (err: any) {
    const errMsg = String(err.message || "") + " " + String(err.cause?.message || "") + " " + String(err.cause?.code || "");
    if (
      errMsg.toLowerCase().includes("unique constraint") ||
      errMsg.toLowerCase().includes("duplicate key") ||
      errMsg.includes("23505")
    ) {
      console.log("[createSession] Session token already active, skipping duplicate insert.");
    } else {
      throw err;
    }
  }
}

// POST /submissions/verify-otp
router.post("/submissions/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifySubmissionOTPBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { participantId, otp } = parsed.data;

  try {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId));

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const otpMode = settings?.otpMode || "static";
    const testOtpsString = settings?.testOtps || "111111,222222,333333";
    const testCodes = testOtpsString.split(",").map((c) => c.trim()).filter(Boolean);
    // Always include short (4-digit) variants of each test code
    const allTestCodes = [...testCodes, ...testCodes.map((c) => c.slice(0, 4))];

    const receivedOtp = otp.trim();
    console.log(`[OTP-VERIFY] participantId=${participantId} (${typeof participantId}), mode=${otpMode}, receivedOtp=${receivedOtp} (${typeof receivedOtp})`);
    console.log(`[OTP-VERIFY] DB Stored OTP:`, participant.otpCode, `Expires:`, participant.otpExpires);

    let verified = false;

    // 1. Check test codes bypass first (allows developers to bypass in static mode)
    if (otpMode === "static" && allTestCodes.includes(receivedOtp)) {
      console.log(`[OTP-VERIFY] Test code bypass matches: ${receivedOtp}`);
      verified = true;
    }
    // 2. Check standard DB OTP verification if not static mode
    else if (otpMode !== "static") {
      if (participant.otpCode && participant.otpExpires) {
        const isExpired = participant.otpExpires.getTime() <= Date.now();
        const matches = participant.otpCode === receivedOtp;
        console.log(`[OTP-VERIFY] Verification checks: isExpired=${isExpired}, matches=${matches}`);
        if (!isExpired && matches) {
          verified = true;
        }
      } else {
        console.log(`[OTP-VERIFY] No stored OTP found for participantId ${participantId}`);
      }
    }

    if (!verified) {
      res.status(400).json({ error: "Invalid or expired OTP. Please try again." });
      return;
    }

    // Successfully verified! Clear OTP and sign JWT
    await db
      .update(participantsTable)
      .set({
        otpCode: null,
        otpExpires: null,
      })
      .where(eq(participantsTable.id, participantId));

    const token = signToken({
      id: participant.id,
      userType: "participant",
      participantId: participant.id,
    });

    // Issue a long-lived trusted browser token (30 days)
    const trustedToken = signLongLivedToken({
      participantId: participant.id,
      trusted: true,
    });

    // Create session in database
    await createSession(token, participant.id, "participant", participant.name, req);

    await db.insert(activityLogsTable).values({
      type: "registration",
      message: `Participant secure submission login: ${participant.name} (${participant.registrationNumber})`,
    });

    res.json({
      token,
      trustedToken,
      user: {
        id: participant.id,
        name: participant.name,
        mobile: participant.mobile || "",
        userType: "participant",
        participantId: participant.id,
        assignedTrack: null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to verify OTP" });
  }
});

export default router;
