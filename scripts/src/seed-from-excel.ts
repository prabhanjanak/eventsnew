import { db, participantsTable, systemUsersTable, submissionSettingsTable, foodSessionsTable, assignmentsTable, getCleanName } from "@workspace/db";
import * as xlsx from "xlsx";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number" || !isNaN(Number(val))) {
    const serial = Number(val);
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  const str = String(val).trim().toLowerCase();
  if (str.includes("day 0") || str.includes("10th")) return "10-07-2026";
  if (str.includes("day 1") || str.includes("11th")) return "11-07-2026";
  if (str.includes("day 2") || str.includes("12th")) return "12-07-2026";
  if (str.includes("day 3")) return "12-07-2026";
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  return null;
}

function isNA(val: any): boolean {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return ["na", "n/a", "n.a.", "#n/a", "nil", "none", "null", "undefined", "-"].includes(s);
}

function cleanMobile(mobile: any): string | null {
  if (!mobile || isNA(mobile)) return null;
  
  let s = String(mobile).trim();
  if (s.toLowerCase().includes("e")) {
    const num = Number(s);
    if (!isNaN(num)) s = String(Math.round(num));
  }
  if (s.includes(".")) {
    s = s.split(".")[0];
  }

  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}

function parseTrackAndHall(rawTrack: string | number): { track: string; hall: string | null } {
  const t = String(rawTrack || "").trim();
  if (!t) return { track: "General", hall: null };
  
  let trackName = t;
  let hall: string | null = null;
  
  // Extract Hall A/B from track string if present
  const hallMatch = t.match(/Hall\s*[A-B]/i);
  if (hallMatch) {
    hall = hallMatch[0]; // e.g. "Hall A", "Hall B"
  }
  
  const cleanTrack = t.toLowerCase().replace(/hall\s*[a-b]/i, "").trim();
  
  if (cleanTrack === "1" || cleanTrack === "track 1") {
    trackName = "Track 1: Innovations and Technological Solutions in Eye Care";
  } else if (cleanTrack === "2" || cleanTrack === "track 2") {
    trackName = "Track 2: Collaboration for Universal Eye Health";
  } else if (cleanTrack === "3" || cleanTrack === "track 3") {
    trackName = "Track 3: Impact, Equity, Sustainability and Quality in Eye Care";
  } else if (cleanTrack === "4" || cleanTrack === "track 4") {
    trackName = "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel";
  } else if (cleanTrack === "5" || cleanTrack === "track 5" || cleanTrack === "track 5 hall a") {
    trackName = "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
  } else if (cleanTrack === "track 5 hall b") {
    trackName = "Track 5 Hall B: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
  } else {
    // If it's a number like 1, 2, 3, etc.
    const numMatch = cleanTrack.match(/^\d+$/);
    if (numMatch) {
      const num = numMatch[0];
      if (num === "1") trackName = "Track 1: Innovations and Technological Solutions in Eye Care";
      else if (num === "2") trackName = "Track 2: Collaboration for Universal Eye Health";
      else if (num === "3") trackName = "Track 3: Impact, Equity, Sustainability and Quality in Eye Care";
      else if (num === "4") trackName = "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel";
      else if (num === "5") trackName = "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth";
      else trackName = `Track ${num}`;
    }
  }
  
  return { track: trackName, hall };
}

function mapRole(raw: string): string {
  const r = (raw || "").trim().toLowerCase();
  if (r === "chair") return "Chair";
  if (r === "co-chair") return "CoChair";
  if (r === "moderator") return "Moderator";
  if (r.startsWith("judge")) return "Judge";
  if (r.includes("discussion")) return "Discussion";
  if (r === "speaker") return "Speaker";
  if (r === "presenter") return "Presenter";
  if (r === "poster") return "Poster";
  return "Speaker";
}

function normalizeInstitution(inst: string): string {
  return inst.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace("hospital", "")
    .replace("institute", "")
    .replace("foundation", "")
    .replace("international", "")
    .replace("charity", "")
    .replace("trust", "")
    .replace("newdelhi", "")
    .replace("ludhiana", "");
}

