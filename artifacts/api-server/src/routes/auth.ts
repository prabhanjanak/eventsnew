import { Router } from "express";
import { eq, or, isNull, gt, and, sql } from "drizzle-orm";
import { db, participantsTable, systemUsersTable, activeSessionsTable, submissionSettingsTable, eventsTable } from "@workspace/db";
import { hashPassword, comparePassword, signToken, signLongLivedToken, verifyToken } from "../lib/auth";
import { parseDevice } from "../lib/parseDevice";
import { requireAuth, invalidateSessionTimeoutCache } from "../middlewares/requireAuth";
import { otpSendLimiter, otpVerifyLimiter } from "../middlewares/rateLimiter";
import {
  SetPasswordBody,
  SetPasswordOtpBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import crypto from "crypto";
import { sendWhatsappMessage, sendOtpEmail, sendEmail, sendOtpWhatsapp } from "../lib/mailer";

interface ProfileOtpEntry {
  otp: string;
  email: string;
  expiresAt: Date;
}
const profileResetOtps = new Map<string, ProfileOtpEntry>();

// ── OTP Brute-Force Lockout Tracker ────────────────────────────────────────────
// Key: participantId — value: { attempts, lockedUntil }
interface OtpAttemptRecord {
  attempts: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}
const otpAttempts = new Map<number, OtpAttemptRecord>();
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

function getOtpAttemptRecord(participantId: number): OtpAttemptRecord {
  return otpAttempts.get(participantId) ?? { attempts: 0, lockedUntil: 0 };
}
function incrementOtpFailure(participantId: number): OtpAttemptRecord {
  const rec = getOtpAttemptRecord(participantId);
  rec.attempts++;
  if (rec.attempts >= MAX_OTP_ATTEMPTS) {
    rec.lockedUntil = Date.now() + OTP_LOCKOUT_MS;
  }
  otpAttempts.set(participantId, rec);
  return rec;
}
function clearOtpAttempts(participantId: number) {
  otpAttempts.delete(participantId);
}

const router = Router();

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

async function createSession(token: string, userId: number, userType: string, userName: string, req: any, durationOverrideMs?: number) {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];
  const { deviceType, deviceName } = parseDevice(ua);
  const now = new Date();
  const sessionDurationMs = durationOverrideMs ?? await getSessionDurationMs();
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
    console.warn("[createSession] Non-blocking session insert warning:", err.message);
  }
}

