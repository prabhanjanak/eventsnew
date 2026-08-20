import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const digits = String(mobile).replace(/[^0-9]/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits || null;
}

function parseTrackAndHall(rawTrack: string | number): { track: string; hall: string | null } {
  const t = String(rawTrack || "").trim();
  if (!t) return { track: "General", hall: null };
  return { track: t, hall: null };
}

interface RawRow {
  name: string;
  email: string | null;
  mobile: string | null;
  institution: string;
  sheet: string;
}

async function main() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const rows: RawRow[] = [];

  // 1. Poster
  const posterSheet = wb.Sheets["Poster"];
  const posterRows = xlsx.utils.sheet_to_json<Record<string, any>>(posterSheet, { defval: "" });
  if (posterRows.length > 0) {
    const headerRow = posterRows[0];
    let nameKey = "", emailKey = "", mobileKey = "", orgKey = "";
    for (const [k, v] of Object.entries(headerRow)) {
      const cleanVal = String(v).trim().toLowerCase();
      if (cleanVal.includes("presenting author") && !cleanVal.includes("email")) nameKey = k;
      else if (cleanVal.includes("email")) emailKey = k;
      else if (cleanVal.includes("mobile")) mobileKey = k;
      else if (cleanVal.includes("organization")) orgKey = k;
    }
    for (let i = 1; i < posterRows.length; i++) {
      const r = posterRows[i];
      const name = String(r[nameKey] || "").trim();
      if (!name) continue;
      rows.push({
        name,
        email: String(r[emailKey] || "").trim() || null,
        mobile: String(r[mobileKey] || "").trim() || null,
        institution: String(r[orgKey] || "").trim(),
        sheet: "Poster"
      });
    }
  }

  // 2. Track
  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });
  for (const r of trackRows) {
    const name = String(r["Name"] || "").trim();
    if (!name) continue;
    if (name === "Roche" || name === "IAPB Team") continue;
    rows.push({
      name,
      email: String(r["EMAIL"] || "").trim() || null,
      mobile: String(r["Phone No"] || "").trim() || null,
      institution: String(r["Organisation"] || "").trim(),
      sheet: "Track"
    });
  }

  // 3. Chair-Co-Chair
  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });
  for (const r of chairRows) {
    const rawRole = String(r["Role"] || "").trim();
    if (["Course Name", "Course Objective", "Theme"].includes(rawRole)) continue;
    const name = String(r["Name_1"] || r["Name"] || "").split(",")[0].trim();
    if (!name) continue;
    rows.push({
      name,
      email: String(r["email"] || "").trim() || null,
      mobile: null,
      institution: String(r["Organization"] || "").trim(),
      sheet: "Chair-Co-Chair"
    });
  }

  console.log("Total raw rows loaded:", rows.length);

  // Now, let's try different grouping keys
  // Let's print out the number of unique entries for each strategy
  
  // Strategy A: exact name + exact email (if present) + exact mobile (if present)
  // Let's do a logic where two entries are considered the same if their names match AND they have a common identifier (email/mobile) or similar name/institution
  
  // Let's test a simple grouping where we merge if:
  // cleanName matches exactly
  // What is the unique count of names?
  const uniqueNames = new Set(rows.map(r => r.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "")));
  console.log("Unique names (without prefixes):", uniqueNames.size);

  // Let's try to group them using a standard deduplication loop and print the final count
  for (const simThreshold of [0, 1, 2]) {
    const uniqueList: RawRow[] = [];
    for (const row of rows) {
      const cleanName = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
      const cleanInst = row.institution.trim().toLowerCase();
      const cleanMob = cleanMobile(row.mobile);
      const cleanEmail = row.email?.trim().toLowerCase() || null;

      let foundIndex = -1;
      for (let i = 0; i < uniqueList.length; i++) {
        const u = uniqueList[i];
        const uName = u.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
        const uInst = u.institution.trim().toLowerCase();
        const uMob = cleanMobile(u.mobile);
        const uEmail = u.email?.trim().toLowerCase() || null;

        // Condition
        if (cleanName === uName) {
          if (simThreshold === 0) {
            // merge if names match exactly
            foundIndex = i;
            break;
          } else if (simThreshold === 1) {
            // merge if names match exactly and institutions are somewhat similar or one is empty
            if (!uInst || !cleanInst || uInst.includes(cleanInst) || cleanInst.includes(uInst)) {
              foundIndex = i;
              break;
            }
          } else if (simThreshold === 2) {
            // merge if names match exactly and (either email matches, or mobile matches, or institutions are somewhat similar)
            const emailMatch = cleanEmail && uEmail && cleanEmail === uEmail;
            const mobMatch = cleanMob && uMob && cleanMob === uMob;
            const instMatch = !uInst || !cleanInst || uInst.includes(cleanInst) || cleanInst.includes(uInst);
            if (emailMatch || mobMatch || instMatch) {
              foundIndex = i;
              break;
            }
          }
        }
      }

      if (foundIndex === -1) {
        uniqueList.push(row);
      } else {
        // merge fields
        if (!uniqueList[foundIndex].email && cleanEmail) uniqueList[foundIndex].email = cleanEmail;
        if (!uniqueList[foundIndex].mobile && cleanMob) uniqueList[foundIndex].mobile = cleanMob;
        if (!uniqueList[foundIndex].institution && row.institution) uniqueList[foundIndex].institution = row.institution;
      }
    }
    console.log(`SimThreshold ${simThreshold} yields: ${uniqueList.length} unique participants`);
  }
}

main();
