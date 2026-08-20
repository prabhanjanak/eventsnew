import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const digits = String(mobile).replace(/[^0-9]/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

function cleanEmail(email: any): string | null {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!e || e.includes("n/a") || e.includes("#n/a") || e === "na" || e === "null" || e === "undefined" || e === "-" || e === "no email" || e.includes("none")) {
    return null;
  }
  return e;
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
        email: cleanEmail(r[emailKey]),
        mobile: cleanMobile(r[mobileKey]),
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
      email: cleanEmail(r["EMAIL"]),
      mobile: cleanMobile(r["Phone No"]),
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
      email: cleanEmail(r["email"]),
      mobile: null,
      institution: String(r["Organization"] || "").trim(),
      sheet: "Chair-Co-Chair"
    });
  }

  // Grouping: merge only on name + (email match or mobile match). 
  // If they don't have matching email/mobile, they are NOT merged.
  const uniqueParticipants: RawRow[] = [];
  for (const row of rows) {
    const cleanName = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");

    let foundIdx = -1;
    for (let i = 0; i < uniqueParticipants.length; i++) {
      const p = uniqueParticipants[i];
      const pName = p.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");

      if (cleanName === pName) {
        // If emails match
        if (row.email && p.email && row.email === p.email) {
          foundIdx = i;
          break;
        }
        // If mobile matches
        if (row.mobile && p.mobile && row.mobile === p.mobile) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx === -1) {
      uniqueParticipants.push(row);
    } else {
      if (!uniqueParticipants[foundIdx].email && row.email) uniqueParticipants[foundIdx].email = row.email;
      if (!uniqueParticipants[foundIdx].mobile && row.mobile) uniqueParticipants[foundIdx].mobile = row.mobile;
      if ((!uniqueParticipants[foundIdx].institution || uniqueParticipants[foundIdx].institution.toLowerCase() === "unknown institution") && row.institution) {
        uniqueParticipants[foundIdx].institution = row.institution;
      }
    }
  }

  console.log("Count with contacts-only matching:", uniqueParticipants.length);
}

main();
