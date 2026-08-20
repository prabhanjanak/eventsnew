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

interface RawRow {
  name: string;
  email: string | null;
  mobile: string | null;
  institution: string;
  sheet: string;
  rowIdx: number;
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
        sheet: "Poster",
        rowIdx: i + 2
      });
    }
  }

  // 2. Track
  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });
  for (const [idx, r] of trackRows.entries()) {
    const name = String(r["Name"] || "").trim();
    if (!name) continue;
    if (name === "Roche" || name === "IAPB Team") continue;
    rows.push({
      name,
      email: String(r["EMAIL"] || "").trim() || null,
      mobile: String(r["Phone No"] || "").trim() || null,
      institution: String(r["Organisation"] || "").trim(),
      sheet: "Track",
      rowIdx: idx + 2
    });
  }

  // 3. Chair-Co-Chair
  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });
  for (const [idx, r] of chairRows.entries()) {
    const rawRole = String(r["Role"] || "").trim();
    if (["Course Name", "Course Objective", "Theme"].includes(rawRole)) continue;
    const name = String(r["Name_1"] || r["Name"] || "").split(",")[0].trim();
    if (!name) continue;
    rows.push({
      name,
      email: String(r["email"] || "").trim() || null,
      mobile: null,
      institution: String(r["Organization"] || "").trim(),
      sheet: "Chair-Co-Chair",
      rowIdx: idx + 2
    });
  }

  // Find all names that appear more than once (case-insensitive, ignoring prefix)
  const nameGroups = new Map<string, RawRow[]>();
  for (const r of rows) {
    const cleanName = r.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
    if (!nameGroups.has(cleanName)) {
      nameGroups.set(cleanName, []);
    }
    nameGroups.get(cleanName)!.push(r);
  }

  console.log("Groups with multiple rows for the same name:");
  for (const [name, group] of nameGroups.entries()) {
    if (group.length > 1) {
      console.log(`\nName: "${group[0].name}" (Clean: "${name}")`);
      for (const r of group) {
        console.log(`  - Sheet: ${r.sheet} Row: ${r.rowIdx} Name: "${r.name}" Email: "${r.email}" Mobile: "${r.mobile}" Inst: "${r.institution}"`);
      }
    }
  }
}

main();
