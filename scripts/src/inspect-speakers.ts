import * as xlsx from "xlsx";
import fs from "fs";
import path from "url";
import { fileURLToPath } from "url";

const __dirname = ""; // dummy

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  console.log("Total track rows:", trackRows.length);
  let emptyNameCount = 0;
  let validNameCount = 0;
  for (const [i, row] of trackRows.entries()) {
    const name = String(row["Name"] || "").trim();
    if (!name) {
      emptyNameCount++;
      console.log(`[Row ${i + 2}] is empty name! Date: "${row.Date}" Track: "${row.Track}" Topic: "${row.Topic}"`);
    } else {
      validNameCount++;
    }
  }
  console.log("Empty name count:", emptyNameCount);
  console.log("Valid name count:", validNameCount);
}

inspect();
