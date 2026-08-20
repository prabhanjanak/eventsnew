import { db, participantsTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isNA(val: any): boolean {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return ["na", "n/a", "n.a.", "#n/a", "nil", "none", "null", "undefined", "-"].includes(s);
}

function cleanMobileNumber(mobile: any): string | null {
  if (!mobile || isNA(mobile)) return null;
  
  let s = String(mobile).trim();
  if (s.toLowerCase().includes("e")) {
    const num = Number(s);
    if (!isNaN(num)) s = String(Math.round(num));
  }
  if (s.includes(".")) {
    s = s.split(".")[0];
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}

// Clean helper to match names even with titles or trailing spaces
function getCleanMatchName(name: string): string {
  let clean = name.trim();
  clean = clean.replace(/\(.*?\)/g, ""); // Remove parentheses content
  
  const parts = clean.split(/[,\-]/);
  clean = parts[0];
  
  const dotParts = clean.split(/\.\s+/);
  if (dotParts.length > 1 && dotParts[0].length > 3) {
    clean = dotParts[0];
  }
  
  return clean.trim()
    .toLowerCase()
    .replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs|col\.|col)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}


interface SheetSource {
  filePath: string;
  tabName: string;
  nameCol: string;
  emailCol: string;
  phoneCols: string[];
}

const SOURCES: SheetSource[] = [
  {
    filePath: path.resolve(__dirname, "../../Scientific Program Schedule -20 AC 25062026.xlsx"),
    tabName: "Speakers Directory",
    nameCol: "Name",
    emailCol: "Email id",
    phoneCols: ["Phone"],
  },
  {
    filePath: path.resolve(__dirname, "../../Vision 2020 Session List 19062026.xlsx"),
    tabName: "Summary",
    nameCol: "Name",
    emailCol: "email",
    // "Mobile Numer" is a typo in the source Excel file; handle both spellings
    phoneCols: ["Mobile Numer", "Mobile Number", "Mobile", "Phone No", "Phone"],
  },
];

async function syncFromSource(
  source: SheetSource,
  allParticipants: typeof participantsTable.$inferSelect[],
  stats: { updated: number; skipped: number; notFound: number }
) {
  const { filePath, tabName, nameCol, emailCol, phoneCols } = source;

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath} — skipping.`);
    return;
  }

  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[tabName];
  if (!sheet) {
    console.log(`⚠️  Tab "${tabName}" not found in ${path.basename(filePath)} — skipping.`);
    return;
  }

  const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  console.log(`\n[${path.basename(filePath)} → ${tabName}] Loaded ${rows.length} rows.`);

  for (const row of rows) {
    const rawName = String(row[nameCol] || "").trim();
    if (!rawName) continue;

    const rawEmail = String(row[emailCol] || "").trim().toLowerCase();
    const email = isNA(rawEmail) ? "" : rawEmail;

    // Pick the first non-empty phone column
    let phone = "";
    for (const col of phoneCols) {
      const val = row[col];
      if (val !== undefined && val !== "" && !isNA(val)) {
        phone = String(val).trim();
        break;
      }
    }

    const cleanedMobile = cleanMobileNumber(phone);
    if (!cleanedMobile && !email) continue;

    const cleanSearchName = getCleanMatchName(rawName);

    const matchedParticipant = allParticipants.find(p => {
      const dbCleanName = getCleanMatchName(p.name);
      const dbEmail = p.email?.toLowerCase().trim();
      const sheetEmail = email.toLowerCase().trim();
      const emailMatches =
        dbEmail && sheetEmail && (dbEmail.startsWith(sheetEmail) || sheetEmail.startsWith(dbEmail));
      return dbCleanName === cleanSearchName || emailMatches;
    });

    if (matchedParticipant) {
      const updates: Record<string, any> = {};
      if (cleanedMobile && cleanedMobile !== matchedParticipant.mobile) {
        updates.mobile = cleanedMobile;
      }
      if (email && email !== matchedParticipant.email?.toLowerCase()) {
        updates.email = email;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await db
            .update(participantsTable)
            .set(updates)
            .where(eq(participantsTable.id, matchedParticipant.id));

          // Update in-memory cache so the next source doesn't re-match stale data
          const idx = allParticipants.findIndex(p => p.id === matchedParticipant.id);
          if (idx !== -1) {
            if (updates.mobile) allParticipants[idx].mobile = updates.mobile;
            if (updates.email) allParticipants[idx].email = updates.email;
          }

          console.log(`  ✅ Updated [${matchedParticipant.name}] (Reg: ${matchedParticipant.registrationNumber}):`, updates);
          stats.updated++;
        } catch (err: any) {
          if (err.message?.includes("unique constraint") || err.code === "23505") {
            console.log(`  ⚠️  Skipped [${matchedParticipant.name}]: Mobile ${cleanedMobile} already in use.`);
          } else {
            console.error(`  ❌ Failed [${matchedParticipant.name}]:`, err.message);
          }
          stats.skipped++;
        }
      }
    } else {
      console.log(`  ⚠️  No match: "${rawName}" (${email})`);
      stats.notFound++;
    }
  }
}

async function run() {
  console.log("Loading all delegate participants from database...");
  const allParticipants = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.delegateType, "delegate"));
  console.log(`Loaded ${allParticipants.length} delegates.`);

  const stats = { updated: 0, skipped: 0, notFound: 0 };

  for (const source of SOURCES) {
    await syncFromSource(source, allParticipants, stats);
  }

  console.log(`\nSync finished!`);
  console.log(`- Updated: ${stats.updated} profiles with real mobile numbers/emails.`);
  console.log(`- Skipped due to duplicates/conflicts: ${stats.skipped}`);
  console.log(`- Matches not found in database: ${stats.notFound}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Sync script failed:", err);
  process.exit(1);
});
