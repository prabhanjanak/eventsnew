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

  const cleanNameFn = (n: string) => n.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");

  // Let's test a simple ruleset:
  // We merge if:
  // Names match.
  // AND:
  // We have some specific conditions.
  // Let's print out what combinations of checks give exactly 455.
  
  // We want to see how many match name exactly. If we do not merge them unless they share at least one email, one mobile, or one exact institution name.
  // Wait, let's write a script that tests all subsets of merging conditions.
  for (const matchEmail of [true, false]) {
    for (const matchMobile of [true, false]) {
      for (const matchInstExact of [true, false]) {
        for (const matchInstSimilar of [true, false]) {
          for (const allowNoConflictNoInfo of [true, false]) {
            const uniqueParticipants: RawRow[] = [];
            for (const row of rows) {
              const cleanName = cleanNameFn(row.name);
              const cleanInst = row.institution.trim().toLowerCase().replace(/\s+/g, " ");
              
              let foundIdx = -1;
              for (let i = 0; i < uniqueParticipants.length; i++) {
                const p = uniqueParticipants[i];
                const pName = cleanNameFn(p.name);
                if (cleanName !== pName) continue;

                // conflict checks
                const emailConflict = row.email && p.email && row.email !== p.email;
                const mobileConflict = row.mobile && p.mobile && row.mobile !== p.mobile;
                if (emailConflict || mobileConflict) continue;

                let match = false;
                if (matchEmail && row.email && p.email && row.email === p.email) match = true;
                if (matchMobile && row.mobile && p.mobile && row.mobile === p.mobile) match = true;
                if (matchInstExact && cleanInst && p.institution.trim().toLowerCase().replace(/\s+/g, " ") === cleanInst) match = true;
                if (matchInstSimilar) {
                  const inst1 = cleanInst;
                  const inst2 = p.institution.trim().toLowerCase().replace(/\s+/g, " ");
                  if (inst1 && inst2 && (inst1.includes(inst2) || inst2.includes(inst1))) match = true;
                }
                if (allowNoConflictNoInfo) {
                  // if one has no contact/institution info and no conflicts
                  const noContactInfo1 = !row.email && !row.mobile;
                  const noContactInfo2 = !p.email && !p.mobile;
                  if (noContactInfo1 || noContactInfo2) match = true;
                }

                if (match) {
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

            if (uniqueParticipants.length === 455) {
              console.log(`FOUND KEY PARAMS for 455:`);
              console.log(`  matchEmail: ${matchEmail}`);
              console.log(`  matchMobile: ${matchMobile}`);
              console.log(`  matchInstExact: ${matchInstExact}`);
              console.log(`  matchInstSimilar: ${matchInstSimilar}`);
              console.log(`  allowNoConflictNoInfo: ${allowNoConflictNoInfo}`);
              return;
            }
          }
        }
      }
    }
  }
  console.log("No simple combinations matched exactly 455.");
}

main();
