import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (str.includes("day 0") || str.includes("10th")) return "2026-07-10";
  if (str.includes("day 1") || str.includes("11th")) return "2026-07-11";
  if (str.includes("day 2") || str.includes("12th")) return "2026-07-12";
  return "2026-07-10";
}

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const digits = String(mobile).replace(/[^0-9]/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

function mapRole(raw: string): string {
  const r = (raw || "").trim().toLowerCase();
  if (r === "chair") return "Chair";
  if (r === "co-chair") return "Co-Chair";
  if (r === "moderator") return "Moderator";
  if (r.startsWith("judge")) return "Judge";
  if (r === "speaker") return "Speaker";
  if (r === "presenter") return "Presenter";
  if (r === "poster") return "Poster";
  return "Speaker";
}

async function inspect() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  let posterRolesCount = 0;
  let trackRolesCount = 0;
  let chairRolesCount = 0;

  const rolesFound: Record<string, number> = {};
  const tracksFound: Record<string, number> = {};

  const posterSheet = wb.Sheets["Poster"];
  const posterRows = xlsx.utils.sheet_to_json<Record<string, any>>(posterSheet, { defval: "" });
  
  // Let's inspect poster rows
  if (posterRows.length > 0) {
    const headerRow = posterRows[0];
    let nameKey = "", emailKey = "", mobileKey = "", titleKey = "", trackKey = "", orgKey = "";
    for (const [k, v] of Object.entries(headerRow)) {
      const cleanVal = String(v).trim().toLowerCase();
      if (cleanVal.includes("presenting author") && !cleanVal.includes("email")) nameKey = k;
      else if (cleanVal.includes("email")) emailKey = k;
      else if (cleanVal.includes("mobile")) mobileKey = k;
      else if (cleanVal.includes("title")) titleKey = k;
      else if (cleanVal.includes("track")) trackKey = k;
      else if (cleanVal.includes("organization")) orgKey = k;
    }

    for (let i = 1; i < posterRows.length; i++) {
      const row = posterRows[i];
      const name = String(row[nameKey] || "").trim();
      if (!name) continue;
      posterRolesCount++;
      rolesFound["Poster"] = (rolesFound["Poster"] || 0) + 1;
      
      const trackNum = String(row[trackKey] || "").trim();
      tracksFound[`Track ${trackNum}`] = (tracksFound[`Track ${trackNum}`] || 0) + 1;
    }
  }

  // Parse Track Sheet
  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });
  for (const row of trackRows) {
    const name = String(row["Name"] || "").trim();
    if (!name) continue;
    trackRolesCount++;
    rolesFound["Speaker"] = (rolesFound["Speaker"] || 0) + 1;
    
    const track = String(row["Track"] || "").trim();
    tracksFound[track] = (tracksFound[track] || 0) + 1;
  }

  // Parse Chair-Co-Chair Sheet
  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });
  for (const row of chairRows) {
    const rawRole = String(row["Role"] || "").trim();
    if (["Course Name", "Course Objective", "Theme"].includes(rawRole)) continue;

    const name = String(row["Name_1"] || row["Name"] || "").split(",")[0].trim();
    if (!name) continue;
    chairRolesCount++;
    const role = mapRole(rawRole);
    rolesFound[role] = (rolesFound[role] || 0) + 1;
    
    const track = String(row["Track"] || "").trim();
    tracksFound[track] = (tracksFound[track] || 0) + 1;
  }

  console.log("Poster count:", posterRolesCount);
  console.log("Track count:", trackRolesCount);
  console.log("Chair/Co-Chair count:", chairRolesCount);
  console.log("Total count of roles parsed:", posterRolesCount + trackRolesCount + chairRolesCount);
  console.log("Roles breakdown:", rolesFound);
  console.log("Tracks breakdown:", tracksFound);
}

inspect();
