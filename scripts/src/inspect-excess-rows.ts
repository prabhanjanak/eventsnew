import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function inspect() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  // Let's print all names from Track sheet where Track is Track 1 or Track 2
  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  console.log("--- Track Sheet Track 1 rows: ---");
  let t1Count = 0;
  for (const [idx, row] of trackRows.entries()) {
    if (String(row.Track).trim() === "Track 1") {
      t1Count++;
      const name = String(row.Name || "").trim();
      const topic = String(row.Topic || "").trim();
      console.log(`[Row ${idx + 2}] Name: "${name}" Topic: "${topic.substring(0, 40)}"`);
    }
  }
  console.log(`Total Track 1 rows in Track sheet: ${t1Count}`);

  console.log("\n--- Track Sheet Track 2 rows: ---");
  let t2Count = 0;
  for (const [idx, row] of trackRows.entries()) {
    if (String(row.Track).trim() === "Track 2") {
      t2Count++;
      const name = String(row.Name || "").trim();
      const topic = String(row.Topic || "").trim();
      console.log(`[Row ${idx + 2}] Name: "${name}" Topic: "${topic.substring(0, 40)}"`);
    }
  }
  console.log(`Total Track 2 rows in Track sheet: ${t2Count}`);
}

inspect();
