import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });

  console.log("Chair-Co-Chair rows total:", chairRows.length);
  for (const [i, row] of chairRows.entries()) {
    const rawRole = String(row["Role"] || "").trim();
    if (["Course Name", "Course Objective", "Theme"].includes(rawRole)) continue;
    const name = String(row["Name_1"] || row["Name"] || "").split(",")[0].trim();
    const track = String(row["Track"] || "").trim();
    if (track === "Track 1" || track === "Track 2") {
      console.log(`[Row ${i + 2}] Track: "${track}" Role: "${rawRole}" Name: "${name}" Topic: "${row.Topic || row["Topic Heading"]}"`);
    }
  }
}

inspect();
