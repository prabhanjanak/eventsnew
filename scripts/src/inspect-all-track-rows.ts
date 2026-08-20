import * as xlsx from "xlsx";
import fs from "fs";

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  let out = "";
  for (const [i, row] of trackRows.entries()) {
    const name = String(row["Name"] || "").trim();
    if (!name) continue;
    out += `[Row ${i + 2}] Track: "${row.Track}" Name: "${row.Name}" Topic: "${row.Topic}" Timing: "${row.Timing}" Session: "${row["Session Toppic"] || row.Session}"\n`;
  }
  
  fs.writeFileSync("C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\scratch\\track-rows.txt", out);
  console.log("Written track-rows.txt");
}

inspect();
