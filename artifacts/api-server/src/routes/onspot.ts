import { Router } from "express";
import { eq, and, like, or, sql } from "drizzle-orm";
import { db, participantsTable, activityLogsTable, attendanceLogsTable, goodiesLogsTable, activeSessionsTable, submissionSettingsTable, getCleanName } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkEmailOrMobileRegistered, signToken, signLongLivedToken } from "../lib/auth";
import * as XLSX from "xlsx";
import { ZipArchive } from "archiver";
import QRCode from "qrcode";
import { getClientBaseUrl } from "../lib/ip-helper";
import { parseDevice } from "../lib/parseDevice";

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

const DEFAULT_SESSION_DURATION_MS = 30 * 60 * 1000;

async function getSessionDurationMs(): Promise<number> {
  try {
    const [settings] = await db.select({ t: submissionSettingsTable.sessionTimeoutMinutes })
      .from(submissionSettingsTable).limit(1);
    return ((settings?.t ?? 30)) * 60 * 1000;
  } catch {
    return DEFAULT_SESSION_DURATION_MS;
  }
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

import { sendRegistrationWelcomeWhatsapp, sendAttendanceScannedWhatsapp } from "../lib/mailer";

const router = Router();

// POST /onspot/generate
// POST /onspot/generate
router.post("/onspot/generate", requireAuth(["admin", "super_admin", "event_coordinator"]), async (req, res): Promise<void> => {
  const { count, startNumber, endNumber, singleNumber, eventId, role } = req.body as {
    count?: number;
    startNumber?: number;
    endNumber?: number;
    singleNumber?: number | string;
    eventId?: number;
    role?: string;
  };

  const resolvedRole = (role || "delegate").toLowerCase().trim();

  try {
    let prefix = "OS";
    let eventTitle = "Sankara Medical Conference";
    if (eventId) {
      const { eventsTable } = await import("@workspace/db");
      const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (ev) {
        eventTitle = ev.title;
        const cleanSlug = ev.slug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        prefix = `${cleanSlug.slice(0, 4) || "EVT"}-OS`;
      }
    }

    const numbersToGenerate: number[] = [];

    if (singleNumber !== undefined && singleNumber !== null && singleNumber !== "") {
      const num = parseInt(String(singleNumber).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num) && num > 0) {
        numbersToGenerate.push(num);
      }
    } else if (startNumber && endNumber && endNumber >= startNumber) {
      for (let n = Number(startNumber); n <= Number(endNumber); n++) {
        numbersToGenerate.push(n);
      }
    } else {
      const genCount = Number(count) || 1;
      const existing = await db
        .select({ registrationNumber: participantsTable.registrationNumber })
        .from(participantsTable)
        .where(like(participantsTable.registrationNumber, `%${prefix}-%`));

      let maxIndex = 0;
      for (const r of existing) {
        const match = r.registrationNumber.match(new RegExp(`${prefix}-(\\d+)`, "i")) || r.registrationNumber.match(/OS-?(\d+)/i);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (!isNaN(idx) && idx > maxIndex) {
            maxIndex = idx;
          }
        }
      }

      for (let i = 1; i <= genCount; i++) {
        numbersToGenerate.push(maxIndex + i);
      }
    }

    if (numbersToGenerate.length === 0) {
      res.status(400).json({ error: "No valid card numbers specified" });
      return;
    }

    const rowsToInsert = [];
    for (const num of numbersToGenerate) {
      const regNumber = `${prefix}-${String(num).padStart(4, "0")}`;

      // Check if already exists
      const [existingCard] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.registrationNumber, regNumber));

      if (!existingCard) {
        rowsToInsert.push({
          eventId: eventId || null,
          registrationNumber: regNumber,
          name: "Unassigned Pass",
          email: `onspot_${regNumber.toLowerCase()}@sankaraeye.in`,
          mobile: `OS${String(num).padStart(4, "0")}`,
          institution: "Unassigned Physical Card",
          delegateType: resolvedRole,
          isOnSpot: true,
          isOnSpotLinked: false,
          isOnSpotOnboarded: false,
          isPaid: true,
          paymentStatus: "paid",
          approvalStatus: "approved",
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await db.insert(participantsTable).values(rowsToInsert);
      await db.insert(activityLogsTable).values({
        type: "settings",
        message: `Created ${rowsToInsert.length} unassigned on-spot cards (Prefix: ${prefix}) for Role: ${resolvedRole}`,
      });
    }

    res.json({
      success: true,
      message: `Generated ${rowsToInsert.length} cards successfully. Cards are now ready to be assigned using scan gun.`,
      generatedNumbers: numbersToGenerate,
    });
  } catch (err: any) {
    console.error("Card Gen Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate cards" });
  }
});