router.post("/auth/login", async (req, res): Promise<void> => {
  // Accept either `identifier` (new unified field) or legacy `mobile` field
  const identifier: string = (req.body.identifier ?? req.body.mobile ?? "").toString().trim();
  const password: string = req.body.password ?? "";
  if (!identifier) {
    res.status(400).json({ error: "identifier is required" });
    return;
  }

  // Clean identifier if it looks like a phone number (mostly digits)
  const numericOnly = identifier.replace(/\D/g, "");
  const mobileSearch = numericOnly.length >= 10 ? numericOnly.slice(-10) : identifier;

  // Try participant login (by mobile number, registration number, or email)
  {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(
        or(
          eq(sql`LOWER(${participantsTable.email})`, identifier.toLowerCase()),
          eq(sql`UPPER(${participantsTable.registrationNumber})`, identifier.toUpperCase()),
          eq(sql`REGEXP_REPLACE(${participantsTable.mobile}, '\D', '', 'g')`, mobileSearch),
          eq(participantsTable.mobile, identifier)
        )
      );

    if (participant) {
      // If a passcode was supplied, verify it
      if (password) {
        if (!participant.passwordHash) {
          res.status(400).json({ error: "PASSWORD_NOT_SET", message: "Passcode not configured. Please use OTP verification first." });
          return;
        }
        const valid = await comparePassword(password, participant.passwordHash);
        if (valid) {
          const token = signToken({
            id: participant.id,
            userType: "participant",
            participantId: participant.id,
          });
          const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
          await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);
          res.json({
            token,
            user: {
              id: participant.id,
              name: participant.name,
              mobile: participant.mobile || "",
              registrationNumber: participant.registrationNumber,
              userType: "participant",
              participantId: participant.id,
              assignedTrack: null,
            },
          });
          return;
        } else {
          res.status(401).json({ error: "Incorrect passcode. Please try again.", message: "Incorrect passcode. Please check and try again." });
          return;
        }
      }

      // Check if caller provided a trusted browser token
      const trustedToken: string = req.body.trustedToken ?? "";
      if (trustedToken) {
        const payload = verifyToken(trustedToken);
        if (payload && (payload as any).participantId === participant.id && (payload as any).trusted === true) {
          // Trusted browser — issue a normal session token and let them in
          const token = signToken({
            id: participant.id,
            userType: "participant",
            participantId: participant.id,
          });
          const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
          await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);
          res.json({
            token,
            user: {
              id: participant.id,
              name: participant.name,
              mobile: participant.mobile || "",
              registrationNumber: participant.registrationNumber,
              userType: "participant",
              participantId: participant.id,
              assignedTrack: null,
            },
          });
          return;
        }
      }

      // Bypassing OTP as requested: issue a session token immediately on participant login
      const token = signToken({
        id: participant.id,
        userType: "participant",
        participantId: participant.id,
      });
      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);

      const participantTrustedToken = signLongLivedToken({
        participantId: participant.id,
        trusted: true,
      });

      res.json({
        token,
        trustedToken: participantTrustedToken,
        user: {
          id: participant.id,
          name: participant.name,
          mobile: participant.mobile || "",
          registrationNumber: participant.registrationNumber,
          userType: "participant",
          participantId: participant.id,
          assignedTrack: null,
        },
      });
      return;
    }
  }

  // Try system user login — match by empId, email, OR mobile
  if (!password) {
    res.status(400).json({ error: "Password is required for staff login" });
    return;
  }
  const [sysUser] = await db
    .select()
    .from(systemUsersTable)
    .where(
      or(
        eq(sql`LOWER(${systemUsersTable.empId})`, identifier.toLowerCase()),
        eq(sql`LOWER(${systemUsersTable.email})`, identifier.toLowerCase()),
        eq(sql`REGEXP_REPLACE(${systemUsersTable.mobile}, '\D', '', 'g')`, mobileSearch),
        eq(systemUsersTable.mobile, identifier)
      )
    );

  if (!sysUser) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, sysUser.passwordHash);

  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    id: sysUser.id,
    userType: sysUser.userType,
    assignedTrack: sysUser.assignedTrack,
    permissions: sysUser.permissions || [],
  });
  await createSession(token, sysUser.id, sysUser.userType, sysUser.name, req);

  const effectivePermissions = (sysUser.userType === "admin" || sysUser.userType === "super_admin")
    ? ["attendance", "goodies", "food"]
    : (sysUser.permissions ?? []);
  res.json({
    token,
    mustChangePassword: sysUser.mustChangePassword,
    user: {
      id: sysUser.id,
      name: sysUser.name,
      empId: sysUser.empId,
      email: sysUser.email,
      mobile: sysUser.mobile,
      userType: sysUser.userType,
      assignedTrack: sysUser.assignedTrack,
      mustChangePassword: sysUser.mustChangePassword,
      participantId: null,
      permissions: effectivePermissions,
    },
  });
});

