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

  // Group by: name (cleaned) and exact institution (cleaned)
  const map = new Map<string, RawRow[]>();
  for (const r of rows) {
    const cleanName = r.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    const cleanInst = r.institution.trim().toLowerCase().replace(/\s+/g, " ");
    const key = `${cleanName}|${cleanInst}`;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(r);
  }

  console.log("Grouping by name + exact institution: total =", map.size);

  // Group by: name (cleaned) and similar institution (normalized)
  // Let's normalize the institution name (e.g. mapping similar ones)
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

  const simMap = new Map<string, RawRow[]>();
  for (const r of rows) {
    const cleanName = r.name.trim().toLowerCase().replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "").replace(/\s+/g, " ");
    const normInst = normalizeInst(r.institution);
    
    // Find if there is an entry with the same cleanName and similar normInst
    let key = `${cleanName}|${normInst}`;
    let found = false;
    for (const k of simMap.keys()) {
      const [kName, kInst] = k.split("|");
      if (kName === cleanName) {
        if (!normInst || !kInst || kInst.includes(normInst) || normInst.includes(kInst)) {
          key = k;
          found = true;
          break;
        }
      }
    }
    if (!simMap.has(key)) {
      simMap.set(key, []);
    }
    simMap.get(key)!.push(r);
  }
  console.log("Grouping by name + similar institution: total =", simMap.size);
}

main();
