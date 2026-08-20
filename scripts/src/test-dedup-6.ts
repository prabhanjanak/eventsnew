import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const digits = String(mobile).replace(/[^0-9]/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^([0-9])\1{9}$/.test(last10)) return null;
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

  // Group by: name and exact/normalized institution similarity
  // Let's test a strategy where we only merge if:
  // Names match (ignoring prefixes).
  // AND:
  // - Either they have matching email or matching mobile.
  // - OR their institutions are similar AND they don't have conflicting email/mobile.
  // Wait, let's write a loop testing various rules:

  const normalizeInst = (inst: string) => {
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
  };

  const isInstitutionSimilar = (inst1: string, inst2: string) => {
    const n1 = normalizeInst(inst1);
    const n2 = normalizeInst(inst2);
    if (!n1 || !n2) return false;
    return n1.includes(n2) || n2.includes(n1);
  };

  const runTest = (rule: (row: RawRow, p: RawRow) => boolean) => {
    const uniqueParticipants: RawRow[] = [];
    for (const row of rows) {
      let foundIdx = -1;
      for (let i = 0; i < uniqueParticipants.length; i++) {
        if (rule(row, uniqueParticipants[i])) {
          foundIdx = i;
          break;
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
    return uniqueParticipants;
  };

  // Rule 1: Names match, and (email match or mobile match or (institution similar and not conflict))
  const u1 = runTest((row, p) => {
    const n1 = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    const n2 = p.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    if (n1 !== n2) return false;

    const emailConflict = row.email && p.email && row.email !== p.email;
    const mobileConflict = row.mobile && p.mobile && row.mobile !== p.mobile;
    if (emailConflict || mobileConflict) return false;

    const emailMatch = row.email && p.email && row.email === p.email;
    const mobileMatch = row.mobile && p.mobile && row.mobile === p.mobile;
    const instMatch = isInstitutionSimilar(row.institution, p.institution);
    const eitherEmptyInst = !row.institution || row.institution.toLowerCase() === "unknown institution" || !p.institution || p.institution.toLowerCase() === "unknown institution";

    return !!(emailMatch || mobileMatch || instMatch || eitherEmptyInst);
  });
  console.log(`Rule 1 count: ${u1.length}`);

  // Rule 2: Names match, and (email match or mobile match or (institution similar - strictly no empty-inst fallback unless name+email/mob matches))
  const u2 = runTest((row, p) => {
    const n1 = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    const n2 = p.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    if (n1 !== n2) return false;

    const emailConflict = row.email && p.email && row.email !== p.email;
    const mobileConflict = row.mobile && p.mobile && row.mobile !== p.mobile;
    if (emailConflict || mobileConflict) return false;

    const emailMatch = row.email && p.email && row.email === p.email;
    const mobileMatch = row.mobile && p.mobile && row.mobile === p.mobile;
    const instMatch = isInstitutionSimilar(row.institution, p.institution);

    return !!(emailMatch || mobileMatch || instMatch);
  });
  console.log(`Rule 2 count: ${u2.length}`);

  // Rule 3: Names match, and (email match or mobile match or (exact institution match - no similarity))
  const u3 = runTest((row, p) => {
    const n1 = row.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    const n2 = p.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    if (n1 !== n2) return false;

    const emailConflict = row.email && p.email && row.email !== p.email;
    const mobileConflict = row.mobile && p.mobile && row.mobile !== p.mobile;
    if (emailConflict || mobileConflict) return false;

    const emailMatch = row.email && p.email && row.email === p.email;
    const mobileMatch = row.mobile && p.mobile && row.mobile === p.mobile;
    
    const inst1 = row.institution.trim().toLowerCase().replace(/\s+/g, " ");
    const inst2 = p.institution.trim().toLowerCase().replace(/\s+/g, " ");
    const instMatch = inst1 && inst2 && inst1 === inst2;

    return !!(emailMatch || mobileMatch || instMatch);
  });
  console.log(`Rule 3 count: ${u3.length}`);

  // Let's test a custom rule targeting exactly 455
  // If we group by name + similar institution, and also merge if email matches or mobile matches, we get 463.
  // Wait! Let's print out what are the 8 differences between Rule 2 (which is 462) and 455!
}

main();