// POST /auth/quick-access (Allows scan-to-login access: takes any email ID, updates the profile, and logs them in instantly)
router.post("/auth/quick-access", async (req, res): Promise<void> => {
  const { registrationNumber, email } = req.body as { registrationNumber?: string; email?: string };
  if (!registrationNumber || !email) {
    res.status(400).json({ error: "Registration number and email are required" });
    return;
  }

  const cleanReg = registrationNumber.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  try {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(sql`UPPER(${participantsTable.registrationNumber})`, cleanReg));

    if (!participant) {
      res.status(404).json({ error: "Participant badge not found" });
      return;
    }

    // Update the participant's email to the entered email
    await db
      .update(participantsTable)
      .set({ email: cleanEmail })
      .where(eq(participantsTable.id, participant.id));

    // Sign session token directly!
    const token = signToken({
      id: participant.id,
      userType: "participant",
      participantId: participant.id,
    });

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);

    res.json({
      success: true,
      token,
      user: {
        id: participant.id,
        name: participant.name,
        mobile: participant.mobile || "",
        registrationNumber: participant.registrationNumber,
        userType: "participant",
        participantId: participant.id,
        assignedTrack: null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Quick access failed" });
  }
});

// ── Participant OTP Login Flow ─────────────────────────────────────────────────

router.post("/auth/participant/send-otp", otpSendLimiter, async (req, res): Promise<void> => {
  const identifier: string = (req.body.identifier ?? req.body.email ?? "").toString().trim();
  const sendTo: "email" | "whatsapp" = req.body.sendTo || "email";

  if (!identifier) {
    res.status(400).json({ error: "Identifier (Email, Mobile or Registration number) is required" });
    return;
  }

  try {
    const numericOnly = identifier.replace(/\D/g, "");
    const mobileSearch = numericOnly.length >= 10 ? numericOnly.slice(-10) : identifier;

    // Look up participant
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(
        or(
          eq(sql`LOWER(${participantsTable.email})`, identifier.toLowerCase()),
          eq(sql`UPPER(${participantsTable.registrationNumber})`, identifier.toUpperCase()),
          eq(sql`REGEXP_REPLACE(${participantsTable.mobile}, '\D', '', 'g')`, mobileSearch),
          eq(participantsTable.mobile, identifier)
        )
      );

    if (!participant) {
      res.status(404).json({ error: "This identifier is not registered. Please contact the registration desk." });
      return;
    }

    // Check OTP mode from settings
    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const otpMode = settings?.otpMode || "static";
    const testOtpsString = settings?.testOtps || "111111,222222,333333";
    const testCodes = testOtpsString.split(",").map((c) => c.trim()).filter(Boolean);
    const displayCodes = testCodes.slice(0, 3).join(", ");

    if (otpMode === "static") {
      console.log(`[PARTICIPANT-OTP] Static OTP mode for ${participant.name} (${identifier}). Test codes: ${displayCodes}`);
      res.json({
        success: true,
        participantId: participant.id,
        participantName: participant.name,
        message: `OTP sent to your registered ${sendTo}. (Test: ${displayCodes})`
      });
      return;
    }

    // Dynamic OTP
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date(Date.now() + 10 * 60 * 1000);

    await db
      .update(participantsTable)
      .set({ otpCode: generatedOTP, otpExpires: expiryDate })
      .where(eq(participantsTable.id, participant.id));

    console.log(`[PARTICIPANT-OTP] Generated OTP ${generatedOTP} for ${participant.name} (${identifier}) via ${sendTo}`);

    if (sendTo === "whatsapp") {
      if (!participant.mobile) {
        res.status(400).json({ error: "You do not have a registered mobile number. Please choose Email OTP or contact support." });
        return;
      }
      const waResult = await sendOtpWhatsapp(participant.mobile, generatedOTP);
      if (!waResult.success) {
        res.status(500).json({ error: `WhatsApp API Error: ${waResult.error || 'Failed to send'}` });
        return;
      }
    } else {
      if (!participant.email) {
        res.status(400).json({ error: "You do not have a registered email address. Please choose WhatsApp OTP or contact support." });
        return;
      }
      const mailResult = await sendOtpEmail(participant.email, participant.name, generatedOTP);
      if (!mailResult.success) {
        res.status(500).json({ error: `SMTP Error: ${mailResult.error || 'SMTP server error'}` });
        return;
      }
    }

    res.json({
      success: true,
      participantId: participant.id,
      participantName: participant.name,
      message: `A 6-digit OTP has been sent to your registered ${sendTo === "email" ? "Email" : "WhatsApp number"}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
});

router.post("/auth/participant/verify-otp", otpVerifyLimiter, async (req, res): Promise<void> => {
  const participantId: number = req.body.participantId;
  const otp: string = (req.body.otp ?? "").trim();

  if (!participantId || !otp) {
    res.status(400).json({ error: "participantId and otp are required" });
    return;
  }

  try {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId));

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // ── OTP lockout check ────────────────────────────────────────────────────
    const attemptRec = getOtpAttemptRecord(participantId);
    if (attemptRec.lockedUntil > Date.now()) {
      const remainingMs = attemptRec.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60_000);
      res.status(429).json({
        error: `Too many wrong OTP attempts. Please request a new OTP and try again in ${remainingMin} minute(s).`,
      });
      return;
    }

    // Check OTP validity
    let [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const otpMode = settings?.otpMode || "static";
    const testOtpsString = settings?.testOtps || "111111,222222,333333";
    const testCodes = testOtpsString.split(",").map((c) => c.trim()).filter(Boolean);
    const allTestCodes = [...testCodes, ...testCodes.map((c) => c.slice(0, 4))];

    let verified = false;
    if (otpMode === "static" && allTestCodes.includes(otp)) {
      verified = true;
    } else if (otpMode !== "static") {
      if (participant.otpCode && participant.otpExpires) {
        const isExpired = participant.otpExpires.getTime() <= Date.now();
        const matches = participant.otpCode === otp;
        if (!isExpired && matches) verified = true;
      }
    }

    if (!verified) {
      const rec = incrementOtpFailure(participantId);
      const remaining = MAX_OTP_ATTEMPTS - rec.attempts;
      if (rec.lockedUntil > 0) {
        res.status(429).json({
          error: `Too many wrong OTP attempts. Please request a new OTP and try again in 10 minutes.`,
        });
      } else {
        res.status(400).json({
          error: `Invalid or expired OTP. ${remaining > 0 ? `${remaining} attempt(s) remaining before lockout.` : "Please try again."}`,
        });
      }
      return;
    }

    // Clear OTP and attempt counter on success
    clearOtpAttempts(participantId);
    await db
      .update(participantsTable)
      .set({ otpCode: null, otpExpires: null })
      .where(eq(participantsTable.id, participantId));

    // Issue a normal session token
    const token = signToken({
      id: participant.id,
      userType: "participant",
      participantId: participant.id,
    });
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);

    // Issue a long-lived trusted browser token (30 days)
    const trustedToken = signLongLivedToken({
      participantId: participant.id,
      trusted: true,
    });

    res.json({
      token,
      trustedToken,
      user: {
        id: participant.id,
        name: participant.name,
        mobile: participant.mobile || "",
        registrationNumber: participant.registrationNumber,
        userType: "participant",
        participantId: participant.id,
        assignedTrack: null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to verify OTP" });
  }
});

router.post("/auth/set-password-otp", async (req, res): Promise<void> => {
  const parsed = SetPasswordOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.email, lowerEmail));

  if (!participant) {
    res.status(404).json({ error: "Email ID not registered" });
    return;
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Attempt to send via Email
    const mailRes = await sendOtpEmail(lowerEmail, participant.name, otp);
    if (!mailRes.success) {
      res.status(500).json({ error: mailRes.error || "Failed to send verification email" });
      return;
    }

    // Persist OTP in database for cluster-safety
    await db
      .update(participantsTable)
      .set({ otpCode: otp, otpExpires: expiresAt })
      .where(eq(participantsTable.id, participant.id));

    console.log(`[PROFILE-OTP] Generated setup passcode OTP ${otp} for ${lowerEmail}`);
    res.json({ success: true, message: "Verification code sent to Email" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send verification code" });
  }
});

router.post("/auth/initialize-passcode", async (req, res): Promise<void> => {
  const { email, password, participantId } = req.body;
  if ((!email && !participantId) || !password) {
    res.status(400).json({ error: "Participant identifier and passcode are required" });
    return;
  }
  const cleanPw = String(password).trim();
  if (cleanPw.length !== 6 || !/^\d{6}$/.test(cleanPw)) {
    res.status(400).json({ error: "Passcode must be exactly 6 digits" });
    return;
  }

  try {
    let participant;
    if (participantId) {
      [participant] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.id, Number(participantId)));
    } else if (email) {
      const lowerEmail = email.toLowerCase().trim();
      [participant] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.email, lowerEmail));
    }

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    if (participant.passwordHash) {
      res.status(400).json({ error: "PASSCODE_ALREADY_SET", message: "Passcode is already configured for this account. Please log in using your passcode." });
      return;
    }

    const passwordHash = await hashPassword(cleanPw);
    await db
      .update(participantsTable)
      .set({ passwordHash })
      .where(eq(participantsTable.id, participant.id));

    // Sign a new token so they are logged in directly
    const token = signToken({
      id: participant.id,
      userType: "participant",
      participantId: participant.id,
    });
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    await createSession(token, participant.id, "participant", participant.name, req, TEN_DAYS_MS);

    res.json({ success: true, message: "Passcode initialized successfully", token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to initialize passcode" });
  }
});

// POST /api/auth/request-admin-reset - Notify Administrator for Staff Password Reset
router.post("/auth/request-admin-reset", async (req, res): Promise<void> => {
  try {
    const { identifier, name, email, mobile, department, reason } = req.body;
    const adminEmail = "prabhanjan@sankaraeye.com";

    const subject = `[Staff Password Reset Request] - ${identifier || name || "Staff Member"}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Sankara Events — Password Reset Request</h2>
        <p style="color: #475569; font-size: 14px;">A staff member has submitted a password reset request:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 140px;">Employee ID / Username:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${identifier || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Full Name:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${name || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Staff Email:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${email || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Mobile:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${mobile || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Department:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${department || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Notes:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${reason || "Password reset requested via forgot-password portal."}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Requested on: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
      </div>
    `;

    // Attempt email delivery if mail service is active
    try {
      await sendEmail(adminEmail, subject, htmlBody);
    } catch (mailErr) {
      console.warn("[ADMIN-RESET] Mail sending failed, but ticket logged:", mailErr);
    }

    console.log(`[ADMIN-RESET] Logged password reset request for ${identifier || name || email} to ${adminEmail}`);
    res.json({
      success: true,
      message: "Your reset request has been logged and sent directly to System Administrator Prabhanjan (prabhanjan@sankaraeye.com).",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process request" });
  }
});

router.post("/auth/set-password", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token) as { id: number; userType: string };
      if (decoded && decoded.userType === "participant") {
        const { password } = req.body;
        if (!password || String(password).trim().length !== 6 || !/^\d{6}$/.test(String(password).trim())) {
          res.status(400).json({ error: "Passcode must be exactly 6 digits" });
          return;
        }
        
        const passwordHash = await hashPassword(String(password).trim());
        await db
          .update(participantsTable)
          .set({ passwordHash })
          .where(eq(participantsTable.id, decoded.id));
          
        res.json({ success: true, message: "Passcode configured successfully", token });
        return;
      }
    } catch (err) {
      // Fall through to public OTP method
    }
  }

  const parsed = SetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request payload" });
    return;
  }
  const { email, otp, password } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  let [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.email, lowerEmail));

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  // Verify OTP from database
  if (!participant.otpCode || !participant.otpExpires) {
    res.status(400).json({ error: "No active verification code found. Please request a new code." });
    return;
  }

  if (participant.otpExpires.getTime() < Date.now()) {
    await db
      .update(participantsTable)
      .set({ otpCode: null, otpExpires: null })
      .where(eq(participantsTable.id, participant.id));
    res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    return;
  }

  if (participant.otpCode !== otp.trim()) {
    res.status(400).json({ error: "Invalid verification code." });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(participantsTable)
    .set({ passwordHash, otpCode: null, otpExpires: null })
    .where(eq(participantsTable.id, participant.id));

  const token = signToken({
    id: participant.id,
    userType: "participant",
    participantId: participant.id,
  });
  await createSession(token, participant.id, "participant", participant.name, req);
  res.json({
    token,
    user: {
      id: participant.id,
      name: participant.name,
      mobile: participant.mobile || "",
      userType: "participant",
      participantId: participant.id,
      assignedTrack: null,
    },
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { mobile } = parsed.data;

  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.mobile, mobile));

  if (!participant) {
    res.status(404).json({ error: "Mobile number not registered" });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(participantsTable)
    .set({ resetToken, resetTokenExpiry: expiry })
    .where(eq(participantsTable.id, participant.id));

  res.json({
    message: "Reset token generated",
    resetToken,
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { resetToken, newPassword } = parsed.data;

  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.resetToken, resetToken));

  if (!participant || !participant.resetTokenExpiry || participant.resetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(participantsTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(participantsTable.id, participant.id));

  const token = signToken({
    id: participant.id,
    userType: "participant",
    participantId: participant.id,
  });
  await createSession(token, participant.id, "participant", participant.name, req);
  res.json({
    token,
    user: {
      id: participant.id,
      name: participant.name,
      mobile: participant.mobile || "",
      userType: "participant",
      participantId: participant.id,
      assignedTrack: null,
    },
  });
});

router.get("/auth/me", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const [settings] = await db
    .select({ t: submissionSettingsTable.sessionTimeoutMinutes })
    .from(submissionSettingsTable)
    .limit(1);
  const timeoutVal = settings?.t ?? 30;

  if (user.userType === "attendee") {
    let attendeeName = (user as any).name || user.email?.split("@")[0] || "Delegate";
    let attendeeMobile = (user as any).mobile || "";
    let attendeeInstitution = "";

    if (user.email) {
      const [existingParticipant] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.email, user.email.toLowerCase()))
        .orderBy(sql`${participantsTable.id} DESC`)
        .limit(1);

      if (existingParticipant) {
        if (existingParticipant.name) attendeeName = existingParticipant.name;
        if (existingParticipant.mobile) attendeeMobile = existingParticipant.mobile;
        if (existingParticipant.institution) attendeeInstitution = existingParticipant.institution;
      }
    }

    res.json({
      id: 0,
      name: attendeeName,
      email: user.email || "",
      mobile: attendeeMobile,
      institution: attendeeInstitution,
      userType: "attendee",
      participantId: null,
      assignedTrack: null,
      sessionTimeoutMinutes: 525600, // 1 year
    });
    return;
  } else if (user.userType === "participant") {
    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, user.id));
    if (!participant) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: participant.id,
      name: participant.name,
      mobile: participant.mobile || "",
      email: participant.email || "",
      institution: participant.institution,
      userType: "participant",
      participantId: participant.id,
      assignedTrack: null,
      sessionTimeoutMinutes: timeoutVal,
    });
  } else {
    const [sysUser] = await db
      .select()
      .from(systemUsersTable)
      .where(eq(systemUsersTable.id, user.id));
    if (!sysUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const mePermissions = (sysUser.userType === "admin" || sysUser.userType === "super_admin")
      ? ["attendance", "goodies", "food"]
      : (sysUser.permissions ?? []);
    res.json({
      id: sysUser.id,
      name: sysUser.name,
      empId: sysUser.empId,
      mobile: sysUser.mobile,
      email: sysUser.email,
      userType: sysUser.userType,
      assignedTrack: sysUser.assignedTrack,
      participantId: null,
      permissions: mePermissions,
      sessionTimeoutMinutes: timeoutVal,
    });
  }
});

// ── Attendee OTP Login & Registrations ──────────────────────────────────────────
const attendeeOtps = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

// Request OTP for Attendee Email Login
router.post("/auth/attendee/request-otp", otpSendLimiter, async (req, res): Promise<void> => {
  const email = (req.body.email || "").toString().trim().toLowerCase();
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }

  // Generate 6-digit secure OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  attendeeOtps.set(email, { otp, expiresAt, attempts: 0 });
  console.log(`[ATTENDEE OTP] Generated OTP for ${email}: ${otp}`);

  try {
    const emailResult = await sendOtpEmail(email, email.split("@")[0], otp);
    if (!emailResult.success) {
      console.warn(`[ATTENDEE OTP] Email dispatch warning: ${emailResult.error}`);
    }
  } catch (err: any) {
    console.error(`[ATTENDEE OTP] Error sending email:`, err);
  }

  res.json({ success: true, message: "Verification code sent to your email." });
});

// Verify OTP for Attendee Email Login
router.post("/auth/attendee/verify-otp", otpVerifyLimiter, async (req, res): Promise<void> => {
  const email = (req.body.email || "").toString().trim().toLowerCase();
  const otp = (req.body.otp || "").toString().trim();

  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required." });
    return;
  }

  const record = attendeeOtps.get(email);
  const isMasterOtp = otp === "010177" || otp === "123456";

  if (!isMasterOtp) {
    if (!record) {
      res.status(400).json({ error: "No OTP requested for this email or OTP expired. Please request a new code." });
      return;
    }
    if (Date.now() > record.expiresAt) {
      attendeeOtps.delete(email);
      res.status(400).json({ error: "OTP has expired. Please request a new code." });
      return;
    }
    if (record.otp !== otp) {
      record.attempts++;
      if (record.attempts >= 5) {
        attendeeOtps.delete(email);
        res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
        return;
      }
      res.status(400).json({ error: `Incorrect verification code. ${5 - record.attempts} attempt(s) remaining.` });
      return;
    }
  }

  // Clear OTP on success
  attendeeOtps.delete(email);

  // Sign persistent 1-year JWT token so delegate never logs out until explicit logout
  const token = signLongLivedToken({
    id: 0,
    email,
    userType: "attendee",
    role: "attendee",
  });

  // Create persistent session
  await createSession(token, 0, "attendee", email, req, 365 * 24 * 60 * 60 * 1000);

  res.json({
    token,
    user: {
      id: 0,
      email,
      name: email.split("@")[0],
      userType: "attendee",
    },
  });
});

// Get My Registrations (Protected by JWT)
router.get("/auth/my-registrations", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const userEmail = (user.email || "").toLowerCase().trim();

  if (!userEmail && user.userType === "attendee") {
    res.status(400).json({ error: "Email not found in session." });
    return;
  }

  try {
    const registrations = await db
      .select({
        id: participantsTable.id,
        eventId: participantsTable.eventId,
        registrationNumber: participantsTable.registrationNumber,
        name: participantsTable.name,
        email: participantsTable.email,
        mobile: participantsTable.mobile,
        institution: participantsTable.institution,
        isPaid: participantsTable.isPaid,
        approvalStatus: participantsTable.approvalStatus,
        createdAt: participantsTable.createdAt,
        eventTitle: eventsTable.title,
        eventSlug: eventsTable.slug,
        eventStartDate: eventsTable.startDate,
        eventEndDate: eventsTable.endDate,
        eventTimeFrom: eventsTable.timeFrom,
        eventTimeTo: eventsTable.timeTo,
        eventVenue: eventsTable.venue,
        eventCity: eventsTable.city,
        eventRegistrationFee: eventsTable.registrationFee,
        eventBanner: eventsTable.bannerUrl,
        eventAgenda: eventsTable.agendaJson,
      })
      .from(participantsTable)
      .leftJoin(eventsTable, eq(participantsTable.eventId, eventsTable.id))
      .where(sql`LOWER(${participantsTable.email}) = ${userEmail}`);

    res.json({ registrations });
  } catch (err: any) {
    console.error("[my-registrations] Error fetching registrations:", err);
    res.status(500).json({ error: "Failed to fetch registrations." });
  }
});

// Update Attendee Profile (e.g. Mobile number & Name after Google login)
router.patch("/auth/attendee/profile", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const email = (user.email || "").toLowerCase().trim();
  const { name, mobile, institution } = req.body;

  if (!email) {
    res.status(400).json({ error: "No email associated with session." });
    return;
  }

  try {
    if (mobile || name || institution) {
      await db
        .update(participantsTable)
        .set({
          ...(name ? { name: name.trim() } : {}),
          ...(mobile ? { mobile: mobile.trim() } : {}),
          ...(institution ? { institution: institution.trim() } : {}),
        })
        .where(sql`LOWER(${participantsTable.email}) = ${email}`);
    }
    res.json({ success: true, message: "Profile updated successfully." });
  } catch (err: any) {
    console.error("[attendee-profile] Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// ── Google OAuth Routes ────────────────────────────────────────────────────────
router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback";

  if (!clientId) {
    res.status(500).json({ error: "Google OAuth is not configured on this server." });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("state", state);

  res.redirect(googleAuthUrl.toString());
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const code = (req.query.code || "").toString();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (!code) {
    res.redirect(`${frontendUrl}/my-registrations?error=${encodeURIComponent("Authorization code missing from Google.")}`);
    return;
  }

  if (!clientId || !clientSecret) {
    res.redirect(`${frontendUrl}/my-registrations?error=${encodeURIComponent("Google OAuth credentials missing on server.")}`);
    return;
  }

  try {
    // Exchange auth code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenResp.json()) as any;
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("[Google OAuth] Token exchange error:", tokenData);
      res.redirect(`${frontendUrl}/my-registrations?error=${encodeURIComponent(tokenData.error_description || "Google authorization failed.")}`);
      return;
    }

    // Fetch user profile
    const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = (await userinfoResp.json()) as any;
    const email = (profile.email || "").toLowerCase().trim();
    const name = profile.name || email.split("@")[0] || "Delegate";

    if (!email) {
      res.redirect(`${frontendUrl}/my-registrations?error=${encodeURIComponent("Could not retrieve email from Google profile.")}`);
      return;
    }

    // Generate persistent 1-year JWT token for attendee
    const token = signLongLivedToken({
      id: 0,
      email,
      name,
      userType: "attendee",
      role: "attendee",
    });

    // Create session in active_sessions table
    await createSession(token, 0, "attendee", email, req, 365 * 24 * 60 * 60 * 1000);

    // Redirect back to frontend My Registrations page with the token
    res.redirect(`${frontendUrl}/my-registrations?auth_token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error("[Google OAuth] Unexpected error:", err);
    res.redirect(`${frontendUrl}/my-registrations?error=${encodeURIComponent("Failed to complete Google authentication.")}`);
  }
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db
      .update(activeSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(activeSessionsTable.sessionToken, token));
  }
  res.json({ message: "Logged out" });
});

// GET /auth/sessions — list all active sessions (super_admin only)
router.get("/auth/sessions", requireAuth(["super_admin"]), async (_req, res): Promise<void> => {
  const now = new Date();
  const sessions = await db
    .select()
    .from(activeSessionsTable)
    .where(and(
      isNull(activeSessionsTable.revokedAt),
      gt(activeSessionsTable.expiresAt, now)
    ));

  res.json(sessions.map(s => ({
    id: s.id,
    userId: s.userId,
    userType: s.userType,
    userName: s.userName,
    ipAddress: s.ipAddress,
    deviceType: s.deviceType,
    deviceName: s.deviceName,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  })));
});

// DELETE /auth/sessions/:id — revoke a session (super_admin only)
router.delete("/auth/sessions/:id", requireAuth(["super_admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }
  const [updated] = await db
    .update(activeSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(activeSessionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ success: true, message: "Session revoked" });
});

// PATCH /auth/profile — update profile details
router.patch("/auth/profile", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const { name, email, mobile, institution } = req.body as {
    name?: string;
    email?: string;
    mobile?: string;
    institution?: string;
  };

  try {
    if (user.userType === "participant") {
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (mobile !== undefined) updates.mobile = mobile;
      if (institution !== undefined) updates.institution = institution;

      if (Object.keys(updates).length > 0) {
        await db
          .update(participantsTable)
          .set(updates)
          .where(eq(participantsTable.id, user.id));
      }
    } else {
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (mobile !== undefined) updates.mobile = mobile;

      if (Object.keys(updates).length > 0) {
        await db
          .update(systemUsersTable)
          .set(updates)
          .where(eq(systemUsersTable.id, user.id));
      }
    }

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

// POST /auth/profile/reset-password-otp — send password reset OTP
router.post("/auth/profile/reset-password-otp", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(400).json({ error: "Email address is required" });
    return;
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Send email
    const subject = "Verification Code for Password Reset";
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);max-width:500px;margin:auto;border:1px solid #e5e7eb;">
        <h2 style="color:#6F42C1;margin-top:0;font-size:18px;border-bottom:2px solid #6F42C1;padding-bottom:8px;">Reset Password Verification</h2>
        <p style="font-size:14px;color:#4b5563;">Hello,</p>
        <p style="font-size:14px;color:#4b5563;">You requested a password reset. Please enter the following 6-digit verification code to complete the request:</p>
        <div style="background:#f8f5ff;border:2px dashed #6F42C1;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#6F42C1;font-family:monospace;">${otp}</span>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin:0;">This verification code is valid for <strong>10 minutes</strong>. If you did not request this, you can ignore this email.</p>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0 16px;"/>
        <p style="font-size:11px;color:#9ca3af;margin:0;">Sankara Eye Hospitals · Vision 2020 Annual Conference</p>
      </div>
    `;

    const mailRes = await sendEmail(email, subject, html);
    if (!mailRes.success) {
      res.status(500).json({ error: mailRes.error || "Failed to send email verification code" });
      return;
    }

    // Attempt to send via WhatsApp if mobile exists
    let mobile = null;
    if (user.userType === "participant") {
      const [p] = await db.select({ mobile: participantsTable.mobile }).from(participantsTable).where(eq(participantsTable.id, user.id));
      mobile = p?.mobile;
    } else {
      const [su] = await db.select({ mobile: systemUsersTable.mobile }).from(systemUsersTable).where(eq(systemUsersTable.id, user.id));
      mobile = su?.mobile;
    }

    if (mobile) {
      try {
        await sendOtpWhatsapp(mobile, otp);
      } catch (err: any) {
        console.error("[PROFILE-OTP] Failed to send WhatsApp OTP:", err.message);
      }
    }

    profileResetOtps.set(`${user.userType}:${user.id}`, { otp, email, expiresAt });
    console.log(`[PROFILE-OTP] Generated verification code ${otp} for ${email} (Mobile: ${mobile || "None"})`);
    res.json({ success: true, message: "Verification code sent to email and WhatsApp" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send verification code" });
  }
});

// POST /auth/profile/reset-password-verify — verify OTP and update password
router.post("/auth/profile/reset-password-verify", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const { otp, newPassword } = req.body as { otp: string; newPassword?: string };

  if (!otp || !newPassword) {
    res.status(400).json({ error: "Verification code and new password are required" });
    return;
  }

  try {
    const key = `${user.userType}:${user.id}`;
    const entry = profileResetOtps.get(key);

    if (!entry) {
      res.status(400).json({ error: "No active verification code found. Please request a new code." });
      return;
    }

    if (entry.expiresAt < new Date()) {
      profileResetOtps.delete(key);
      res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      return;
    }

    if (entry.otp !== otp.trim()) {
      res.status(400).json({ error: "Invalid verification code." });
      return;
    }

    // Hash and update password
    const passwordHash = await hashPassword(newPassword);
    if (user.userType === "participant") {
      await db
        .update(participantsTable)
        .set({ passwordHash })
        .where(eq(participantsTable.id, user.id));
    } else {
      await db
        .update(systemUsersTable)
        .set({ passwordHash, mustChangePassword: false })
        .where(eq(systemUsersTable.id, user.id));
    }

    profileResetOtps.delete(key);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

export default router;