// GET /onspot/lookup-card/:code — Fast scan gun lookup
router.get("/onspot/lookup-card/:code", requireAuth(["admin", "super_admin", "event_coordinator"]), async (req, res): Promise<void> => {
  const rawCode = (req.params.code || "").trim();
  if (!rawCode) {
    res.status(400).json({ error: "Code is required" });
    return;
  }

  // Extract reg number from full URL or raw code
  let cleanCode = rawCode.toUpperCase();
  const urlMatch = cleanCode.match(/\/Q\/([A-Z0-9\-]+)/i);
  if (urlMatch) {
    cleanCode = urlMatch[1].toUpperCase();
  }

  // If user entered only numbers (e.g. 1001)
  const isPureNumber = /^\d+$/.test(cleanCode);

  let participant = null;
  if (isPureNumber) {
    const padded = String(parseInt(cleanCode, 10)).padStart(4, "0");
    [participant] = await db
      .select()
      .from(participantsTable)
      .where(or(
        eq(participantsTable.registrationNumber, cleanCode),
        like(participantsTable.registrationNumber, `%-${padded}`),
        like(participantsTable.registrationNumber, `OS-${padded}`)
      ));
  } else {
    [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, cleanCode));
  }

  if (!participant) {
    res.status(404).json({ error: `Card ${cleanCode} not found in system` });
    return;
  }

  res.json({
    found: true,
    participant: {
      id: participant.id,
      registrationNumber: participant.registrationNumber,
      name: participant.name,
      mobile: participant.mobile?.startsWith("OS") ? "" : participant.mobile,
      institution: participant.institution === "Unassigned Physical Card" ? "" : participant.institution,
      delegateType: participant.delegateType || "delegate",
      isLinked: Boolean(participant.isOnSpotLinked),
      isValid: Boolean(participant.isOnSpotLinked),
    }
  });
});

// GET /onspot/list
router.get("/onspot/list", requireAuth(["admin", "super_admin", "event_coordinator"]), async (req, res): Promise<void> => {
  try {
    const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
    const roleParam = req.query.role as string | undefined;

    const conditions = [eq(participantsTable.isOnSpot, true)];
    if (eventIdParam && !isNaN(eventIdParam)) {
      conditions.push(eq(participantsTable.eventId, eventIdParam));
    }
    if (roleParam && roleParam !== "all") {
      conditions.push(eq(participantsTable.delegateType, roleParam));
    }

    const list = await db
      .select()
      .from(participantsTable)
      .where(and(...conditions))
      .orderBy(participantsTable.registrationNumber);

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve on-spot list" });
  }
});

