import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const digits = String(mobile).replace(/[^0-9]/g, "");
  // Ignore placeholders like 0, 0000000000, 9999999999, etc.
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^([0-9])\1{9}$/.test(last10)) return null; // e.g. 9999999999
    return last10;
  }
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

function normalizeInst(inst: string): string {
  return inst.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace("hospital", "")
    .replace("institute", "")
    .replace("foundation", "")
    .replace("international", "")
    .replace("charity", "")
    .replace("trust", "")
    .replace("newdelhi", "")
    .replace("ludhiana", "")
    .trim();
}

function isInstitutionSimilar(inst1: string, inst2: string): boolean {
  const n1 = normalizeInst(inst1);
  const n2 = normalizeInst(inst2);
  if (!n1 || !n2) return false;
  return n1.includes(n2) || n2.includes(n1);
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

  console.log("Total raw rows:", rows.length);

  // Grouping
  const uniqueParticipants: RawRow[] = [];
  for (const row of rows) {
    const cleanName = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
    const cleanInst = row.institution.trim();
    const cleanMob = row.mobile;
    const cleanE = row.email;

    let foundIdx = -1;
    for (let i = 0; i < uniqueParticipants.length; i++) {
      const p = uniqueParticipants[i];
      const pName = p.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
      
      // Check email match
      if (cleanE && p.email && cleanE === p.email) {
        foundIdx = i;
        break;
      }
      // Check mobile match
      if (cleanMob && p.mobile && cleanMob === p.mobile) {
        foundIdx = i;
        break;
      }
      // Check name + institution match
      if (cleanName === pName && isInstitutionSimilar(cleanInst, p.institution)) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx === -1) {
      uniqueParticipants.push(row);
    } else {
      if (!uniqueParticipants[foundIdx].email && cleanE) uniqueParticipants[foundIdx].email = cleanE;
      if (!uniqueParticipants[foundIdx].mobile && cleanMob) uniqueParticipants[foundIdx].mobile = cleanMob;
      if (uniqueParticipants[foundIdx].institution === "Unknown Institution" && cleanInst !== "Unknown Institution") {
        uniqueParticipants[foundIdx].institution = cleanInst;
      }
    }
  }

  console.log("Deduplicated total participants:", uniqueParticipants.length);
}

main();