function isInstitutionSimilar(inst1: string, inst2: string): boolean {
  const n1 = normalizeInstitution(inst1);
  const n2 = normalizeInstitution(inst2);
  if (!n1 || !n2) return false;
  return n1.includes(n2) || n2.includes(n1);
}

function areNamesSimilar(nameA: string, nameB: string): boolean {
  const normA = (nameA || "").toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/[^a-z0-9]/g, "");
  const normB = (nameB || "").toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/[^a-z0-9]/g, "");
  return normA === normB && normA.length > 0;
}

function cleanTimeRange(rawTime: string): string {
  let str = String(rawTime || "").trim().toLowerCase();
  if (!str) return "";

  const parseSingleTime = (timeStr: string, isStart = true): string => {
    timeStr = timeStr.trim();
    if (!timeStr) return "";
    
    const hasAm = timeStr.includes("am");
    const hasPm = timeStr.includes("pm");
    
    let cleanStr = timeStr.replace(/[^\d:]/g, "");
    if (!cleanStr.includes(":")) {
      cleanStr += ":00";
    }
    
    let [hoursStr, minutesStr] = cleanStr.split(":");
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;
    
    if (hasPm && hours < 12) {
      hours += 12;
    } else if (hasAm && hours === 12) {
      hours = 0;
    } else if (!hasAm && !hasPm) {
      if (hours < 9) {
        hours += 12;
      }
    }
    
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}`;
  };

  const parts = str.split(/[-–—to]/);
  if (parts.length === 2) {
    const start = parseSingleTime(parts[0], true);
    const end = parseSingleTime(parts[1], false);
    if (start && end) {
      return `${start}-${end}`;
    }
  } else if (parts.length === 1) {
    const single = parseSingleTime(parts[0], true);
    if (single) return single;
  }
  
  return rawTime;
}

function generateRegNumber(index: number): string {
  return `V2020-${String(index).padStart(5, "0")}`;
}

interface ParticipantData {
  name: string;
  email: string | null;
  mobile: string | null;
  institution: string;
}

interface AssignmentData {
  role: string;
  track: string;
  hall: string | null;
  sessionName: string | null;
  date: string | null;
  time: string | null;
  presentationTitle: string | null;
}

async function seed() {
  console.log("Starting cleaned Excel-based database seed...");

  // Read new Excel file
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List 19062026.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.error("Excel file not found at:", excelPath);
    process.exit(1);
  }
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  // Clear existing participant/assignment data
  await db.delete(assignmentsTable);
  await db.delete(participantsTable);
  console.log("Cleared existing participant/assignment data");

  // Ensure submission settings
  const [existingSettings] = await db.select().from(submissionSettingsTable).limit(1);
  if (!existingSettings) {
    await db.insert(submissionSettingsTable).values({ submissionsOpen: true, whatsappTemplate: "vision2020_otp" });
  }

  // Pre-hash default password to optimize execution speed
  console.log("Hashing default participant password...");
  const passwordHash = await bcrypt.hash("Test@1234", 10);

  // Upsert admin users
  const adminMobile = "9999900000";
  const [existingAdmin] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.mobile, adminMobile));
  if (!existingAdmin) {
    const ph = await bcrypt.hash("Admin@2026", 10);
    await db.insert(systemUsersTable).values({ empId: "EMP0000", name: "Admin", mobile: adminMobile, userType: "admin", passwordHash: ph });
    console.log("Created admin: 9999900000 / Admin@2026");
  }

  // Upsert food coordinator
  const fcMobile = "9999900001";
  const [existingFC] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.mobile, fcMobile));
  if (!existingFC) {
    const ph = await bcrypt.hash("Food@2026", 10);
    await db.insert(systemUsersTable).values({ empId: "EMP0001", name: "Food Coordinator", mobile: fcMobile, userType: "food_coordinator", passwordHash: ph });
    console.log("Created food coordinator: 9999900001 / Food@2026");
  }

  // Upsert admin user: Saravanan D
  const saravananEmp = "000038";
  const [existingSaravanan] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.empId, saravananEmp));
  if (!existingSaravanan) {
    const ph = await bcrypt.hash("Saravanan@2026", 10);
    await db.insert(systemUsersTable).values({ empId: saravananEmp, name: "Saravanan D", userType: "admin", passwordHash: ph });
    console.log("Created admin user Saravanan D — empId: 000038, password: Saravanan@2026");
  }

  // Upsert super admin user: Prabhanjan
  const prabhanjanEmp = "010177";
  const [existingPrabhanjan] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.empId, prabhanjanEmp));
  const ph = await bcrypt.hash("Sankara@123", 10);
  if (!existingPrabhanjan) {
    await db.insert(systemUsersTable).values({
      empId: prabhanjanEmp,
      name: "Prabhanjan",
      mobile: "8951568286",
      email: "prabhanjan@sankaraeye.com",
      userType: "super_admin",
      passwordHash: ph
    });
    console.log("Created super_admin user Prabhanjan — empId: 010177, password: Sankara@123");
  } else {
    await db.update(systemUsersTable).set({
      userType: "super_admin",
      mobile: "8951568286",
      email: "prabhanjan@sankaraeye.com",
      name: "Prabhanjan",
      passwordHash: ph
    }).where(eq(systemUsersTable.empId, prabhanjanEmp));
    console.log("Updated Prabhanjan to super_admin with password Sankara@123");
  }

  // Seed food sessions mapped to Day 0, Day 1, Day 2
  await db.delete(foodSessionsTable); // clean recreate always
  await db.insert(foodSessionsTable).values([
    { name: "Breakfast Day 0", date: "2026-07-10", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 0", date: "2026-07-10", startTime: "13:00", endTime: "14:00", enabled: false },
    { name: "Dinner Day 0", date: "2026-07-10", startTime: "19:00", endTime: "20:30", enabled: false },
    { name: "Breakfast Day 1", date: "2026-07-11", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 1", date: "2026-07-11", startTime: "13:00", endTime: "14:00", enabled: false },
    { name: "Dinner Day 1", date: "2026-07-11", startTime: "19:00", endTime: "20:30", enabled: false },
    { name: "Breakfast Day 2", date: "2026-07-12", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 2", date: "2026-07-12", startTime: "13:00", endTime: "14:00", enabled: false },
  ]);
  console.log("Created food sessions (Day 0, Day 1, Day 2)");

  const parsedParticipants: ParticipantData[] = [];
  const parsedAssignments: { participantIndex: number; data: AssignmentData }[] = [];
  const uniqueTracks = new Set<string>();

  // Helper to find or add participant index
  function getParticipantIndex(name: string, email: string | null, mobile: string | null, institution: string): number {
    const cleanName = name.trim();
    const cleanInst = institution.trim() || "Unknown Institution";
    const cleanEmail = email && email.trim() && !isNA(email) ? email.trim().toLowerCase() : null;
    const cleanMob = cleanMobile(mobile);

    for (let i = 0; i < parsedParticipants.length; i++) {
      const p = parsedParticipants[i];
      if (cleanEmail && p.email && p.email.toLowerCase() === cleanEmail) {
        if (!p.mobile && cleanMob) p.mobile = cleanMob;
        if (p.institution === "Unknown Institution" && cleanInst !== "Unknown Institution") p.institution = cleanInst;
        return i;
      }
      if (cleanMob && p.mobile && p.mobile === cleanMob) {
        if (!p.email && cleanEmail) p.email = cleanEmail;
        if (p.institution === "Unknown Institution" && cleanInst !== "Unknown Institution") p.institution = cleanInst;
        return i;
      }
      if (areNamesSimilar(p.name, cleanName) && isInstitutionSimilar(p.institution, cleanInst)) {
        const emailConflict = cleanEmail && p.email && cleanEmail !== p.email.toLowerCase();
        const mobileConflict = cleanMob && p.mobile && cleanMob !== p.mobile;
        if (!emailConflict && !mobileConflict) {
          if (!p.email && cleanEmail) p.email = cleanEmail;
          if (!p.mobile && cleanMob) p.mobile = cleanMob;
          if (p.institution === "Unknown Institution" && cleanInst !== "Unknown Institution") p.institution = cleanInst;
          return i;
        }
      }
    }

    parsedParticipants.push({
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMob,
      institution: cleanInst
    });
    return parsedParticipants.length - 1;
  }

  // 1. Parse Poster Sheet
  console.log("Parsing Poster sheet...");
  const posterSheet = wb.Sheets["Poster"];
  const posterRows = xlsx.utils.sheet_to_json<Record<string, any>>(posterSheet, { range: 1, defval: "" });
  if (posterRows.length > 0) {
    let nameKey = "", emailKey = "", mobileKey = "", titleKey = "", trackKey = "", orgKey = "", dateKey = "", timeKey = "";
    for (const k of Object.keys(posterRows[0])) {
      const cleanVal = k.trim().toLowerCase();
      if ((cleanVal.includes("author") || cleanVal.includes("name")) && !cleanVal.includes("email") && !cleanVal.includes("institution") && !cleanVal.includes("organization") && !cleanVal.includes("org")) nameKey = k;
      else if (cleanVal.includes("email") || cleanVal.includes("mail")) emailKey = k;
      else if (cleanVal.includes("mobile") || cleanVal.includes("phone") || cleanVal.includes("phone no") || cleanVal.includes("contact")) mobileKey = k;
      else if (cleanVal.includes("title") || cleanVal.includes("topic") || cleanVal.includes("paper")) titleKey = k;
      else if (cleanVal.includes("track")) trackKey = k;
      else if (cleanVal.includes("organization") || cleanVal.includes("org") || cleanVal.includes("institution") || cleanVal.includes("organisation")) orgKey = k;
      else if (cleanVal.includes("date")) dateKey = k;
      else if (cleanVal.includes("time") || cleanVal.includes("timing") || cleanVal.includes("slot")) timeKey = k;
    }

    for (let i = 0; i < posterRows.length; i++) {
      const row = posterRows[i];
      const name = nameKey ? String(row[nameKey] || "").trim() : "";
      if (!name) continue;
      const email = emailKey ? String(row[emailKey] || "").trim() : "";
      const mobile = mobileKey ? String(row[mobileKey] || "").trim() : "";
      const title = titleKey ? String(row[titleKey] || "").trim() : "";
      const trackNum = trackKey ? String(row[trackKey] || "").trim() : "";
      const org = orgKey ? String(row[orgKey] || "").trim() : "";
      const date = dateKey ? parseExcelDate(row[dateKey]) : null;
      const time = timeKey ? cleanTimeRange(String(row[timeKey] || "")) : null;

      const { track: trackMapped, hall: posterHall } = parseTrackAndHall(trackNum);
      uniqueTracks.add(trackMapped);

      const idx = getParticipantIndex(name, email, mobile, org);
      parsedAssignments.push({
        participantIndex: idx,
        data: {
          role: "Poster",
          track: trackMapped,
          hall: posterHall,
          sessionName: "Poster Presentation",
          date,
          time,
          presentationTitle: title || null
        }
      });
    }
  }

  // 2. Parse Track Sheet
  console.log("Parsing Track sheet...");
  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });
  for (const row of trackRows) {
    const name = String(row["Name"] || "").trim();
    if (!name) continue;
    const email = String(row["EMAIL"] || "").trim();
    const mobile = String(row["Phone No"] || "").trim();
    const org = String(row["Organisation"] || "").trim();
    const date = parseExcelDate(row["Date"]);
    const { track, hall } = parseTrackAndHall(row["Track"]);
    const timing = cleanTimeRange(String(row["Timing"] || ""));
    const sessionName = String(row["Session Toppic"] || row["Session"] || "").trim();
    const topic = String(row["Topic"] || "").trim();

    uniqueTracks.add(track);

    const idx = getParticipantIndex(name, email, mobile, org);
    parsedAssignments.push({
      participantIndex: idx,
      data: {
        role: track.toLowerCase().includes("track 5") ? "Presenter" : "Speaker",
        track,
        hall,
        sessionName: sessionName || null,
        date,
        time: timing || null,
        presentationTitle: topic || null
      }
    });
  }

  // 3. Parse Chair-Co-Chair Sheet
  console.log("Parsing Chair-Co-Chair sheet...");
  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });
  for (const row of chairRows) {
    const rawRole = String(row["Role"] || "").trim();
    const role = mapRole(rawRole);
    if (["Course Name", "Course Objective", "Theme"].includes(rawRole)) continue;

    const name = String(row["Name_1"] || row["Name"] || "").split(",")[0].trim();
    if (!name) continue;
    const email = String(row["email"] || "").trim();
    const org = String(row["Organization"] || "").trim();
    const date = parseExcelDate(row["Date"]);
    const { track, hall } = parseTrackAndHall(row["Track"]);
    const time = cleanTimeRange(String(row["Time"] || ""));
    const topicHeading = String(row["Topic Heading"] || "").trim();
    const topicVal = String(row["Topic"] || "").trim();
    let topic = topicHeading || topicVal;

    const nameClean = name.toLowerCase().trim();
    const orgClean = org.toLowerCase().trim();
    const topicLower = topicVal.toLowerCase().trim();

    if (!topicHeading && topicLower && (topicLower.includes(nameClean) || (orgClean && topicLower.includes(orgClean)) || topicLower.includes(","))) {
      topic = "";
    }

    const session = String(row["Session"] || "").trim();

    uniqueTracks.add(track);

    const idx = getParticipantIndex(name, email, null, org);
    parsedAssignments.push({
      participantIndex: idx,
      data: {
        role,
        track,
        hall,
        sessionName: session || topic || null,
        date,
        time: time || null,
        presentationTitle: topic || null
      }
    });
  }

  console.log(`Deduplicated into ${parsedParticipants.length} unique participants.`);

  // Insert participants and build ID lookup map
  console.log("Inserting participants into database...");
  const participantIds: number[] = [];
  for (let i = 0; i < parsedParticipants.length; i++) {
    const p = parsedParticipants[i];
    const regNum = generateRegNumber(i + 1);

    const [dbParticipant] = await db.insert(participantsTable).values({
      registrationNumber: regNum,
      name: p.name,
      cleanName: getCleanName(p.name),
      email: p.email,
      mobile: p.mobile,
      institution: p.institution,
      passwordHash: null
    }).returning();

    participantIds.push(dbParticipant.id);
  }

  console.log("Inserting assignments...");
  for (const item of parsedAssignments) {
    const dbParticipantId = participantIds[item.participantIndex];
    await db.insert(assignmentsTable).values({
      participantId: dbParticipantId,
      role: item.data.role,
      track: item.data.track,
      sessionName: item.data.sessionName,
      hall: item.data.hall,
      date: item.data.date,
      time: item.data.time,
      presentationTitle: item.data.presentationTitle
    });
  }

  // Create track coordinator system users for each unique track
  let coordMobile = 9999900010;
  const trackList = [...uniqueTracks].sort();
  console.log("Creating track coordinators...");
  for (const track of trackList) {
    const mobile = String(coordMobile++);
    const [existing] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.mobile, mobile));
    if (!existing) {
      const ph = await bcrypt.hash("Coord@2026", 10);
      
      const shortTrackMatch = track.match(/Track\s*\d+/i);
      const shortTrack = shortTrackMatch ? shortTrackMatch[0] : track;
      const coordName = `Coordinator ${shortTrack}`;
      const empId = `EMP_COORD_${shortTrack.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

      await db.insert(systemUsersTable).values({
        empId,
        name: coordName,
        mobile,
        userType: "track_coordinator",
        passwordHash: ph,
        assignedTrack: track,
      });
    }
  }

  console.log(`\nDatabase Seeding Complete!`);
  console.log("Participants created:", parsedParticipants.length);
  console.log("Assignments created:", parsedAssignments.length);
  console.log("Tracks found:", trackList.join(", "));
  console.log(`\nTest credentials:`);
  console.log(`  Admin:           9999900000 / Admin@2026`);
  console.log(`  Food Coord:      9999900001 / Food@2026`);
  console.log(`  Track Coords:    9999900010+ / Coord@2026`);
  console.log(`  All Participants: OTP login via email on first access (then prompts password setup)`);
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