// POST /onspot/link
router.post("/onspot/link", requireAuth(["admin", "super_admin", "event_coordinator"]), async (req, res): Promise<void> => {
  const { registrationNumber, name, mobile, institution, delegateType, email } = req.body as {
    registrationNumber?: string;
    name?: string;
    mobile?: string;
    institution?: string;
    delegateType?: string;
    email?: string;
  };

  if (!registrationNumber || !name || !mobile) {
    res.status(400).json({ error: "Card ID, Name, and Mobile Number are required" });
    return;
  }

  const cleanReg = registrationNumber.trim().toUpperCase();
  const cleanMobile = mobile.replace(/[^0-9]/g, "").slice(-10);

  if (cleanMobile.length !== 10) {
    res.status(400).json({ error: "Please enter a valid 10-digit mobile number" });
    return;
  }

  try {
    // Verify target registration number exists and is an on-spot slot
    const [target] = await db
      .select()
      .from(participantsTable)
      .where(and(eq(participantsTable.registrationNumber, cleanReg), eq(participantsTable.isOnSpot, true)));

    if (!target) {
      res.status(404).json({ error: `On-spot card with ID '${cleanReg}' was not found.` });
      return;
    }

    if (target.isOnSpotLinked) {
      res.status(400).json({ error: `This card has already been assigned to ${target.name} (+91 ${target.mobile}).` });
      return;
    }

    // Strict Unique Mobile Check per event (One mobile number used by one user only)
    if (target.eventId) {
      const [existingWithMob] = await db
        .select({ name: participantsTable.name, registrationNumber: participantsTable.registrationNumber })
        .from(participantsTable)
        .where(and(
          eq(participantsTable.eventId, target.eventId),
          eq(participantsTable.mobile, cleanMobile),
          ne(participantsTable.id, target.id)
        ));

      if (existingWithMob) {
        res.status(400).json({
          error: `Mobile number +91 ${cleanMobile} is already in use by "${existingWithMob.name}" (${existingWithMob.registrationNumber}). Each attendee must have a unique mobile number.`,
        });
        return;
      }
    }

    const nameVal = name.trim();
    const instVal = (institution && institution.trim()) || "Sankara Eye Care Institutions";
    const emailVal = (email && email.trim()) || `${cleanReg.toLowerCase()}@sankaraeye.in`;
    const resolvedRole = (delegateType || target.delegateType || "delegate").toLowerCase().trim();

    // Link the card AND auto-onboard details
    await db
      .update(participantsTable)
      .set({
        mobile: cleanMobile,
        isOnSpotLinked: true,
        isOnSpotOnboarded: true,
        name: nameVal,
        cleanName: getCleanName(nameVal),
        institution: instVal,
        email: emailVal,
        delegateType: resolvedRole,
        isPaid: true,
        paymentStatus: "paid",
        approvalStatus: "approved",
        approvedAt: new Date(),
      })
      .where(eq(participantsTable.id, target.id));

    // Automatically mark attendance for the current day
    const currentDay = "Day 1";
    const [existingAtt] = await db
      .select()
      .from(attendanceLogsTable)
      .where(and(
        eq(attendanceLogsTable.participantId, target.id),
        eq(attendanceLogsTable.day, currentDay)
      ));
    if (!existingAtt) {
      await db.insert(attendanceLogsTable).values({ 
        participantId: target.id, 
        eventId: target.eventId,
        day: currentDay 
      });
    }

    await db.insert(activityLogsTable).values({
      type: "settings",
      message: `Assigned on-spot card ${cleanReg} to ${nameVal} (${resolvedRole}, ${instVal})`,
    });

    const [updatedParticipant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, target.id));

    res.json({ 
      success: true, 
      message: `Card ${cleanReg} assigned successfully to ${nameVal}.`,
      participant: updatedParticipant
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to link card" });
  }
});

// POST /onspot/onboard (Public endpoint, no auth required to allow unauthenticated onboarding of the card)
router.post("/onspot/onboard", async (req, res): Promise<void> => {
  const { registrationNumber, name, address, mobile, institution, age, gender, email } = req.body as {
    registrationNumber?: string;
    name?: string;
    address?: string;
    mobile?: string;
    institution?: string;
    age?: string;
    gender?: string;
    email?: string;
  };

  if (!registrationNumber || !name || !mobile) {
    res.status(400).json({ error: "Name and Mobile number are required" });
    return;
  }

  const cleanReg = registrationNumber.trim().toUpperCase();
  const cleanMobile = mobile.replace(/[^0-9]/g, "");

  if (cleanMobile.length !== 10) {
    res.status(400).json({ error: "Please enter a valid 10-digit mobile number" });
    return;
  }

  const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanReg.toLowerCase()}@vision2020.com`;
  const cleanInstitution = (institution && institution.trim()) ? institution.trim() : "Sankara Eye Hospital";
  const cleanAge = age || "30";
  const cleanGender = gender || "Male";
  const cleanAddress = address || "";

  try {
    const [target] = await db
      .select()
      .from(participantsTable)
      .where(and(eq(participantsTable.registrationNumber, cleanReg), eq(participantsTable.isOnSpot, true)));

    if (!target) {
      res.status(404).json({ error: `On-spot card ${cleanReg} was not found` });
      return;
    }

    if (!target.isOnSpotLinked) {
      res.status(400).json({ error: "This card has not been issued/linked by the registration desk yet." });
      return;
    }

    if (target.isOnSpotOnboarded) {
      res.json({
        success: true,
        message: "Profile already onboarded",
        token: "",
        user: {
          id: target.id,
          name: target.name,
          mobile: target.mobile || "",
          registrationNumber: target.registrationNumber,
          userType: "participant",
          participantId: target.id,
          assignedTrack: null,
        }
      });
      return;
    }

    // Update details and lock
    await db
      .update(participantsTable)
      .set({
        name: name.trim(),
        cleanName: getCleanName(name),
        email: cleanEmail,
        address: cleanAddress,
        mobile: cleanMobile,
        institution: cleanInstitution,
        age: cleanAge,
        gender: cleanGender,
        isOnSpotOnboarded: true,
      })
      .where(eq(participantsTable.id, target.id));

    await db.insert(activityLogsTable).values({
      type: "registration",
      message: `On-spot onboarding complete: ${name.trim()} (${cleanReg})`,
    });

    // Automatically mark attendance and goodies
    try {
      const getCurrentConferenceDay = (): string => {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const dayVal = istTime.getUTCDate();
        const month = istTime.getUTCMonth() + 1;
        const year = istTime.getUTCFullYear();

        if (month === 7 && year === 2026) {
          if (dayVal === 10) return "Day 0";
          if (dayVal === 11) return "Day 1";
          if (dayVal === 12) return "Day 2";
        }
        return "Day 1";
      };

      const currentDay = getCurrentConferenceDay();
      const [existingAtt] = await db
        .select()
        .from(attendanceLogsTable)
        .where(and(
          eq(attendanceLogsTable.participantId, target.id),
          eq(attendanceLogsTable.day, currentDay)
        ));
      if (!existingAtt) {
        await db.insert(attendanceLogsTable).values({ participantId: target.id, day: currentDay });
        
        if (cleanMobile) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          const dd = String(now.getDate()).padStart(2, "0");
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const yyyy = now.getFullYear();
          const dateStr = `${dd}-${mm}-${yyyy}`;

          sendRegistrationWelcomeWhatsapp(cleanMobile, name.trim(), cleanReg).catch(() => {});
          sendAttendanceScannedWhatsapp(cleanMobile, name.trim(), timeStr, dateStr).catch(() => {});
        }
      }

      const [existingGoodies] = await db
        .select()
        .from(goodiesLogsTable)
        .where(eq(goodiesLogsTable.participantId, target.id));
      if (!existingGoodies) {
        await db.insert(goodiesLogsTable).values({ participantId: target.id });
      }
    } catch (err) {
      console.error("Failed to automatically mark attendance/goodies during onboarding:", err);
    }

    const token = signToken({
      id: target.id,
      userType: "participant",
      participantId: target.id,
    });
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    await createSession(token, target.id, "participant", name.trim(), req, TEN_DAYS_MS);

    const trustedToken = signLongLivedToken({
      participantId: target.id,
      trusted: true,
    });

    res.json({
      success: true,
      message: "Profile onboarded successfully!",
      token,
      trustedToken,
      user: {
        id: target.id,
        name: name.trim(),
        mobile: cleanMobile,
        registrationNumber: cleanReg,
        userType: "participant",
        participantId: target.id,
        assignedTrack: null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to onboard profile" });
  }
});

// GET /onspot/export
router.get("/onspot/export", requireAuth(["admin"]), async (req, res): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.isOnSpot, true))
      .orderBy(participantsTable.registrationNumber);

    const baseUrl = getClientBaseUrl(req);

    const exportData = list.map((item, index) => {
      const qrUrl = `${baseUrl}/q/${item.registrationNumber}`;
      return {
        "S.No": index + 1,
        "Registration Number": item.registrationNumber,
        "QR Code URL": qrUrl,
        "Linked Mobile": item.isOnSpotLinked ? `+91 ${item.mobile}` : "—",
        "Linking Status": item.isOnSpotLinked ? "Linked" : "Unlinked",
        "Onboard Status": item.isOnSpotOnboarded ? "Onboarded" : "Pending Onboarding",
        "Name": item.isOnSpotOnboarded ? item.name : "—",
        "Institution": item.isOnSpotOnboarded ? item.institution : "—",
        "Age": item.isOnSpotOnboarded ? item.age : "—",
        "Gender": item.isOnSpotOnboarded ? item.gender : "—",
        "Address": item.isOnSpotOnboarded ? item.address || "—" : "—",
      };
    });

    const totalCount = list.length;
    const totalLinked = list.filter(item => item.isOnSpotLinked).length;
    const totalUnlinked = list.filter(item => !item.isOnSpotLinked).length;
    const totalOnboarded = list.filter(item => item.isOnSpotOnboarded).length;

    const exportDataWithTotals = [
      ...exportData,
      // Blank row as spacing
      {
        "S.No": "",
        "Registration Number": "",
        "QR Code URL": "",
        "Linked Mobile": "",
        "Linking Status": "",
        "Onboard Status": "",
        "Name": "",
        "Institution": "",
        "Age": "",
        "Gender": "",
        "Address": "",
      },
      // Summary data
      {
        "S.No": "TOTAL GENERATED",
        "Registration Number": totalCount,
        "QR Code URL": "",
        "Linked Mobile": "TOTAL LINKED (ASSIGNED)",
        "Linking Status": totalLinked,
        "Onboard Status": "TOTAL UNLINKED (REMAINING)",
        "Name": totalUnlinked,
        "Institution": "TOTAL ONBOARDED (COMPLETED)",
        "Age": totalOnboarded,
        "Gender": "",
        "Address": "",
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(exportDataWithTotals);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "On Spot Registrations");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="on_spot_registrations_${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to export on-spot list" });
  }
});

export default router;
