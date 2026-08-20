import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function inspect() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  console.log("Track 1 Rows:");
  for (const [idx, row] of trackRows.entries()) {
    if (String(row.Track).trim() === "Track 1") {
      const name = String(row.Name || "").trim();
      if (!name) continue;
      console.log(`Row ${idx + 2}: Name="${name}" Topic="${row.Topic}" Session="${row["Session Toppic"] || row.Session}"`);
    }
  }
}

inspect();
